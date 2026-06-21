import type { createRepositorySet } from "@platform/database";

type Repos = ReturnType<typeof createRepositorySet>;

export interface InboundMessageEvent {
  tenantId: string;
  channel: "zalo";
  threadId: string;
  senderExternalId: string;
  messageType: string;
  text?: string | null;
  externalMessageId?: string | null;
  idempotencyKey: string;
  rawPayload?: Record<string, unknown>;
  receivedAt: string;
  displayName?: string | null;
}

export interface IngestResult {
  status: "stored" | "duplicate";
  conversationId: string;
  messageId?: string;
}

/**
 * Store an inbound message directly in Postgres: ensure tenant/contact/conversation,
 * then insert the message. Mirrors the backend IngestService.message.received path but
 * without the Redis queue / SSE publish (those are the always-on worker's job).
 */
export async function ingestInboundMessage(
  repos: Repos,
  event: InboundMessageEvent,
): Promise<IngestResult> {
  await repos.tenants.ensureExists({
    tenantId: event.tenantId,
    name: `tenant-${event.tenantId.slice(0, 8)}`,
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
  });

  let contact = await repos.contacts.findByExternalUser({
    tenantId: event.tenantId,
    channel: event.channel,
    externalUserId: event.senderExternalId,
  });
  if (!contact) {
    contact = await repos.contacts.createShadow({
      tenantId: event.tenantId,
      channel: event.channel,
      externalUserId: event.senderExternalId,
      displayName: event.displayName ?? null,
    });
  }

  let conversation = await repos.conversations.findByExternalThread({
    tenantId: event.tenantId,
    channel: event.channel,
    externalThreadId: event.threadId,
  });
  if (!conversation) {
    conversation = await repos.conversations.create({
      tenantId: event.tenantId,
      channel: event.channel,
      externalThreadId: event.threadId,
      contactId: contact.id,
      lastActivityAt: event.receivedAt,
    });
  }

  try {
    const message = await repos.messages.createInbound({
      tenantId: event.tenantId,
      conversationId: conversation.id,
      messageType: event.messageType,
      text: event.text ?? null,
      externalMessageId: event.externalMessageId ?? null,
      idempotencyKey: event.idempotencyKey,
      rawPayload: event.rawPayload ?? {},
    });
    await repos.conversations.updateLastActivity(conversation.id, event.receivedAt);
    return { status: "stored", conversationId: conversation.id, messageId: message.id };
  } catch (err: unknown) {
    // 23505 = unique violation on idempotency key → already ingested
    if ((err as { code?: string })?.code === "23505") {
      return { status: "duplicate", conversationId: conversation.id };
    }
    throw err;
  }
}
