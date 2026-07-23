import dotenv from "dotenv";
import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "@platform/config";
import { createDatabaseClient, createRepositorySet } from "@platform/database";
import type { MessageRow, ConversationRow } from "@platform/database";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runHrAgentScenario,
  classifyIntent,
  generateChitchatReply,
  resolveHrSkillMode,
  stripTags,
  wrapCandidateMessage,
} from "@platform/agent";
import { startCvWorker } from "@platform/agent/cv-extractor";
import { startDocumentWorker } from "@platform/agent/document-processor";
import { startOutreachCampaignWorkers } from "@platform/agent/outreach-engine";
import type { MockZaloPayload } from "@platform/agent";
import { Redis } from "ioredis";
import { generateText } from "ai";
import { createOpenRouterChatModel } from "@platform/ai-client";
import { buildKnownFacts } from "@platform/core";

const JobPayloadSchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  action: z.enum(["draft", "ai-react", "ai-reply"]).optional(),
  targetMessageId: z.string().uuid().optional(),
  reaction: z.string().optional(),
});

loadRepoEnv();
const env = loadWorkerEnv();
if (!env.REDIS_URL) {
  throw new Error(
    "[worker] REDIS_URL is required to run the worker. The serverless/Vercel deployment runs without a worker; set REDIS_URL only when running the queue-backed worker.",
  );
}
const db = createDatabaseClient(env);
const repos = createRepositorySet(db);
const redisPublisher = new Redis(env.REDIS_URL);

const hrSkillMode = resolveHrSkillMode(process.env.HR_SKILL_MODE);
// Twenty CRM is only a runtime dependency in "twenty" mode; default mode works
// entirely off the platform DB (Twenty stays available for schema/seed tooling).
const twentyRuntimeEnabled = hrSkillMode === "twenty";

async function publishSseEvent(event: { type: string; payload: unknown }) {
  try {
    await redisPublisher.publish("platform:sse", JSON.stringify(event));
  } catch (err) {
    console.error("[worker] Failed to publish SSE event", err);
  }
}

const messageSendQueue = new Queue("message.send", {
  connection: { url: env.REDIS_URL },
});

const cvUploadedQueue = new Queue("cv.uploaded", {
  connection: { url: env.REDIS_URL },
});

interface SessionContext {
  messages: MessageRow[];
  conversation: ConversationRow;
  lastUpdated: number;
}

const sessionCache = new Map<string, SessionContext>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const latestJobForConversation = new Map<string, string>();

const activeAbortControllers = new Map<string, AbortController>();

const worker = new Worker(
  "message.received",
  async (job) => {
    const payload = JobPayloadSchema.parse(job.data);
    const action = payload.action ?? "draft";

    if (action === "ai-react") {
      if (!payload.targetMessageId) {
        throw new Error("Missing targetMessageId for ai-react action");
      }
      await handleAiReact(
        payload.tenantId,
        payload.conversationId,
        payload.targetMessageId,
        payload.reaction,
      );
      return { ok: true, action: "ai-react-completed" };
    }

    if (action === "ai-reply") {
      if (!payload.targetMessageId) {
        throw new Error("Missing targetMessageId for ai-reply action");
      }
      await handleAiReply(
        payload.tenantId,
        payload.conversationId,
        payload.targetMessageId,
      );
      return { ok: true, action: "ai-reply-completed" };
    }
    latestJobForConversation.set(payload.conversationId, job.id!);

    const existingController = activeAbortControllers.get(payload.conversationId);
    if (existingController) {
      console.log(
        `[worker] aborting previous job for conversation ${payload.conversationId} because a newer message arrived`,
      );
      existingController.abort();
    }

    // Debounce: Wait for a short duration (10000ms) to bundle consecutive incoming messages
    await new Promise((resolve) => setTimeout(resolve, 10000));

    if (latestJobForConversation.get(payload.conversationId) !== job.id) {
      console.log(
        `[worker] debounced job ${job.id} for conversation ${payload.conversationId} (newer job received)`,
      );
      return { ok: true, action: "debounced" };
    }

    const mode = await resolveMode(payload.tenantId);
    if (mode === "auto") {
      try {
        const controller = new AbortController();
        activeAbortControllers.set(payload.conversationId, controller);

        const draft = await generateDraftReply(
          payload.tenantId,
          payload.conversationId,
          controller.signal,
        );

        activeAbortControllers.delete(payload.conversationId);

        await appendAudit(payload.tenantId, payload.conversationId, "ai.generateDraft", {
          model: draft.model,
          responseCount: draft.responses.length,
        });
        return {
          ok: true,
          action: "auto->drafts-enqueued",
          responseCount: draft.responses.length,
        };
      } catch (err) {
        activeAbortControllers.delete(payload.conversationId);
        const message = err instanceof Error ? err.message : String(err);

        if (err instanceof Error && err.name === "AbortError") {
          console.log(
            `[worker] job ${job.id} aborted mid-flight for conversation ${payload.conversationId}`,
          );
          return { ok: true, action: "aborted" };
        }

        await appendAuditError(
          payload.tenantId,
          payload.conversationId,
          "ai.generateDraft",
          {
            error: message,
          },
        );
        await createHumanTask(payload.tenantId, payload.conversationId, "approval", {
          reason: "ai-error-fallback",
          error: message,
          idempotencyKey: payload.idempotencyKey,
        });
        return { ok: true, action: "auto->ai-error->approval-task" };
      }
    }

    if (mode === "blocked") {
      await createHumanTask(payload.tenantId, payload.conversationId, "handoff", {
        reason: "blocked-by-policy",
        idempotencyKey: payload.idempotencyKey,
      });
      return { ok: true, action: "blocked->handoff" };
    }

    // approval/manual both create a review task in v1
    await createHumanTask(payload.tenantId, payload.conversationId, "approval", {
      reason: mode === "manual" ? "manual-policy" : "approval-policy",
      idempotencyKey: payload.idempotencyKey,
    });

    return { ok: true, action: `${mode}->approval-task` };
  },
  { connection: { url: env.REDIS_URL } },
);

