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
import { QueueService } from "./queue.service.js";
let IngestService = class IngestService {
    supabase;
    queue;
    constructor(supabase, queue) {
        this.supabase = supabase;
        this.queue = queue;
    }
    async ingestEvents(events) {
        const results = [];
        for (const event of events) {
            if (event.kind === "message.received") {
                results.push(await this.ingestMessageReceived(event));
            }
            else if (event.kind === "message.delivery.updated") {
                results.push(await this.ingestMessageDeliveryUpdated(event));
            }
            else if (event.kind === "connector.health") {
                results.push(await this.ingestConnectorHealth(event));
            }
        }
        return results;
    }
    async ingestMessageReceived(event) {
        const db = this.supabase.client;
        const tenant = await this.ensureTenant(event.tenantId);
        if (!tenant.ok)
            return tenant;
        const contact = await this.ensureContact(event);
        if (!contact.ok)
            return contact;
        const conversation = await this.ensureConversation(event, contact.contactId);
        if (!conversation.ok)
            return conversation;
        const messageInsert = await db.from("messages").insert({
            tenant_id: event.tenantId,
            conversation_id: conversation.conversationId,
            direction: "inbound",
            message_type: event.messageType,
            text: event.text ?? null,
            external_message_id: event.externalMessageId ?? null,
            idempotency_key: event.idempotencyKey,
            raw_payload: event.rawPayload,
        });
        if (messageInsert.error) {
            // idempotency conflict is acceptable; treat as duplicate
            if (String(messageInsert.error.code) === "23505") {
                return { kind: event.kind, status: "duplicate" };
            }
            return { kind: event.kind, status: "error", error: messageInsert.error.message };
        }
        await db
            .from("conversations")
            .update({ last_activity_at: event.receivedAt })
            .eq("id", conversation.conversationId);
        await this.queue.enqueueMessageReceived({
            tenantId: event.tenantId,
            conversationId: conversation.conversationId,
            idempotencyKey: event.idempotencyKey,
        });
        return {
            kind: event.kind,
            status: "stored",
            tenantId: event.tenantId,
            conversationId: conversation.conversationId,
        };
    }
    async ingestMessageDeliveryUpdated(event) {
        const db = this.supabase.client;
        const messageLookup = event.externalMessageId
            ? await db
                .from("messages")
                .select("id")
                .eq("tenant_id", event.tenantId)
                .eq("external_message_id", event.externalMessageId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            : null;
        if (messageLookup?.error) {
            return { kind: event.kind, status: "error", error: messageLookup.error.message };
        }
        if (!messageLookup?.data) {
            return {
                kind: event.kind,
                status: "not_found",
                externalMessageId: event.externalMessageId ?? null,
            };
        }
        const insert = await db.from("message_deliveries").insert({
            tenant_id: event.tenantId,
            message_id: messageLookup.data.id,
            attempt: 1,
            status: event.deliveryStatus,
            error_code: event.errorCode ?? null,
            error_message: event.errorMessage ?? null,
            provider_payload: event.rawPayload,
        });
        if (insert.error) {
            return { kind: event.kind, status: "error", error: insert.error.message };
        }
        return {
            kind: event.kind,
            status: "stored",
            messageId: messageLookup.data.id,
        };
    }
    async ingestConnectorHealth(event) {
        const db = this.supabase.client;
        const tenant = await this.ensureTenant(event.tenantId);
        if (!tenant.ok) {
            return tenant;
        }
        if (!event.externalAccountId) {
            return {
                kind: event.kind,
                status: "ignored",
                reason: "missing_external_account_id",
            };
        }
        const existing = await db
            .from("channel_accounts")
            .select("id")
            .eq("tenant_id", event.tenantId)
            .eq("channel", event.channel)
            .eq("external_account_id", event.externalAccountId)
            .maybeSingle();
        if (existing.error) {
            return { kind: event.kind, status: "error", error: existing.error.message };
        }
        if (existing.data) {
            const update = await db
                .from("channel_accounts")
                .update({
                status: event.status,
                last_seen_at: event.receivedAt,
            })
                .eq("id", existing.data.id);
            if (update.error) {
                return { kind: event.kind, status: "error", error: update.error.message };
            }
            return { kind: event.kind, status: "stored", channelAccountId: existing.data.id };
        }
        const insert = await db
            .from("channel_accounts")
            .insert({
            tenant_id: event.tenantId,
            channel: event.channel,
            external_account_id: event.externalAccountId,
            status: event.status,
            encrypted_session_blob: null,
            last_seen_at: event.receivedAt,
        })
            .select("id")
            .single();
        if (insert.error) {
            return { kind: event.kind, status: "error", error: insert.error.message };
        }
        return { kind: event.kind, status: "stored", channelAccountId: insert.data.id };
    }
    async ensureTenant(tenantId) {
        const db = this.supabase.client;
        const existing = await db.from("tenants").select("id").eq("id", tenantId).maybeSingle();
        if (existing.error)
            return { ok: false, error: existing.error.message };
        if (existing.data)
            return { ok: true };
        const inserted = await db.from("tenants").insert({
            id: tenantId,
            name: `tenant-${tenantId.slice(0, 8)}`,
            timezone: "Asia/Ho_Chi_Minh",
            locale: "vi-VN",
            status: "active",
        });
        if (inserted.error)
            return { ok: false, error: inserted.error.message };
        return { ok: true };
    }
    async ensureContact(event) {
        const db = this.supabase.client;
        const existing = await db
            .from("contacts")
            .select("id")
            .eq("tenant_id", event.tenantId)
            .eq("channel", event.channel)
            .eq("external_user_id", event.senderExternalId)
            .maybeSingle();
        if (existing.error)
            return { ok: false, error: existing.error.message };
        if (existing.data)
            return { ok: true, contactId: existing.data.id };
        const inserted = await db
            .from("contacts")
            .insert({
            tenant_id: event.tenantId,
            channel: event.channel,
            external_user_id: event.senderExternalId,
            display_name: null,
            phone: null,
            metadata: {},
        })
            .select("id")
            .single();
        if (inserted.error)
            return { ok: false, error: inserted.error.message };
        return { ok: true, contactId: inserted.data.id };
    }
    async ensureConversation(event, contactId) {
        const db = this.supabase.client;
        const existing = await db
            .from("conversations")
            .select("id")
            .eq("tenant_id", event.tenantId)
            .eq("channel", event.channel)
            .eq("external_thread_id", event.threadId)
            .maybeSingle();
        if (existing.error)
            return { ok: false, error: existing.error.message };
        if (existing.data)
            return { ok: true, conversationId: existing.data.id };
        const inserted = await db
            .from("conversations")
            .insert({
            tenant_id: event.tenantId,
            channel: event.channel,
            external_thread_id: event.threadId,
            contact_id: contactId,
            status: "open",
            assignee_user_id: null,
            last_activity_at: event.receivedAt,
        })
            .select("id")
            .single();
        if (inserted.error)
            return { ok: false, error: inserted.error.message };
        return { ok: true, conversationId: inserted.data.id };
    }
};
IngestService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [SupabaseService,
        QueueService])
], IngestService);
export { IngestService };
