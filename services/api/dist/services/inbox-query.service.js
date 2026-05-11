var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "./supabase.service.js";
let InboxQueryService = class InboxQueryService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async listConversations(input) {
        const db = this.supabase.client;
        const conversationsResult = await db
            .from("conversations")
            .select("id, tenant_id, channel, external_thread_id, status, assignee_user_id, contact_id, last_activity_at, created_at")
            .eq("tenant_id", input.tenantId)
            .order("last_activity_at", { ascending: false })
            .limit(input.limit);
        if (conversationsResult.error) {
            throw new Error(conversationsResult.error.message);
        }
        const conversations = conversationsResult.data ?? [];
        const contactIds = conversations.map((conversation) => conversation.contact_id);
        const contactsById = new Map();
        if (contactIds.length > 0) {
            const contactsResult = await db
                .from("contacts")
                .select("id, display_name, external_user_id")
                .in("id", contactIds);
            if (contactsResult.error) {
                throw new Error(contactsResult.error.message);
            }
            for (const contact of contactsResult.data ?? []) {
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
            lastActivityAt: conversation.last_activity_at,
            createdAt: conversation.created_at,
            contact: contactsById.get(conversation.contact_id) ?? null,
        }));
    }
    async listMessages(input) {
        const db = this.supabase.client;
        const messagesResult = await db
            .from("messages")
            .select("id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, created_at")
            .eq("conversation_id", input.conversationId)
            .order("created_at", { ascending: true })
            .limit(input.limit);
        if (messagesResult.error) {
            throw new Error(messagesResult.error.message);
        }
        return (messagesResult.data ?? []).map((message) => ({
            id: message.id,
            tenantId: message.tenant_id,
            conversationId: message.conversation_id,
            direction: message.direction,
            messageType: message.message_type,
            text: message.text,
            externalMessageId: message.external_message_id,
            idempotencyKey: message.idempotency_key,
            createdAt: message.created_at,
        }));
    }
};
InboxQueryService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [SupabaseService])
], InboxQueryService);
export { InboxQueryService };