worker.on("completed", (job) => {
  console.log("[worker] completed", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[worker] failed", job?.id, err);
});

console.log("[worker] started");

const documentWorker = startDocumentWorker({
  redisUrl: env.REDIS_URL,
  repos,
});

documentWorker.on("completed", (job) => {
  console.log("[document-worker] completed", job.id);
});

documentWorker.on("failed", (job, err) => {
  console.error("[document-worker] failed", job?.id, err);
});

if (twentyRuntimeEnabled) {
  const cvWorker = startCvWorker({
    redisUrl: env.REDIS_URL,
    repos,
    redisPublisher,
    messageSendQueue,
  });

  cvWorker.on("completed", (job) => {
    console.log("[cv-worker] completed", job.id);
  });

  cvWorker.on("failed", (job, err) => {
    console.error("[cv-worker] failed", job?.id, err);
  });

  const outreachWorkers = startOutreachCampaignWorkers({
    redisUrl: env.REDIS_URL,
    db,
    repos,
    redisPublisher,
    messageSendQueue,
  });

  outreachWorkers.followupWorker.on("completed", (job) => {
    console.log("[outreach-followup-worker] completed", job.id);
  });

  outreachWorkers.followupWorker.on("failed", (job, err) => {
    console.error("[outreach-followup-worker] failed", job?.id, err);
  });

  outreachWorkers.campaignWorker.on("completed", (job) => {
    console.log("[outreach-campaign-worker] completed", job.id);
  });

  outreachWorkers.campaignWorker.on("failed", (job, err) => {
    console.error("[outreach-campaign-worker] failed", job?.id, err);
  });
} else {
  console.log(
    `[worker] HR_SKILL_MODE=${hrSkillMode}: Twenty-backed CV extraction and outreach workers are disabled`,
  );
}

function loadRepoEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../..");
  dotenv.config({ path: path.join(repoRoot, ".env.local") });
}

async function resolveMode(
  tenantId: string,
): Promise<"auto" | "approval" | "manual" | "blocked"> {
  const workflow = await repos.workflows.findLatestByTenant(tenantId);

  if (!workflow?.mode) {
    return "approval";
  }

  const mode = workflow.mode;
  if (mode === "auto" || mode === "approval" || mode === "manual" || mode === "blocked") {
    return mode;
  }
  return "approval";
}

async function createHumanTask(
  tenantId: string,
  conversationId: string,
  type: "approval" | "handoff",
  payload: Record<string, unknown>,
) {
  await repos.tasks.create({
    tenantId,
    conversationId,
    type,
    status: "open",
    payload,
  });
}

