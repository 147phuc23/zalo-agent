import { Worker } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { loadWorkerEnv } from "@platform/config";
import { z } from "zod";
const JobPayloadSchema = z.object({
    tenantId: z.string().min(1),
    conversationId: z.string().min(1),
    idempotencyKey: z.string().min(1),
});
const env = loadWorkerEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});
const worker = new Worker("message.received", async (job) => {
    const payload = JobPayloadSchema.parse(job.data);
    const mode = await resolveMode(payload.tenantId);
    if (mode === "auto") {
        return { ok: true, action: "auto" };
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
}, { connection: { url: env.REDIS_URL } });
worker.on("completed", (job) => {
    // eslint-disable-next-line no-console
    console.log("[worker] completed", job.id);
});
worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error("[worker] failed", job?.id, err);
});
// eslint-disable-next-line no-console
console.log("[worker] started");
async function resolveMode(tenantId) {
    const res = await db
        .from("workflow_configs")
        .select("mode")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (res.error || !res.data?.mode) {
        return "approval";
    }
    const mode = res.data.mode;
    if (mode === "auto" || mode === "approval" || mode === "manual" || mode === "blocked") {
        return mode;
    }
    return "approval";
}
async function createHumanTask(tenantId, conversationId, type, payload) {
    const insert = await db.from("human_tasks").insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        type,
        status: "open",
        payload,
    });
    if (insert.error) {
        throw new Error(insert.error.message);
    }
}
