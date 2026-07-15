import { Worker, Queue } from "bullmq";
import { Redis } from "ioredis";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { z } from "zod";
import { OpenRouterAiClient } from "@platform/ai-client";
import { createStorage } from "@platform/storage";
import type { createRepositorySet } from "@platform/database";
import { clearHrAgentProfileCache } from "./runner.js";
import { createTwentyRecruitingClientFromEnv } from "../twenty/recruiting-client.js";

export interface DocumentProcessorDeps {
  redisUrl: string;
  repos: ReturnType<typeof createRepositorySet>;
}

const CandidateProfileSchema = z.object({
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  yearsOfExperience: z.number().nullable().optional(),
  skills: z.array(z.string()).default([]),
  preferredRoles: z.array(z.string()).default([]),
  salaryExpectationVnd: z.number().nullable().optional(),
  availability: z.string().nullable().optional(),
  workHistory: z.array(
    z.object({
      company: z.string().default(""),
      title: z.string().default(""),
      from: z.string().default(""),
      to: z.string().default(""),
      description: z.string().default(""),
    })
  ).default([]),
  education: z.array(
    z.object({
      school: z.string().default(""),
      degree: z.string().default(""),
      field: z.string().default(""),
      from: z.string().default(""),
      to: z.string().default(""),
    })
  ).default([]),
  languages: z.array(z.string()).default([]),
  summary: z.string().default(""),
});

const CV_EXTRACTOR_SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) CV parser.
Your task is to extract structured candidate profile details from the candidate's resume/CV details.

You must return a JSON object in this format:
{
  "fullName": "Full Name",
  "email": "Email Address",
  "phone": "Phone Number",
  "location": "City/Location",
  "currentTitle": "Current Title",
  "yearsOfExperience": number,
  "skills": ["Skill 1", "Skill 2", ...],
  "preferredRoles": ["Role 1", "Role 2", ...],
  "salaryExpectationVnd": number or null,
  "availability": "Notice period or immediate",
  "workHistory": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "from": "MM/YYYY or YYYY",
      "to": "MM/YYYY or YYYY or Present",
      "description": "Job description or achievements"
    }
  ],
  "education": [
    {
      "school": "School Name",
      "degree": "Degree (e.g. Bachelor, Master)",
      "field": "Field of study",
      "from": "YYYY",
      "to": "YYYY"
    }
  ],
  "languages": ["Language 1", "Language 2", ...],
  "summary": "Short professional summary"
}

