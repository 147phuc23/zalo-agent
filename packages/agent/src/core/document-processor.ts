import { Worker } from "bullmq";
import type { createRepositorySet } from "@platform/database";
import { createStorage } from "@platform/storage";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { OpenRouterAiClient } from "@platform/ai-client";
import { extractLocationSlugs } from "./location-normalizer.js";

export interface DocumentProcessorDeps {
  redisUrl: string;
  repos: ReturnType<typeof createRepositorySet>;
}

const JD_EXTRACTOR_SYSTEM_PROMPT = `You are an expert system that extracts structured job postings from raw job description text.
You MUST output a valid JSON object matching the following structure:
{
  "title": "Job Title",
  "company": "Company Name",
  "requiredSkills": ["Skill 1", "Skill 2"], // Technical skills, languages, frameworks
  "salaryMinVnd": number, // Minimum salary in VND. If monthly, e.g. "25 triệu/tháng" or "25tr", convert to VND (25,000,000). If in USD (e.g. "$1,500"), convert to VND using 1 USD = 25000 VND. If negotiable or not mentioned, use 0.
  "salaryMaxVnd": number, // Maximum salary in VND. If monthly, e.g. "30 triệu/tháng" or "30tr", convert to VND (30,000,000). If in USD (e.g. "$2,000"), convert to VND using 1 USD = 25000 VND. If negotiable or not mentioned, use 0.
  "workMode": "remote" | "hybrid" | "onsite", // Default to "hybrid" if not clear
  "seniority": "junior" | "mid" | "mid-senior" | "senior" | "lead" | "principal",
  "jobType": "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP",
  "experienceRequiredYears": number | null, // Years of experience required, or null
  "benefits": "Summary of benefits (e.g. 13th month salary, healthcare)",
  "educationRequired": "Education requirements or null",
  "description": "Short summary of responsibilities",
  "locationText": "Raw location string (e.g. Ho Chi Minh, Ha Noi, remote)"
}

Ensure your response is ONLY the JSON object. Do not include markdown codeblocks or other formatting.`;

export function startDocumentWorker(deps: DocumentProcessorDeps) {
  console.log("[document-processor] Starting document worker...");

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

      try {
        let rawText = doc.raw_text || "";
        let parseMethod = doc.parse_method || "plain-text";

        // If rawText is not populated, we need to read from storage
        if (!rawText && doc.storage_key) {
          const storage = createStorage(process.env);
          const fileBuffer = await storage.getObject(doc.storage_key);
          const ext = doc.file_name.toLowerCase().split(".").pop();

          if (ext === "pdf") {
            const parsed = await extractText(fileBuffer, { mergePages: true });
            rawText = parsed.text;
            parseMethod = "unpdf";
          } else if (ext === "docx") {
            const parsed = await mammoth.extractRawText({ buffer: fileBuffer });
            rawText = parsed.value;
            parseMethod = "mammoth";
          } else {
            rawText = fileBuffer.toString("utf-8");
            parseMethod = "plain-text";
          }
        }

        await deps.repos.documents.markProcessed({
          id: documentId,
          rawText,
          parseMethod,
        });

        if (doc.kind === "jd") {
          console.log(`[document-processor] Extracting JD fields from document ${documentId}`);
          
          const model = process.env.HR_AGENT_MODEL || "tencent/hy3:free";
          const client = new OpenRouterAiClient();
          const response = await client.generate({
            model,
            system: JD_EXTRACTOR_SYSTEM_PROMPT,
            prompt: `Extract structured job posting fields from this job description text:\n\n${rawText}`,
            temperature: 0.1,
            responseFormat: { type: "json_object" },
          });

          let jsonText = response.text.trim();
          if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
          }

          const extractedFields = JSON.parse(jsonText);
          
          // Constrain location slugs via location-normalizer
          const locationText = extractedFields.locationText || extractedFields.location || "";
          const locationSlugs = extractLocationSlugs(locationText || rawText);

          let companyName = extractedFields.company || "Unknown Company";
          if (doc.company_id) {
            const companyObj = await deps.repos.companies.findById(doc.company_id);
            if (companyObj) {
              companyName = companyObj.name;
            }
          }

          // Build draft
          await deps.repos.jobs.createDraft({
            tenantId,
            sourceDocumentId: documentId,
            fields: {
              title: extractedFields.title || "Untitled Job",
              company: companyName,
              locationSlugs: locationSlugs.length > 0 ? locationSlugs : ["remote"], // fallback to remote if none detected
              workMode: extractedFields.workMode || "hybrid",
              salaryMinVnd: extractedFields.salaryMinVnd || 0,
              salaryMaxVnd: extractedFields.salaryMaxVnd || 0,
              seniority: extractedFields.seniority || "mid",
              requiredSkills: extractedFields.requiredSkills || [],
              description: extractedFields.description || "",
              jobType: extractedFields.jobType || "FULL_TIME",
              experienceRequiredYears: extractedFields.experienceRequiredYears ?? null,
              benefits: extractedFields.benefits || null,
              educationRequired: extractedFields.educationRequired || null,
            }
          });
          
          console.log(`[document-processor] Successfully created draft job posting for document ${documentId}`);
        }

        console.log(`[document-processor] Successfully processed document ${documentId}`);
      } catch (err: any) {
        console.error(`[document-processor] Processing failed for document ${documentId}:`, err);
        await deps.repos.documents.markFailed({
          id: documentId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    {
      connection: { url: deps.redisUrl },
    }
  );

  return worker;
}