async function generateDraftReply(
  tenantId: string,
  conversationId: string,
  abortSignal?: AbortSignal,
  targetMessage?: MessageRow,
) {
  const now = Date.now();
  const cached = sessionCache.get(conversationId);

  let messages: MessageRow[];
  let conversation: ConversationRow;

  if (cached && now - cached.lastUpdated < CACHE_TTL_MS) {
    conversation = cached.conversation;
    // Fetch only the latest 10 messages from the database to find new ones
    const latestDbMessages = await repos.messages.listByConversation({
      conversationId,
      limit: 10,
    });

    // Merge latest messages with the cache, avoiding duplicates
    const cachedMap = new Map(cached.messages.map((m) => [m.id, m]));
    for (const msg of latestDbMessages) {
      cachedMap.set(msg.id, msg);
    }

    // Sort chronologically and limit to last 100 messages
    const merged = Array.from(cachedMap.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    messages = merged.slice(-100);
    cached.messages = messages;
    cached.lastUpdated = now;
  } else {
    // Cache miss or expired: Load last 100 messages and conversation
    messages = await repos.messages.listByConversation({ conversationId, limit: 100 });
    const conversationDb = await repos.conversations.findById(conversationId);
    if (!conversationDb) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    conversation = conversationDb;
    sessionCache.set(conversationId, {
      messages,
      conversation,
      lastUpdated: now,
    });
  }

  const contactList = await repos.contacts.listByIds({ ids: [conversation.contact_id] });
  const contact = contactList[0];
  const contactName = contact?.display_name ?? "Khách hàng";
  const externalUserId = contact?.external_user_id ?? "unknown";

  const overrideModel = conversation.override_model;
  const defaultModel = (await resolveDefaultModel(tenantId)) ?? "cohere/north-mini-code:free";
  const model = overrideModel || defaultModel;

  const classifierModel = (await resolveClassifierModel(tenantId)) ?? "cohere/north-mini-code:free";
  const routerMessages = messages.map((m) => ({
    role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
    content:
      m.direction === "inbound"
        ? wrapCandidateMessage(m.text ?? "")
        : (m.text ?? ""),
  }));

  const knownFacts = await buildKnownFacts(repos, conversationId);

  const classification = await classifyIntent(
    routerMessages,
    classifierModel,
    knownFacts,
  );
  console.log(
    `[worker] classification result for conversation ${conversationId}: ${classification.category} (reason: ${classification.reason})`,
  );

  if (classification.category === "CHITCHAT") {
    const chitchatText = await generateChitchatReply(
      routerMessages,
      classifierModel,
      knownFacts,
    );
    const responses = parseDraftResponses(chitchatText);
    const batchId = `draft:${tenantId}:${conversationId}:${Date.now()}`;

    for (const [index, response] of responses.entries()) {
      const idempotencyKey = `${batchId}:${index + 1}`;
      const msgRow = await repos.messages.createOutbound({
        tenantId,
        conversationId,
        messageType: "text",
        text: response,
        externalMessageId: null,
        idempotencyKey,
        rawPayload: {
          kind: "chitchat",
          model: classifierModel,
          responseIndex: index + 1,
          responseCount: responses.length,
          originalText: chitchatText,
          quote: targetMessage
            ? {
                msg: targetMessage.text,
                externalMessageId: targetMessage.external_message_id,
                id: targetMessage.id,
                data: (targetMessage.raw_payload as any)?.data,
              }
            : undefined,
        },
      });
      await publishSseEvent({
        type: "message_created",
        payload: {
          conversationId,
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
            rawPayload: msgRow.raw_payload,
          },
        },
      });
      await enqueueZaloMessage({
        tenantId,
        threadId: conversation.external_thread_id,
        text: response,
        idempotencyKey,
        quote: targetMessage ? (targetMessage.raw_payload as any)?.data : undefined,
      });
    }

    return { text: chitchatText, model: classifierModel, responses };
  }

  // Check if latest message is a file/resume upload
  const latestMessage = messages[messages.length - 1];
  const isFile = latestMessage?.message_type === "file";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachments = (latestMessage?.raw_payload as any)?.attachments || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileAttachment = attachments.find((a: any) => a.type === "file");

  if (isFile && fileAttachment) {
    let ackText: string;
    if (twentyRuntimeEnabled) {
      console.log(
        `[worker] detected file upload in conversation ${conversationId}. Enqueueing to cv.uploaded...`,
      );
      await cvUploadedQueue.add("cv.extract", {
        tenantId,
        conversationId,
        externalUserId,
        fileUrl: fileAttachment.url,
        fileName: fileAttachment.name,
        mimeType: fileAttachment.mimeType,
        sizeBytes: fileAttachment.sizeBytes,
      });
      ackText =
        "Mình đã nhận được CV của bạn. Hệ thống đang tiến hành xử lý và trích xuất thông tin. Mình sẽ phản hồi lại ngay sau khi hoàn tất nhé! ⏳";
    } else {
      console.log(
        `[worker] detected file upload in conversation ${conversationId}, but CV extraction is disabled (HR_SKILL_MODE=${hrSkillMode}); acknowledging without processing`,
      );
      ackText =
        "Mình đã nhận được CV của bạn, cảm ơn bạn nhé! Bạn chia sẻ giúp mình vị trí và mức lương mong muốn để mình tìm công việc phù hợp cho bạn nha.";
    }
    const batchId = `cv_ack:${tenantId}:${conversationId}:${Date.now()}`;
    const idempotencyKey = `${batchId}:1`;

    const msgRow = await repos.messages.createOutbound({
      tenantId,
      conversationId,
      messageType: "text",
      text: ackText,
      externalMessageId: null,
      idempotencyKey,
      rawPayload: { kind: "cv_ack" },
    });

    await publishSseEvent({
      type: "message_created",
      payload: {
        conversationId,
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
    });

    await enqueueZaloMessage({
      tenantId,
      threadId: conversation.external_thread_id,
      text: ackText,
      idempotencyKey,
    });

    return { text: ackText, model: "system", responses: [ackText] };
  }

  let systemPromptOverride: string | undefined;
  const useDbPrompt = process.env.USE_DB_PROMPT === "true";

  if (useDbPrompt) {
    const dbPrompt = await repos.prompts.findActive({ tenantId, key: "assistant" });
    if (dbPrompt) {
      systemPromptOverride = dbPrompt.content;
      // Replace placeholders using {{key}}
      const variables: Record<string, string> = {
        contact_name: contactName,
        tenant_id: tenantId,
      };
      for (const [k, v] of Object.entries(variables)) {
        systemPromptOverride = systemPromptOverride.replaceAll(`{{${k}}}`, v);
      }
    }
  }

  if (targetMessage) {
    systemPromptOverride =
      (systemPromptOverride || "") +
      `\n\nIMPORTANT: The candidate has sent a message that you are replying to: "${stripTags(targetMessage.text ?? "")}". Make sure your response specifically and directly replies to/quotes this message.`;
  }

  // Format messages for the tool-calling agent runner
  const formattedMessages: MockZaloPayload[] = messages.map((m) => ({
    id: m.id,
    tenantId: m.tenant_id,
    channel: "zalo" as const,
    threadId: conversation.external_thread_id,
    externalUserId: m.direction === "inbound" ? externalUserId : "agent",
    text: m.text ?? "",
    receivedAt: new Date(m.created_at).toISOString(),
    raw: (m.raw_payload as Record<string, unknown>) ?? {},
  }));

  const scenario = {
    id: conversationId,
    name: conversationId,
    description: "Zalo Simulator isolation run.",
    tenantId,
    channel: "zalo" as const,
    threadId: conversation.external_thread_id,
    externalUserId,
    messages: formattedMessages,
  };

  // Run the tool-loop agent scenario!
  const agentResult = await runHrAgentScenario({
    scenario,
    model,
    useLocalCache: true,
    forceProfileReload: false,
    printCache: false,
    mockLlm: false,
    skillMode: hrSkillMode,
    systemPromptOverride,
    knownFacts,
    abortSignal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onStepFinish: async (step: any) => {
      if (step.text) {
        console.log(`[worker:step] Step Assistant text: ${step.text.trim()}`);
      }
      if (!step.toolCalls || step.toolCalls.length === 0) return;
      for (const call of step.toolCalls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchingResult = step.toolResults?.find(
          (r: any) => r.toolCallId === call.toolCallId,
        );
        console.log(
          `[worker:step] Step Tool Call: ${call.toolName} (callId: ${call.toolCallId}) args:`,
          JSON.stringify(call.args),
          `status: ${matchingResult?.isError ? "error" : "ok"}`
        );
        const auditRow = await repos.audits.append({
          tenantId,
          conversationId,
          runId: call.toolCallId,
          toolName: call.toolName,
          inputPayload: call.args,
          outputPayload: matchingResult ? matchingResult.result : null,
          status: matchingResult?.isError ? "error" : "ok",
        });
        await publishSseEvent({
          type: "audit_created",
          payload: {
            conversationId,
            audit: auditRow,
          },
        });
      }
    },
  });

  const responses = parseDraftResponses(agentResult.assistantText);
  const batchId = `draft:${tenantId}:${conversationId}:${Date.now()}`;

  for (const [index, response] of responses.entries()) {
    const idempotencyKey = `${batchId}:${index + 1}`;
    const msgRow = await repos.messages.createOutbound({
      tenantId,
      conversationId,
      messageType: "text",
      text: response,
      externalMessageId: null,
      idempotencyKey,
      rawPayload: {
        kind: "draft",
        model: model,
        responseIndex: index + 1,
        responseCount: responses.length,
        originalText: agentResult.assistantText,
        quote: targetMessage
          ? {
              msg: targetMessage.text,
              externalMessageId: targetMessage.external_message_id,
              id: targetMessage.id,
              data: (targetMessage.raw_payload as any)?.data,
            }
          : undefined,
      },
    });
    await publishSseEvent({
      type: "message_created",
      payload: {
        conversationId,
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
          rawPayload: msgRow.raw_payload,
        },
      },
    });
    await enqueueZaloMessage({
      tenantId,
      threadId: conversation.external_thread_id,
      text: response,
      idempotencyKey,
      quote: targetMessage ? (targetMessage.raw_payload as any)?.data : undefined,
    });
  }

  return { text: agentResult.assistantText, model, responses };
}

