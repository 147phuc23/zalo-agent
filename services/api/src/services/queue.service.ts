import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { loadApiEnv } from "@platform/config";
import type { OutboundMessage } from "@platform/shared/contracts";

@Injectable()
export class QueueService {
  private readonly messageReceivedQueue: Queue;
  private readonly messageSendQueue: Queue;
  private readonly crmSyncQueue: Queue;
  private readonly humanTaskCreateQueue: Queue;
  private readonly knowledgeEmbedQueue: Queue;
  private readonly deadLetterQueue: Queue;

  constructor() {
    const env = loadApiEnv();
    const connection = { url: env.REDIS_URL };

    this.messageReceivedQueue = new Queue("message.received", {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.messageSendQueue = new Queue("message.send", {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.crmSyncQueue = new Queue("crm.sync", {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.humanTaskCreateQueue = new Queue("human.task.create", {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.knowledgeEmbedQueue = new Queue("knowledge.embed", {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.deadLetterQueue = new Queue("dead-letter", {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  async enqueueMessageReceived(payload: {
    tenantId: string;
    conversationId: string;
    idempotencyKey: string;
    action?: "draft" | "ai-react" | "ai-reply";
    targetMessageId?: string;
    reaction?: string;
  }) {
    const queueJobId = payload.idempotencyKey.replaceAll(":", "_");

    await this.messageReceivedQueue.add(
      "message.received",
      payload,
      { jobId: queueJobId },
    );
  }

  async enqueueMessageSend(payload: OutboundMessage & { idempotencyKey?: string }) {
    const jobId = (payload.idempotencyKey ?? `${payload.tenantId}:${payload.threadId}:${payload.text}`).replaceAll(
      ":",
      "_",
    );

    await this.messageSendQueue.add("message.send", payload, { jobId });
  }

  async enqueueCrmSync(payload: { tenantId: string; conversationId: string; reason: string }) {
    await this.crmSyncQueue.add("crm.sync", payload);
  }

  async enqueueHumanTaskCreate(payload: {
    tenantId: string;
    conversationId?: string;
    type: "approval" | "handoff";
    reason: string;
  }) {
    await this.humanTaskCreateQueue.add("human.task.create", payload);
  }

  async enqueueKnowledgeEmbed(payload: { tenantId: string; documentId: string }) {
    await this.knowledgeEmbedQueue.add("knowledge.embed", payload);
  }

  async enqueueDeadLetter(payload: {
    sourceQueue: string;
    jobName: string;
    reason: string;
    payload: unknown;
  }) {
    await this.deadLetterQueue.add("dead-letter", payload);
  }
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
