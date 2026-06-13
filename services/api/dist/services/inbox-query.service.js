var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Inject, Injectable } from "@nestjs/common";
import { PostgresService } from "./postgres.service.js";
let InboxQueryService = class InboxQueryService {
    postgres;
    constructor(postgres) {
        this.postgres = postgres;
    }
    async listConversations(input) {
        const conversations = await this.postgres.repos.conversations.listByTenant(input);
        const contactIds = conversations.map((c) => c.contact_id);
        const contactsById = new Map();
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
    async listMessages(input) {
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
};
InboxQueryService = __decorate([
    Injectable(),
    __param(0, Inject(PostgresService)),
    __metadata("design:paramtypes", [PostgresService])
], InboxQueryService);
export { InboxQueryService };
