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
import { QueueService } from "./queue.service.js";
let IngestService = class IngestService {
    postgres;
    queue;
    constructor(postgres, queue) {
        this.postgres = postgres;
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
        const tenant = await this.ensureTenant(event.tenantId);
        if (!tenant.ok)
            return tenant;
        const contact = await this.ensureContact(event);
        if (!contact.ok)
            return contact;
        const conversation = await this.ensureConversation(event, contact.contactId);
        if (!conversation.ok)
            return conversation;
        try {
            await this.postgres.repos.messages.createInbound({
                tenantId: event.tenantId,
                conversationId: conversation.conversationId,
                messageType: event.messageType,
                text: event.text ?? null,
                externalMessageId: event.externalMessageId ?? null,
                idempotencyKey: event.idempotencyKey,
                rawPayload: event.rawPayload,
            });
        }
        catch (error) {
            // Postgres unique violation code is 23505 (idempotency key constraint)
            if (error.code === "23505") {
                return { kind: event.kind, status: "duplicate" };
            }
            return { kind: event.kind, status: "error", error: error.message };
        }
        await this.postgres.repos.conversations.updateLastActivity(conversation.conversationId, event.receivedAt);
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
        let messageId = null;
        if (event.externalMessageId) {
            const msg = await this.postgres.repos.messages.findLatestByExternalMessageId({
                tenantId: event.tenantId,
                externalMessageId: event.externalMessageId,
            });
            if (msg) {
                messageId = msg.id;
            }
        }
        if (!messageId) {
            return {
                kind: event.kind,
                status: "not_found",
                externalMessageId: event.externalMessageId ?? null,
            };
        }
        try {
            await this.postgres.repos.deliveries.create({
                tenantId: event.tenantId,
                messageId,
                status: event.deliveryStatus,
                attempt: 1,
                errorCode: event.errorCode ?? null,
                errorMessage: event.errorMessage ?? null,
                providerPayload: event.rawPayload,
            });
        }
        catch (error) {
            return { kind: event.kind, status: "error", error: error.message };
        }
        return {
            kind: event.kind,
            status: "stored",
            messageId,
        };
    }
    async ingestConnectorHealth(event) {
        const tenant = await this.ensureTenant(event.tenantId);
        if (!tenant.ok)
            return tenant;
        if (!event.externalAccountId) {
            return {
                kind: event.kind,
                status: "ignored",
                reason: "missing_external_account_id",
            };
        }
        const client = this.postgres.client;
        try {
            const existing = await client.query(`SELECT id FROM channel_accounts 
         WHERE tenant_id = $1 AND channel = $2 AND external_account_id = $3 
         LIMIT 1`, [event.tenantId, event.channel, event.externalAccountId]);
            if (existing.rows[0]) {
                const id = existing.rows[0].id;
                await client.query(`UPDATE channel_accounts 
           SET status = $1, last_seen_at = $2 
           WHERE id = $3`, [event.status, event.receivedAt, id]);
                return { kind: event.kind, status: "stored", channelAccountId: id };
            }
            else {
                const inserted = await client.query(`INSERT INTO channel_accounts (tenant_id, channel, external_account_id, status, last_seen_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`, [event.tenantId, event.channel, event.externalAccountId, event.status, event.receivedAt]);
                return { kind: event.kind, status: "stored", channelAccountId: inserted.rows[0].id };
            }
        }
        catch (error) {
            return { kind: event.kind, status: "error", error: error.message };
        }
    }
    async ensureTenant(tenantId) {
        try {
            await this.postgres.repos.tenants.ensureExists({
                tenantId,
                name: `tenant-${tenantId.slice(0, 8)}`,
                timezone: "Asia/Ho_Chi_Minh",
                locale: "vi-VN",
            });
            return { ok: true };
        }
        catch (error) {
            return { ok: false, error: error.message };
        }
    }
    async ensureContact(event) {
        try {
            const existing = await this.postgres.repos.contacts.findByExternalUser({
                tenantId: event.tenantId,
                channel: event.channel,
                externalUserId: event.senderExternalId,
            });
            if (existing) {
                return { ok: true, contactId: existing.id };
            }
            const created = await this.postgres.repos.contacts.createShadow({
                tenantId: event.tenantId,
                channel: event.channel,
                externalUserId: event.senderExternalId,
            });
            return { ok: true, contactId: created.id };
        }
        catch (error) {
            return { ok: false, error: error.message };
        }
    }
    async ensureConversation(event, contactId) {
        try {
            const existing = await this.postgres.repos.conversations.findByExternalThread({
                tenantId: event.tenantId,
                channel: event.channel,
                externalThreadId: event.threadId,
            });
            if (existing) {
                return { ok: true, conversationId: existing.id };
            }
            const created = await this.postgres.repos.conversations.create({
                tenantId: event.tenantId,
                channel: event.channel,
                externalThreadId: event.threadId,
                contactId,
                lastActivityAt: event.receivedAt,
            });
            return { ok: true, conversationId: created.id };
        }
        catch (error) {
            return { ok: false, error: error.message };
        }
    }
};
IngestService = __decorate([
    Injectable(),
    __param(0, Inject(PostgresService)),
    __param(1, Inject(QueueService)),
    __metadata("design:paramtypes", [PostgresService,
        QueueService])
], IngestService);
export { IngestService };
