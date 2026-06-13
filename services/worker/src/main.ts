import dotenv from "dotenv";
import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "@platform/config";
import { createDatabaseClient, createRepositorySet } from "@platform/database";
import type { Database } from "@platform/database";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenRouterAiClient } from "@platform/ai-client";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];

const JobPayloadSchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

loadRepoEnv();
const env = loadWorkerEnv();
const db = createDatabaseClient(env);
const repos = createRepositorySet(db);
const ai = new OpenRouterAiClient();
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

  const transcript = messages
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Agent"}: ${m.text ?? ""}`)
    .join("\n");

  const model = (await resolveDefaultModel(tenantId)) ?? "openai/gpt-4.1-mini";

  const result = await ai.generate({
    model,
    system:
      [
        "You are a helpful sales/support assistant.",
        "Reply concisely in Vietnamese as a natural chat conversation.",
        "Return only JSON in this shape: {\"responses\":[\"message 1\",\"message 2\"]}.",
        "Strictly follow a message-by-message response style like a human chatting on a messaging app.",
        "Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble). Use 1-4 short responses in total.",
        "Break your thoughts into sequential, realistic chat bubbles instead of combining everything into a single long reply.",
        "Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.",
        "Do not write one very long message with newlines; instead, break it down into a list of separate messages inside the responses array.",
        "Do not put newline characters inside any response.",
        "If unclear, ask one clarifying question.",
      ].join(" "),
    prompt: `Conversation so far:\n${transcript}\n\nWrite the next chat responses.`,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
  });

  const responses = parseDraftResponses(result.text);
  const batchId = `draft:${tenantId}:${conversationId}:${Date.now()}`;

  for (const [index, response] of responses.entries()) {
    const idempotencyKey = `${batchId}:${index + 1}`;
    await repos.messages.createOutbound({
      tenantId,
      conversationId,
      messageType: "text",
      text: response,
      externalMessageId: null,
      idempotencyKey,
      rawPayload: {
        kind: "draft",
        model: result.model,
        responseIndex: index + 1,
        responseCount: responses.length,
        originalText: result.text,
      },
    });
    await enqueueZaloMessage({
      tenantId,
      threadId: conversation.external_thread_id,
      text: response,
      idempotencyKey,
    });
  }

  return { ...result, responses };
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
  await repos.audits.append({
    tenantId,
    conversationId,
    runId: null,
    toolName,
    inputPayload: {},
    outputPayload: output,
    status: "ok",
  });
}

async function appendAuditError(
  tenantId: string,
  conversationId: string,
  toolName: string,
  output: Record<string, unknown>,
) {
  await repos.audits.append({
    tenantId,
    conversationId,
    runId: null,
    toolName,
    inputPayload: {},
    outputPayload: output,
    status: "error",
  });
}
