import dotenv from "dotenv";
import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "@platform/config";
import { createDatabaseClient, createRepositorySet } from "@platform/database";
import type { MessageRow, ConversationRow } from "@platform/database";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHrAgentScenario } from "./agent/core/runner.js";
import type { MockZaloPayload, HrSkillMode } from "./agent/types.js";
import { Redis } from "ioredis";

const JobPayloadSchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

loadRepoEnv();
const env = loadWorkerEnv();
const db = createDatabaseClient(env);
const repos = createRepositorySet(db);
const redisPublisher = new Redis(env.REDIS_URL);

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

interface SessionContext {
  messages: MessageRow[];
  conversation: ConversationRow;
  lastUpdated: number;
}

const sessionCache = new Map<string, SessionContext>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const latestJobForConversation = new Map<string, string>();

const worker = new Worker(
  "message.received",
  async (job) => {
    const payload = JobPayloadSchema.parse(job.data);
    latestJobForConversation.set(payload.conversationId, job.id!);

    // Debounce: Wait for a short duration (2000ms) to bundle consecutive incoming messages
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (latestJobForConversation.get(payload.conversationId) !== job.id) {
      console.log(`[worker] debounced job ${job.id} for conversation ${payload.conversationId} (newer job received)`);
      return { ok: true, action: "debounced" };
    }

    const mode = await resolveMode(payload.tenantId);
    if (mode === "auto") {
      try {
        const draft = await generateDraftReply(payload.tenantId, payload.conversationId);
        await appendAudit(payload.tenantId, payload.conversationId, "ai.generateDraft", {
          model: draft.model,
          responseCount: draft.responses.length,
        });
        return { ok: true, action: "auto->drafts-enqueued", responseCount: draft.responses.length };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await appendAuditError(payload.tenantId, payload.conversationId, "ai.generateDraft", {
          error: message,
        });
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

function loadRepoEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../..");
  dotenv.config({ path: path.join(repoRoot, ".env.local") });
}

async function resolveMode(tenantId: string): Promise<"auto" | "approval" | "manual" | "blocked"> {
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

async function generateDraftReply(tenantId: string, conversationId: string) {
  const now = Date.now();
  const cached = sessionCache.get(conversationId);

  let messages: MessageRow[];
  let conversation: ConversationRow;

  if (cached && (now - cached.lastUpdated) < CACHE_TTL_MS) {
    conversation = cached.conversation;
    // Fetch only the latest 10 messages from the database to find new ones
    const latestDbMessages = await repos.messages.listByConversation({ conversationId, limit: 10 });
    
    // Merge latest messages with the cache, avoiding duplicates
    const cachedMap = new Map(cached.messages.map((m) => [m.id, m]));
    for (const msg of latestDbMessages) {
      cachedMap.set(msg.id, msg);
    }

    // Sort chronologically and limit to last 100 messages
    const merged = Array.from(cachedMap.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
  const defaultModel = (await resolveDefaultModel(tenantId)) ?? "openrouter/owl-alpha";
  const model = overrideModel || defaultModel;

  let systemPromptOverride: string | undefined;
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
    skillMode: (process.env.HR_SKILL_MODE as HrSkillMode) || "default",
    systemPromptOverride,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onStepFinish: async (step: any) => {
      if (!step.toolCalls || step.toolCalls.length === 0) return;
      for (const call of step.toolCalls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchingResult = step.toolResults?.find((r: any) => r.toolCallId === call.toolCallId);
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
        },
      },
    });
    await enqueueZaloMessage({
      tenantId,
      threadId: conversation.external_thread_id,
      text: response,
      idempotencyKey,
    });
  }

  return { text: agentResult.assistantText, model, responses };
}

function parseDraftResponses(text: string): string[] {
  const parsed = DraftResponsesSchema.safeParse(parseJsonLike(text));
  if (parsed.success) {
    return normalizeResponses(Array.isArray(parsed.data) ? parsed.data : parsed.data.responses);
  }

  return normalizeResponses(
    text
      .split(/\n+/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")),
  );
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
