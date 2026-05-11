import { z } from "zod";

export const NormalizedMessageTypeSchema = z.enum([
  "text",
  "image",
  "sticker",
  "file",
  "system",
]);

export const NormalizedEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message.received"),
    tenantId: z.string().min(1),
    channel: z.literal("zalo"),
    threadId: z.string().min(1),
    externalMessageId: z.string().min(1).optional(),
    senderExternalId: z.string().min(1),
    messageType: NormalizedMessageTypeSchema,
    text: z.string().min(1).optional(),
    attachments: z
      .array(
        z.object({
          type: z.enum(["image", "file"]),
          url: z.string().url().optional(),
          name: z.string().min(1).optional(),
          mimeType: z.string().min(1).optional(),
          sizeBytes: z.number().int().positive().optional(),
        }),
      )
      .optional(),
    receivedAt: z.string().datetime(),
    idempotencyKey: z.string().min(1),
    rawPayload: z.unknown(),
  }),
  z.object({
    kind: z.literal("message.delivery.updated"),
    tenantId: z.string().min(1),
    channel: z.literal("zalo"),
    threadId: z.string().min(1),
    externalMessageId: z.string().min(1).optional(),
    deliveryStatus: z.enum(["pending", "sent", "delivered", "failed"]),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
    receivedAt: z.string().datetime(),
    rawPayload: z.unknown(),
  }),
  z.object({
    kind: z.literal("connector.health"),
    tenantId: z.string().min(1),
    channel: z.literal("zalo"),
    status: z.enum(["ok", "degraded", "disconnected"]),
    externalAccountId: z.string().min(1).optional(),
    details: z.record(z.unknown()).optional(),
    receivedAt: z.string().datetime(),
    rawPayload: z.unknown(),
  }),
]);

export const OutboundMessageSchema = z.object({
  tenantId: z.string().min(1),
  channel: z.literal("zalo"),
  threadId: z.string().min(1),
  text: z.string().min(1),
  externalContactId: z.string().min(1).optional(),
});

export const TenantConfigSchema = z.object({
  tenantId: z.string().min(1),
  defaultModel: z.string().min(1).optional(),
  classifierModel: z.string().min(1).optional(),
  embeddingModel: z.string().min(1).optional(),
  maxToolTurns: z.number().int().positive(),
  temperature: z.number().min(0).max(2),
});

export const ToolCallAuditSchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  toolName: z.string().min(1),
  input: z.unknown(),
  output: z.unknown().optional(),
  status: z.enum(["ok", "error", "blocked"]),
});