Only respond with the JSON object. Do not include markdown blocks or other text.`;

async function computeSqlJobMatches(
  tenantId: string,
  profile: any,
  repos: any
): Promise<Array<{ job: { title: string; company: string }; score: number }>> {
  try {
    const jobs = await repos.jobPostings.listActive({ tenantId });
    const matches = jobs.map((job: any) => {
      let score = 0;
      const titleLower = (job.title || "").toLowerCase();
      const currentTitleLower = (profile.currentTitle || "").toLowerCase();
      if (currentTitleLower && (titleLower.includes(currentTitleLower) || currentTitleLower.includes(titleLower))) {
        score += 4;
      }
      const preferredRoles = profile.preferredRoles || [];
      for (const role of preferredRoles) {
        const roleLower = role.toLowerCase();
        if (titleLower.includes(roleLower) || roleLower.includes(titleLower)) {
          score += 3;
          break;
        }
      }
      const jobSkills = job.required_skills || [];
      const candidateSkills = profile.skills || [];
      const matchedSkills = candidateSkills.filter((s: string) =>
        jobSkills.some((js: string) => js.toLowerCase() === s.toLowerCase())
      );
      score += matchedSkills.length * 1.5;

      return {
        job: {
          title: job.title,
          company: job.company,
        },
        score: Math.min(10, Math.round(score)),
      };
    });

    return matches.filter((m: any) => m.score >= 3).sort((a: any, b: any) => b.score - a.score).slice(0, 3);
  } catch (err) {
    console.error("[document-processor] SQL job matches failed:", err);
    return [];
  }
}

export function startDocumentWorker(deps: DocumentProcessorDeps) {
  console.log("[document-processor] Starting document worker...");

  const storage = createStorage();
  const messageSendQueue = new Queue("message.send", {
    connection: { url: deps.redisUrl },
  });
  const redisPublisher = new Redis(deps.redisUrl);

  const worker = new Worker(
    "document.process",
    async (job) => {
      const { tenantId, documentId } = job.data as { tenantId: string; documentId: string };
      console.log(`[document-processor] Processing document ${documentId} for tenant ${tenantId}`);

      const doc = await deps.repos.documents.findById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      await deps.repos.documents.markProcessing(documentId);

      let rawText = "";
      let parseMethod: "unpdf" | "mammoth" | "llm-vision" | "plain-text" = "plain-text";

      try {
        const buffer = await storage.getObject(doc.storage_key);

        if (doc.mime_type === "application/pdf" || doc.file_name.toLowerCase().endsWith(".pdf")) {
          const extracted = await extractText(buffer, { mergePages: true });
          rawText = typeof (extracted as any).text === "string" ? (extracted as any).text : (extracted as any).text.join("\n");
          const pageCount = extracted.totalPages || 1;
          parseMethod = "unpdf";

          // Scanned PDF heuristic: raw_text/pageCount < 200 chars -> LLM vision fallback
          if (rawText.length / pageCount < 200) {
            console.log(`[document-processor] Detected scanned PDF (length: ${rawText.length}, pages: ${pageCount}). Running LLM vision fallback...`);
            const base64Pdf = buffer.toString("base64");
            
            const env = {
              OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
              OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
            };

            if (!env.OPENROUTER_API_KEY) {
              throw new Error("OPENROUTER_API_KEY is required for vision fallback");
            }

            const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
              method: "POST",
              headers: {
                authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "Here is a scanned PDF CV. Please perform OCR and extract all of its raw text content accurately. Do not summarize; extract all words exactly as they appear."
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:application/pdf;base64,${base64Pdf}`
                        }
                      }
                    ]
                  }
                ]
              })
            });

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`OpenRouter vision fallback failed: ${response.status} - ${errText}`);
            }

            const payload = await response.json();
            const extractedText = payload.choices?.[0]?.message?.content?.trim() || "";
            if (extractedText) {
              rawText = extractedText;
              parseMethod = "llm-vision";
            } else {
              throw new Error("OpenRouter vision response did not include content");
            }
          }
        } else if (
          doc.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          doc.file_name.toLowerCase().endsWith(".docx")
        ) {
          const result = await mammoth.extractRawText({ buffer });
          rawText = result.value;
          parseMethod = "mammoth";
        } else if (doc.file_name.toLowerCase().endsWith(".doc")) {
          throw new Error("Hệ thống không hỗ trợ tệp định dạng .doc cũ. Vui lòng chuyển đổi sang .docx hoặc .pdf để tiếp tục.");
        } else {
          rawText = buffer.toString("utf8");
          parseMethod = "plain-text";
        }

        await deps.repos.documents.markProcessed({
          id: documentId,
          rawText,
          parseMethod,
        });

      } catch (err: any) {
        console.error(`[document-processor] Error parsing document ${documentId}:`, err);
        await deps.repos.documents.markFailed({
          id: documentId,
          error: err.message || String(err),
        });
        throw err;
      }

      // If this is a CV, run CV profile extraction and matching
      if (doc.kind === "cv") {
        console.log(`[document-processor] Extracting candidate profile for CV ${documentId}`);
        const client = new OpenRouterAiClient();
        let retries = 2;
        let extractedProfile: any = null;
        while (retries > 0) {
          try {
            const response = await client.generate({
              model: "google/gemini-2.5-flash",
              system: CV_EXTRACTOR_SYSTEM_PROMPT,
              prompt: `Extract structured profile information from this resume raw text:\n\n${rawText}`,
              temperature: 0.1,
              responseFormat: { type: "json_object" },
            });
            const parsed = JSON.parse(response.text.trim());
            extractedProfile = CandidateProfileSchema.parse(parsed);
            break;
          } catch (err) {
            retries--;
            if (retries === 0) {
              throw new Error(`Failed to extract CV info: ${err instanceof Error ? err.message : String(err)}`);
            }
            console.warn(`[document-processor] Retrying CV extraction due to error:`, err);
          }
        }

        const profile = await deps.repos.candidateProfiles.upsert({
          tenantId,
          contactId: doc.contact_id || undefined,
          guestAccessId: doc.guest_access_id || undefined,
          sourceDocumentId: doc.id,
          patch: {
            fullName: extractedProfile.fullName,
            email: extractedProfile.email,
            phone: extractedProfile.phone,
            location: extractedProfile.location,
            currentTitle: extractedProfile.currentTitle,
            yearsOfExperience: extractedProfile.yearsOfExperience,
            skills: extractedProfile.skills,
            preferredRoles: extractedProfile.preferredRoles,
            salaryExpectationVnd: extractedProfile.salaryExpectationVnd,
            availability: extractedProfile.availability,
            workHistory: extractedProfile.workHistory,
            education: extractedProfile.education,
            languages: extractedProfile.languages,
            summary: extractedProfile.summary,
            rawExtraction: extractedProfile,
          }
        });

        clearHrAgentProfileCache();

        // Get externalUserId from contact_id if possible
        let externalUserId = "unknown";
        if (doc.contact_id) {
          const contact = await deps.repos.contacts.findById(doc.contact_id);
          if (contact) {
            externalUserId = contact.external_user_id;
          }
        }

        // Job matching
        let topMatches: Array<{ job: { title: string; company: string }; score: number }> = [];
        const twentyRuntimeEnabled = process.env.TWENTY_RECRUITING_API_URL && process.env.TWENTY_RECRUITING_API_KEY;

        if (twentyRuntimeEnabled) {
          try {
            const recruitingClient = createTwentyRecruitingClientFromEnv();
            await recruitingClient.updateCandidateProfile({
              externalUserId,
              patch: {
                displayName: extractedProfile.fullName,
                phone: extractedProfile.phone,
                email: extractedProfile.email,
                location: extractedProfile.location,
                yearsOfExperience: extractedProfile.yearsOfExperience,
                currentTitle: extractedProfile.currentTitle,
                skills: extractedProfile.skills,
                preferredRoles: extractedProfile.preferredRoles,
                salaryExpectationVnd: extractedProfile.salaryExpectationVnd,
                availability: extractedProfile.availability,
              } as any,
            });
            const profile = await recruitingClient.loadCandidateProfile({ externalUserId });
            const matches = await recruitingClient.computeJobMatchScores({ profile });
            topMatches = matches.filter((m) => m.score > 2).slice(0, 3).map(m => ({
              job: {
                title: m.job?.title || "",
                company: m.job?.company || "",
              },
              score: m.score,
            }));
          } catch (err) {
            console.error("[document-processor] Twenty sync/matching failed, falling back to SQL matches:", err);
            topMatches = await computeSqlJobMatches(tenantId, extractedProfile, deps.repos);
          }
        } else {
          topMatches = await computeSqlJobMatches(tenantId, extractedProfile, deps.repos);
        }

        // Output summary message if uploaded by Zalo
        if (doc.uploaded_by === "zalo" && doc.conversation_id) {
          const conversation = await deps.repos.conversations.findById(doc.conversation_id);
          if (!conversation) {
            throw new Error(`Conversation not found: ${doc.conversation_id}`);
          }

          const displayName = extractedProfile.fullName || "bạn";
          let replyText = `Chào ${displayName}! Mình đã nhận được CV và cập nhật thông tin của bạn vào hệ thống CRM thành công. 🎉\n\n`;

          if (topMatches.length > 0) {
            replyText += `Dựa vào kỹ năng của bạn (${(extractedProfile.skills || []).slice(0, 4).join(", ")}), mình xin đề xuất một số công việc phù hợp nhất:\n`;
            for (const match of topMatches) {
              replyText += `- **${match.job?.title}** tại ${match.job?.company} (Độ phù hợp: ${match.score}/10)\n`;
            }
            replyText += `\nBạn có muốn biết thêm chi tiết về vị trí nào ở trên không? 😊`;
          } else {
            replyText += `Hiện tại mình chưa tìm thấy công việc nào khớp chính xác với kỹ năng của bạn. Mình sẽ tiếp tục cập nhật và chủ động liên hệ lại ngay khi có vị trí phù hợp nha! 👍`;
          }

          const batchId = `cv_processed:${tenantId}:${doc.conversation_id}:${Date.now()}`;
          const idempotencyKey = `${batchId}:1`;

          const msgRow = await deps.repos.messages.createOutbound({
            tenantId,
            conversationId: doc.conversation_id,
            messageType: "text",
            text: replyText,
            externalMessageId: null,
            idempotencyKey,
            rawPayload: {
              kind: "cv_processed",
              profile: extractedProfile,
            },
          });

          await redisPublisher.publish(
            "platform:sse",
            JSON.stringify({
              type: "message_created",
              payload: {
                conversationId: doc.conversation_id,
                message: {
                  id: msgRow.id,
                  tenantId: msgRow.tenant_id,
                  conversationId: msgRow.conversation_id,
                  direction: msgRow.direction,
                  messageType: msgRow.message_type,
                  text: msgRow.text,
                  externalMessageId: msgRow.external_message_id,
                  idempotencyKey: msgRow.idempotency_key,
                  isRead: msgRow.is_read,
                  readAt: msgRow.read_at ? new Date(msgRow.read_at).toISOString() : null,
                  createdAt: new Date(msgRow.created_at).toISOString(),
                },
              },
            }),
          );

          const sendJobId = idempotencyKey.replaceAll(":", "_");
          await messageSendQueue.add(
            "message.send",
            {
              tenantId,
              channel: "zalo",
              threadId: conversation.external_thread_id,
              text: replyText,
              idempotencyKey,
            },
            { jobId: sendJobId },
          );
        }
      }

      console.log(`[document-processor] Successfully processed document ${documentId}`);
    },
    {
      connection: { url: deps.redisUrl },
    }
  );

  return worker;
}
