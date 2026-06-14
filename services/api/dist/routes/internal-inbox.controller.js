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
import { Controller, Get, Headers, Inject, Param, Query, Post, Body, UnauthorizedException, Sse } from "@nestjs/common";
import { z } from "zod";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { loadApiEnv } from "@platform/config";
import { InboxQueryService } from "../services/inbox-query.service.js";
import { PostgresService } from "../services/postgres.service.js";
import { SseService } from "../services/sse.service.js";
const ConversationsQuerySchema = z.object({
    tenantId: z.string().uuid(),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
const MessagesQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(200).default(50),
});
const ConversationParamsSchema = z.object({
    conversationId: z.string().uuid(),
});
const UpdateModelSchema = z.object({
    model: z.string().nullable(),
});
const CreateConversationSchema = z.object({
    tenantId: z.string().uuid(),
    channel: z.string().min(1),
    externalThreadId: z.string().min(1),
    externalUserId: z.string().min(1),
    displayName: z.string().nullable().optional(),
});
let InternalInboxController = class InternalInboxController {
    inboxQueryService;
    postgres;
    sseService;
    constructor(inboxQueryService, postgres, sseService) {
        this.inboxQueryService = inboxQueryService;
        this.postgres = postgres;
        this.sseService = sseService;
    }
    streamEvents(authorization) {
        assertAuthorized(authorization);
        return this.sseService.getEventStream().pipe(map((event) => ({ data: event })));
    }
    async listConversations(authorization, query) {
        assertAuthorized(authorization);
        const parsed = ConversationsQuerySchema.parse(query);
        const conversations = await this.inboxQueryService.listConversations(parsed);
        return { ok: true, conversations };
    }
    async createConversation(authorization, body) {
        assertAuthorized(authorization);
        const parsed = CreateConversationSchema.parse(body);
        // Ensure tenant exists
        await this.postgres.repos.tenants.ensureExists({
            tenantId: parsed.tenantId,
            name: `tenant-${parsed.tenantId.slice(0, 8)}`,
            timezone: "Asia/Ho_Chi_Minh",
            locale: "vi-VN",
        });
        // Find or create contact
        let contact = await this.postgres.repos.contacts.findByExternalUser({
            tenantId: parsed.tenantId,
            channel: parsed.channel,
            externalUserId: parsed.externalUserId,
        });
        if (!contact) {
            contact = await this.postgres.repos.contacts.createShadow({
                tenantId: parsed.tenantId,
                channel: parsed.channel,
                externalUserId: parsed.externalUserId,
                displayName: parsed.displayName ?? null,
            });
        }
        // Find or create conversation
        let conversation = await this.postgres.repos.conversations.findByExternalThread({
            tenantId: parsed.tenantId,
            channel: parsed.channel,
            externalThreadId: parsed.externalThreadId,
        });
        if (!conversation) {
            conversation = await this.postgres.repos.conversations.create({
                tenantId: parsed.tenantId,
                channel: parsed.channel,
                externalThreadId: parsed.externalThreadId,
                contactId: contact.id,
            });
        }
        await this.sseService.publish({
            type: "conversation_updated",
            payload: { conversationId: conversation.id },
        });
        return { ok: true, conversationId: conversation.id };
    }
    async listMessages(authorization, params, query) {
        assertAuthorized(authorization);
        const parsedParams = ConversationParamsSchema.parse(params);
        const parsedQuery = MessagesQuerySchema.parse(query);
        const messages = await this.inboxQueryService.listMessages({
            conversationId: parsedParams.conversationId,
            limit: parsedQuery.limit,
        });
        return { ok: true, messages };
    }
    async listAudits(authorization, params) {
        assertAuthorized(authorization);
        const parsedParams = ConversationParamsSchema.parse(params);
        const audits = await this.postgres.repos.audits.listByConversation(parsedParams.conversationId);
        return { ok: true, audits };
    }
    async markRead(authorization, params) {
        assertAuthorized(authorization);
        const parsedParams = ConversationParamsSchema.parse(params);
        await this.postgres.repos.messages.markAsRead(parsedParams.conversationId);
        return { ok: true, read: true };
    }
    async updateModel(authorization, params, body) {
        assertAuthorized(authorization);
        const parsedParams = ConversationParamsSchema.parse(params);
        const parsedBody = UpdateModelSchema.parse(body);
        await this.postgres.repos.conversations.updateOverrideModel(parsedParams.conversationId, parsedBody.model);
        await this.sseService.publish({
            type: "conversation_updated",
            payload: { conversationId: parsedParams.conversationId },
        });
        return { ok: true, updated: true };
    }
    async listModels(authorization) {
        assertAuthorized(authorization);
        const models = [
            { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
            { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
            { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
            { id: "openrouter/owl-alpha", name: "OpenRouter Owl Alpha (Default)" }
        ];
        return { ok: true, models };
    }
};
__decorate([
    Sse("/internal/sse"),
    __param(0, Headers("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Observable)
], InternalInboxController.prototype, "streamEvents", null);
__decorate([
    Get("/internal/conversations"),
    __param(0, Headers("authorization")),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "listConversations", null);
__decorate([
    Post("/internal/conversations/new"),
    __param(0, Headers("authorization")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "createConversation", null);
__decorate([
    Get("/internal/conversations/:conversationId/messages"),
    __param(0, Headers("authorization")),
    __param(1, Param()),
    __param(2, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "listMessages", null);
__decorate([
    Get("/internal/conversations/:conversationId/audits"),
    __param(0, Headers("authorization")),
    __param(1, Param()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "listAudits", null);
__decorate([
    Post("/internal/conversations/:conversationId/read"),
    __param(0, Headers("authorization")),
    __param(1, Param()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "markRead", null);
__decorate([
    Post("/internal/conversations/:conversationId/model"),
    __param(0, Headers("authorization")),
    __param(1, Param()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "updateModel", null);
__decorate([
    Get("/internal/models"),
    __param(0, Headers("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "listModels", null);
InternalInboxController = __decorate([
    Controller(),
    __param(0, Inject(InboxQueryService)),
    __param(1, Inject(PostgresService)),
    __param(2, Inject(SseService)),
    __metadata("design:paramtypes", [InboxQueryService,
        PostgresService,
        SseService])
], InternalInboxController);
export { InternalInboxController };
function assertAuthorized(value) {
    const env = loadApiEnv();
    const token = parseBearerToken(value);
    if (token !== env.INTERNAL_INGEST_TOKEN) {
        throw new UnauthorizedException("unauthorized");
    }
}
function parseBearerToken(value) {
    if (!value)
        return "";
    const match = /^Bearer (.+)$/.exec(value);
    return match ? match[1] : "";
}
