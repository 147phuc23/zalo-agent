import { Injectable } from "@nestjs/common";
import type { OutboundMessage } from "@platform/shared/contracts";

@Injectable()
export class QueueService {
  async enqueueMessageReceived(payload: {
    tenantId: string;
    conversationId: string;
    idempotencyKey: string;
    action?: "draft" | "ai-react" | "ai-reply";
    targetMessageId?: string;
    reaction?: string;
  }) {
    console.log("[QueueService] enqueueMessageReceived (no-op):", payload);
  }

  async enqueueMessageSend(payload: OutboundMessage & { idempotencyKey?: string }) {
    console.log("[QueueService] enqueueMessageSend (no-op):", payload);
  }

  async enqueueCrmSync(payload: { tenantId: string; conversationId: string; reason: string }) {
    console.log("[QueueService] enqueueCrmSync (no-op):", payload);
  }

  async enqueueHumanTaskCreate(payload: {
    tenantId: string;
    conversationId?: string;
    type: "approval" | "handoff";
    reason: string;
  }) {
    console.log("[QueueService] enqueueHumanTaskCreate (no-op):", payload);
  }

  async enqueueKnowledgeEmbed(payload: { tenantId: string; documentId: string }) {
    console.log("[QueueService] enqueueKnowledgeEmbed (no-op):", payload);
  }

  async enqueueDeadLetter(payload: {
    sourceQueue: string;
    jobName: string;
    reason: string;
    payload: unknown;
  }) {
    console.log("[QueueService] enqueueDeadLetter (no-op):", payload);
  }
}
