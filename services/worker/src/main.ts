import dotenv from "dotenv";
import { Worker } from "bullmq";
import { loadWorkerEnv } from "@platform/config";
import { createDatabaseClient, createRepositorySet } from "@platform/database";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenRouterAiClient } from "@platform/ai-client";

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

const worker = new Worker(
  "message.received",
  async (job) => {
    const payload = JobPayloadSchema.parse(job.data);

    const mode = await resolveMode(payload.tenantId);
    if (mode === "auto") {
      try {
        const draft = await generateDraftReply(payload.tenantId, payload.conversationId);
        await appendAudit(payload.tenantId, payload.conversationId, "ai.generateDraft", {
          model: draft.model,
        });
        return { ok: true, action: "auto->draft-stored" };
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
  const messages = await repos.messages.listByConversation({ conversationId, limit: 30 });

  const transcript = messages
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Agent"}: ${m.text ?? ""}`)
    .join("\n");

  const model = (await resolveDefaultModel(tenantId)) ?? "openai/gpt-4.1-mini";

  const result = await ai.generate({
    model,
    system:
      "You are a helpful sales/support assistant. Reply concisely in Vietnamese. If unclear, ask one clarifying question.",
    prompt: `Conversation so far:\n${transcript}\n\nWrite the next reply.`,
    temperature: 0.3,
  });

  const idempotencyKey = `draft:${tenantId}:${conversationId}:${Date.now()}`;
  await repos.messages.createOutbound({
    tenantId,
    conversationId,
    messageType: "text",
    text: result.text,
    externalMessageId: null,
    idempotencyKey,
    rawPayload: { kind: "draft", model: result.model },
  });

  return result;
}

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
