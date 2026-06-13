export type Channel = "zalo";
export type NormalizedEventKind = "message.received" | "message.delivery.updated" | "connector.health";
export type NormalizedMessageType = "text" | "image" | "sticker" | "file" | "system";
export interface NormalizedEventBase {
    kind: NormalizedEventKind;
    tenantId: string;
    channel: Channel;
    receivedAt: string;
    rawPayload: unknown;
}
export interface MessageReceivedEvent extends NormalizedEventBase {
    kind: "message.received";
    threadId: string;
    externalMessageId?: string;
    senderExternalId: string;
    messageType: NormalizedMessageType;
    text?: string;
    attachments?: Array<{
        type: "image" | "file";
        url?: string;
        name?: string;
        mimeType?: string;
        sizeBytes?: number;
    }>;
    idempotencyKey: string;
}
export interface MessageDeliveryUpdatedEvent extends NormalizedEventBase {
    kind: "message.delivery.updated";
    threadId: string;
    externalMessageId?: string;
    deliveryStatus: "pending" | "sent" | "delivered" | "failed";
    errorCode?: string;
    errorMessage?: string;
}
export interface ConnectorHealthEvent extends NormalizedEventBase {
    kind: "connector.health";
    status: "ok" | "degraded" | "disconnected";
    externalAccountId?: string;
    details?: Record<string, unknown>;
}
export type NormalizedEvent = MessageReceivedEvent | MessageDeliveryUpdatedEvent | ConnectorHealthEvent;
export interface OutboundMessage {
    tenantId: string;
    channel: Channel;
    threadId: string;
    text: string;
    externalContactId?: string;
}
export interface TenantConfig {
    tenantId: string;
    defaultModel?: string;
    classifierModel?: string;
    embeddingModel?: string;
    maxToolTurns: number;
    temperature: number;
}
export interface ToolCallAudit {
    tenantId: string;
    conversationId?: string;
    runId?: string;
    toolName: string;
    input: unknown;
    output?: unknown;
    status: "ok" | "error" | "blocked";
}
