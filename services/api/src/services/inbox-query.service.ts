import { Inject, Injectable } from "@nestjs/common";
import { PostgresService } from "./postgres.service.js";

@Injectable()
export class InboxQueryService {
  constructor(@Inject(PostgresService) private readonly postgres: PostgresService) {}

  async listConversations(input: { tenantId: string; limit: number }) {
    const conversations = await this.postgres.repos.conversations.listByTenant(input);
    const contactIds = conversations.map((c) => c.contact_id);

    const contactsById = new Map<string, { displayName: string | null; externalUserId: string }>();

    if (contactIds.length > 0) {
      const contacts = await this.postgres.repos.contacts.listByIds({ ids: contactIds });
      for (const contact of contacts) {
        contactsById.set(contact.id, {
          displayName: contact.display_name,
          externalUserId: contact.external_user_id,
        });
      }
    }

    return conversations.map((conversation) => ({
      id: conversation.id,
      tenantId: conversation.tenant_id,
      channel: conversation.channel,
      externalThreadId: conversation.external_thread_id,
      status: conversation.status,
      assigneeUserId: conversation.assignee_user_id,
      overrideModel: conversation.override_model,
      lastActivityAt: conversation.last_activity_at,
      createdAt: conversation.created_at,
      contact: contactsById.get(conversation.contact_id) ?? null,
    }));
  }

  async listMessages(input: { conversationId: string; limit: number }) {
    const messages = await this.postgres.repos.messages.listByConversation(input);
    return messages.map((message) => ({
      id: message.id,
      tenantId: message.tenant_id,
      conversationId: message.conversation_id,
      direction: message.direction,
      messageType: message.message_type,
      text: message.text,
      externalMessageId: message.external_message_id,
      idempotencyKey: message.idempotency_key,
      isRead: message.is_read,
      readAt: message.read_at,
      createdAt: message.created_at,
    }));
  }
}
