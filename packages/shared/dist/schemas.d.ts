import { z } from "zod";
export declare const NormalizedMessageTypeSchema: z.ZodEnum<["text", "image", "sticker", "file", "system"]>;
export declare const NormalizedEventSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"message.received">;
    tenantId: z.ZodString;
    channel: z.ZodLiteral<"zalo">;
    threadId: z.ZodString;
    externalMessageId: z.ZodOptional<z.ZodString>;
    senderExternalId: z.ZodString;
    messageType: z.ZodEnum<["text", "image", "sticker", "file", "system"]>;
    text: z.ZodOptional<z.ZodString>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["image", "file"]>;
        url: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        sizeBytes: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "image" | "file";
        url?: string | undefined;
        name?: string | undefined;
        mimeType?: string | undefined;
        sizeBytes?: number | undefined;
    }, {
        type: "image" | "file";
        url?: string | undefined;
        name?: string | undefined;
        mimeType?: string | undefined;
        sizeBytes?: number | undefined;
    }>, "many">>;
    receivedAt: z.ZodString;
    idempotencyKey: z.ZodString;
    rawPayload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    kind: "message.received";
    tenantId: string;
    channel: "zalo";
    threadId: string;
    senderExternalId: string;
    messageType: "text" | "image" | "sticker" | "file" | "system";
    receivedAt: string;
    idempotencyKey: string;
    text?: string | undefined;
    externalMessageId?: string | undefined;
    attachments?: {
        type: "image" | "file";
        url?: string | undefined;
        name?: string | undefined;
        mimeType?: string | undefined;
        sizeBytes?: number | undefined;
    }[] | undefined;
    rawPayload?: unknown;
}, {
    kind: "message.received";
    tenantId: string;
    channel: "zalo";
    threadId: string;
    senderExternalId: string;
    messageType: "text" | "image" | "sticker" | "file" | "system";
    receivedAt: string;
    idempotencyKey: string;
    text?: string | undefined;
    externalMessageId?: string | undefined;
    attachments?: {
        type: "image" | "file";
        url?: string | undefined;
        name?: string | undefined;
        mimeType?: string | undefined;
        sizeBytes?: number | undefined;
    }[] | undefined;
    rawPayload?: unknown;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"message.delivery.updated">;
    tenantId: z.ZodString;
    channel: z.ZodLiteral<"zalo">;
    threadId: z.ZodString;
    externalMessageId: z.ZodOptional<z.ZodString>;
    deliveryStatus: z.ZodEnum<["pending", "sent", "delivered", "failed"]>;
    errorCode: z.ZodOptional<z.ZodString>;
    errorMessage: z.ZodOptional<z.ZodString>;
    receivedAt: z.ZodString;
    rawPayload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    kind: "message.delivery.updated";
    tenantId: string;
    channel: "zalo";
    threadId: string;
    receivedAt: string;
    deliveryStatus: "pending" | "sent" | "delivered" | "failed";
    externalMessageId?: string | undefined;
    rawPayload?: unknown;
    errorCode?: string | undefined;
    errorMessage?: string | undefined;
}, {
    kind: "message.delivery.updated";
    tenantId: string;
    channel: "zalo";
    threadId: string;
    receivedAt: string;
    deliveryStatus: "pending" | "sent" | "delivered" | "failed";
    externalMessageId?: string | undefined;
    rawPayload?: unknown;
    errorCode?: string | undefined;
    errorMessage?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"connector.health">;
    tenantId: z.ZodString;
    channel: z.ZodLiteral<"zalo">;
    status: z.ZodEnum<["ok", "degraded", "disconnected"]>;
    externalAccountId: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    receivedAt: z.ZodString;
    rawPayload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    kind: "connector.health";
    status: "ok" | "degraded" | "disconnected";
    tenantId: string;
    channel: "zalo";
    receivedAt: string;
    rawPayload?: unknown;
    externalAccountId?: string | undefined;
    details?: Record<string, unknown> | undefined;
}, {
    kind: "connector.health";
    status: "ok" | "degraded" | "disconnected";
    tenantId: string;
    channel: "zalo";
    receivedAt: string;
    rawPayload?: unknown;
    externalAccountId?: string | undefined;
    details?: Record<string, unknown> | undefined;
}>]>;
export declare const OutboundMessageSchema: z.ZodObject<{
    tenantId: z.ZodString;
    channel: z.ZodLiteral<"zalo">;
    threadId: z.ZodString;
    text: z.ZodString;
    externalContactId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    tenantId: string;
    channel: "zalo";
    threadId: string;
    externalContactId?: string | undefined;
}, {
    text: string;
    tenantId: string;
    channel: "zalo";
    threadId: string;
    externalContactId?: string | undefined;
}>;
export declare const TenantConfigSchema: z.ZodObject<{
    tenantId: z.ZodString;
    defaultModel: z.ZodOptional<z.ZodString>;
    classifierModel: z.ZodOptional<z.ZodString>;
    embeddingModel: z.ZodOptional<z.ZodString>;
    maxToolTurns: z.ZodNumber;
    temperature: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    maxToolTurns: number;
    temperature: number;
    defaultModel?: string | undefined;
    classifierModel?: string | undefined;
    embeddingModel?: string | undefined;
}, {
    tenantId: string;
    maxToolTurns: number;
    temperature: number;
    defaultModel?: string | undefined;
    classifierModel?: string | undefined;
    embeddingModel?: string | undefined;
}>;
export declare const ToolCallAuditSchema: z.ZodObject<{
    tenantId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    toolName: z.ZodString;
    input: z.ZodUnknown;
    output: z.ZodOptional<z.ZodUnknown>;
    status: z.ZodEnum<["ok", "error", "blocked"]>;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "error" | "blocked";
    tenantId: string;
    toolName: string;
    conversationId?: string | undefined;
    runId?: string | undefined;
    input?: unknown;
    output?: unknown;
}, {
    status: "ok" | "error" | "blocked";
    tenantId: string;
    toolName: string;
    conversationId?: string | undefined;
    runId?: string | undefined;
    input?: unknown;
    output?: unknown;
}>;
