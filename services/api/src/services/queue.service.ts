import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { loadApiEnv } from "@platform/config";
import type { OutboundMessage } from "@platform/shared/contracts";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

@Injectable()
export class QueueService {
  private readonly messageReceivedQueue: Queue | null = null;
  private readonly messageSendQueue: Queue | null = null;
  private readonly crmSyncQueue: Queue | null = null;
  private readonly humanTaskCreateQueue: Queue | null = null;
  private readonly knowledgeEmbedQueue: Queue | null = null;
  private readonly documentProcessQueue: Queue | null = null;
  private readonly deadLetterQueue: Queue | null = null;

  constructor() {
    const env = loadApiEnv();
    if (!env.REDIS_URL) {
      console.log("[QueueService] No REDIS_URL — running in no-op mode");
      return;
    }

    const connection = { url: env.REDIS_URL };
    this.messageReceivedQueue = new Queue("message.received", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    this.messageSendQueue = new Queue("message.send", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    this.crmSyncQueue = new Queue("crm.sync", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    this.humanTaskCreateQueue = new Queue("human.task.create", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    this.knowledgeEmbedQueue = new Queue("knowledge.embed", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    this.documentProcessQueue = new Queue("document.process", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
    this.deadLetterQueue = new Queue("dead-letter", { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
  }

  async enqueueMessageReceived(payload: {
    tenantId: string;
    conversationId: string;
    idempotencyKey: string;
    action?: "draft" | "ai-react" | "ai-reply";
    targetMessageId?: string;
    reaction?: string;
  }) {
    if (!this.messageReceivedQueue) {
      console.log("[QueueService] enqueueMessageReceived (no-op):", payload);
      return;
    }
    const jobId = payload.idempotencyKey.replaceAll(":", "_");
    await this.messageReceivedQueue.add("message.received", payload, { jobId });
  }

  async enqueueMessageSend(payload: OutboundMessage & { idempotencyKey?: string }) {
    if (!this.messageSendQueue) {
      console.log("[QueueService] enqueueMessageSend (no-op):", payload);
      return;
    }
    const jobId = (payload.idempotencyKey ?? `${payload.tenantId}:${payload.threadId}:${payload.text}`).replaceAll(":", "_");
    await this.messageSendQueue.add("message.send", payload, { jobId });
  }

  async enqueueCrmSync(payload: { tenantId: string; conversationId: string; reason: string }) {
    if (!this.crmSyncQueue) {
      console.log("[QueueService] enqueueCrmSync (no-op):", payload);
      return;
    }
    await this.crmSyncQueue.add("crm.sync", payload);
  }

  async enqueueHumanTaskCreate(payload: {
    tenantId: string;
    conversationId?: string;
    type: "approval" | "handoff";
    reason: string;
  }) {
    if (!this.humanTaskCreateQueue) {
      console.log("[QueueService] enqueueHumanTaskCreate (no-op):", payload);
      return;
    }
    await this.humanTaskCreateQueue.add("human.task.create", payload);
  }

  async enqueueKnowledgeEmbed(payload: { tenantId: string; documentId: string }) {
    if (!this.knowledgeEmbedQueue) {
      console.log("[QueueService] enqueueKnowledgeEmbed (no-op):", payload);
      return;
    }
    await this.knowledgeEmbedQueue.add("knowledge.embed", payload);
  }

  async enqueueDocumentProcess(payload: { tenantId: string; documentId: string }) {
    if (!this.documentProcessQueue) {
      console.log("[QueueService] enqueueDocumentProcess (no-op):", payload);
      return;
    }
    await this.documentProcessQueue.add("document.process", payload);
  }

  async enqueueDeadLetter(payload: {
    sourceQueue: string;
    jobName: string;
    reason: string;
    payload: unknown;
  }) {
    if (!this.deadLetterQueue) {
      console.log("[QueueService] enqueueDeadLetter (no-op):", payload);
      return;
    }
    await this.deadLetterQueue.add("dead-letter", payload);
  }
}