function parseDraftResponses(text: string): string[] {
  const parsed = DraftResponsesSchema.safeParse(parseJsonLike(text));
  if (parsed.success) {
    return normalizeResponses(
      Array.isArray(parsed.data) ? parsed.data : parsed.data.responses,
    );
  }

  if (/<nl>/i.test(text)) {
    return normalizeNlResponses(
      text.split(/<nl>/i).map((part) => part.trim()),
    );
  }

  return normalizeResponses(
    text.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")),
  );
}

function normalizeNlResponses(responses: string[]): string[] {
  const cleaned = responses
    .map((response) => response.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    throw new Error("OpenRouter response did not include any chat responses");
  }

  return cleaned;
}

function parseJsonLike(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeResponses(responses: string[]): string[] {
  const cleaned = responses
    .flatMap((response) => response.split(/\n+/))
    .map((response) => response.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    throw new Error("OpenRouter response did not include any chat responses");
  }

  return cleaned;
}

async function enqueueZaloMessage(input: {
  tenantId: string;
  threadId: string;
  text: string;
  idempotencyKey: string;
  quote?: any;
}) {
  const jobId = input.idempotencyKey.replaceAll(":", "_");
  await messageSendQueue.add(
    "message.send",
    {
      tenantId: input.tenantId,
      channel: "zalo",
      threadId: input.threadId,
      text: input.text,
      idempotencyKey: input.idempotencyKey,
      quote: input.quote,
    },
    { jobId },
  );
}

const DraftResponsesSchema = z.union([
  z.object({
    responses: z.array(z.string().trim().min(1)).min(1),
  }),
  z.array(z.string().trim().min(1)).min(1),
]);

async function resolveDefaultModel(tenantId: string): Promise<string | null> {
  const workflow = await repos.workflows.findLatestByTenant(tenantId);
  return workflow?.default_model ?? null;
}

async function resolveClassifierModel(tenantId: string): Promise<string | null> {
  const workflow = await repos.workflows.findLatestByTenant(tenantId);
  return workflow?.classifier_model ?? null;
}

async function appendAudit(
  tenantId: string,
  conversationId: string,
  toolName: string,
  output: Record<string, unknown>,
) {
  const auditRow = await repos.audits.append({
    tenantId,
    conversationId,
    runId: null,
    toolName,
    inputPayload: {},
    outputPayload: output,
    status: "ok",
  });
  await publishSseEvent({
    type: "audit_created",
    payload: {
      conversationId,
      audit: auditRow,
    },
  });
}

async function appendAuditError(
  tenantId: string,
  conversationId: string,
  toolName: string,
  output: Record<string, unknown>,
) {
  const auditRow = await repos.audits.append({
    tenantId,
    conversationId,
    runId: null,
    toolName,
    inputPayload: {},
    outputPayload: output,
    status: "error",
  });
  await publishSseEvent({
    type: "audit_created",
    payload: {
      conversationId,
      audit: auditRow,
    },
  });
}

async function handleAiReact(
  tenantId: string,
  conversationId: string,
  messageId: string,
  manualReaction?: string,
) {
  // 1. Fetch target message
  const messagesList = await repos.messages.listByConversation({
    conversationId,
    limit: 100,
  });
  const targetMessage = messagesList.find((m) => m.id === messageId);
  if (!targetMessage) {
    throw new Error(`Target message not found: ${messageId}`);
  }

  // 2. Load conversation
  const conversation = await repos.conversations.findById(conversationId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  let reactionCode = "";

  if (manualReaction) {
    reactionCode = manualReaction;
  } else {
    // 3. Prompt LLM to choose reaction
    const model =
      conversation.override_model ||
      (await resolveDefaultModel(tenantId)) ||
      "google/gemini-2.5-flash";
    const messagesContext = messagesList
      .slice(-10) // last 10 messages for context
      .map((m) => `${m.direction === "inbound" ? "Candidate" : "Agent"}: ${m.text}`)
      .join("\n");

    const prompt = `You are a conversation reaction helper. Based on the following chat conversation history, select the single most appropriate reaction emoji for the final message.
  
Conversation History:
${messagesContext}

Target Message to react to:
"${targetMessage.text}"

Select exactly ONE emoji reaction from this list:
- HEART (love, care, heart emoji)
- LIKE (thumbs up, agreement)
- HAHA (funny, laugh)
- WOW (surprised, amazed)
- CRY (sad, sorry)
- ANGRY (mad, frustrated)

Response format:
Respond with ONLY the exact reaction name in uppercase, e.g. "HEART" or "LIKE". Do not include any other text, punctuation, or markdown formatting.`;

    console.log(
      `[worker] generating reaction for message ${messageId} using model ${model}`,
    );
    const modelInstance = createOpenRouterChatModel({ model });
    const result = await generateText({
      model: modelInstance as any,
      prompt,
      maxTokens: 10,
      temperature: 0.1,
    });

    const responseText = result.text.trim().toUpperCase();
    console.log(`[worker] reaction response text: ${responseText}`);

    // Map to Reactions enum
    if (responseText.includes("HEART")) reactionCode = "/-heart";
    else if (responseText.includes("LIKE")) reactionCode = "/-strong";
    else if (responseText.includes("HAHA")) reactionCode = ":>";
    else if (responseText.includes("WOW")) reactionCode = ":o";
    else if (responseText.includes("CRY")) reactionCode = ":-((";
    else if (responseText.includes("ANGRY")) reactionCode = ":-h";
    else reactionCode = "/-strong"; // default
  }

  // 4. Update database raw_payload
  const rawPayload = (targetMessage.raw_payload as Record<string, any>) || {};
  rawPayload.reactions = [
    {
      emoji: reactionCode,
      sender: "agent",
      createdAt: new Date().toISOString(),
    },
  ];
  await repos.messages.updateRawPayload(messageId, rawPayload);

  // 5. Publish SSE message_updated event
  await publishSseEvent({
    type: "message_updated",
    payload: {
      conversationId,
      messageId,
      rawPayload,
    },
  });

  // 6. Enqueue reaction to message.send for Zalo
  if (targetMessage.external_message_id) {
    await messageSendQueue.add("message.send", {
      tenantId,
      channel: "zalo",
      threadId: conversation.external_thread_id,
      reaction: reactionCode,
      targetExternalMessageId: targetMessage.external_message_id,
      targetExternalCliMessageId:
        rawPayload.data?.cliMsgId ||
        rawPayload.data?.msgId ||
        targetMessage.external_message_id,
    });
  }
}

async function handleAiReply(
  tenantId: string,
  conversationId: string,
  messageId: string,
) {
  // 1. Fetch target message
  const messagesList = await repos.messages.listByConversation({
    conversationId,
    limit: 100,
  });
  const targetMessage = messagesList.find((m) => m.id === messageId);
  if (!targetMessage) {
    throw new Error(`Target message not found: ${messageId}`);
  }

  // 2. Call generateDraftReply with targetMessage
  await generateDraftReply(tenantId, conversationId, undefined, targetMessage);
}
