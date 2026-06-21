import type { createRepositorySet } from "@platform/database";

type Repos = ReturnType<typeof createRepositorySet>;

export async function listConversations(repos: Repos, input: { tenantId: string; limit: number }) {
  const conversations = await repos.conversations.listByTenant(input);
  const contactIds = conversations.map((c) => c.contact_id);
  const contactsById = new Map<string, { displayName: string | null; externalUserId: string }>();

  if (contactIds.length > 0) {
    const contacts = await repos.contacts.listByIds({ ids: contactIds });
    for (const c of contacts) {
      contactsById.set(c.id, {
        displayName: c.display_name,
        externalUserId: c.external_user_id,
      });
    }
  }

  return conversations.map((c) => ({
    id: c.id,
    tenantId: c.tenant_id,
    channel: c.channel,
    externalThreadId: c.external_thread_id,
    status: c.status,
    assigneeUserId: c.assignee_user_id,
    overrideModel: c.override_model,
    lastActivityAt: c.last_activity_at,
    createdAt: c.created_at,
    contact: contactsById.get(c.contact_id) ?? null,
  }));
}

export async function listMessages(repos: Repos, input: { conversationId: string; limit: number }) {
  const messages = await repos.messages.listByConversation(input);
  return messages.map((m) => ({
    id: m.id,
    tenantId: m.tenant_id,
    conversationId: m.conversation_id,
    direction: m.direction,
    messageType: m.message_type,
    text: m.text,
    externalMessageId: m.external_message_id,
    idempotencyKey: m.idempotency_key,
    rawPayload: m.raw_payload,
    isRead: m.is_read,
    readAt: m.read_at,
    createdAt: m.created_at,
  }));
}

export async function createConversation(
  repos: Repos,
  input: {
    tenantId: string;
    channel: string;
    externalThreadId: string;
    externalUserId: string;
    displayName?: string | null;
  }
) {
  // Ensure tenant exists
  await repos.tenants.ensureExists({
    tenantId: input.tenantId,
    name: `tenant-${input.tenantId.slice(0, 8)}`,
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
  });

  // Find or create contact
  let contact = await repos.contacts.findByExternalUser({
    tenantId: input.tenantId,
    channel: input.channel,
    externalUserId: input.externalUserId,
  });
  if (!contact) {
    contact = await repos.contacts.createShadow({
      tenantId: input.tenantId,
      channel: input.channel,
      externalUserId: input.externalUserId,
      displayName: input.displayName ?? null,
    });
  }

  // Find or create conversation
  let conversation = await repos.conversations.findByExternalThread({
    tenantId: input.tenantId,
    channel: input.channel,
    externalThreadId: input.externalThreadId,
  });
  if (!conversation) {
    conversation = await repos.conversations.create({
      tenantId: input.tenantId,
      channel: input.channel,
      externalThreadId: input.externalThreadId,
      contactId: contact.id,
    });
  }

  return { conversationId: conversation.id };
}
