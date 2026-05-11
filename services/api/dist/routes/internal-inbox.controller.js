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
import { Controller, Get, Headers, Param, Query, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { loadApiEnv } from "@platform/config";
import { InboxQueryService } from "../services/inbox-query.service.js";
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
let InternalInboxController = class InternalInboxController {
    inboxQueryService;
    constructor(inboxQueryService) {
        this.inboxQueryService = inboxQueryService;
    }
    async listConversations(authorization, query) {
        assertAuthorized(authorization);
        const parsed = ConversationsQuerySchema.parse(query);
        const conversations = await this.inboxQueryService.listConversations(parsed);
        return { ok: true, conversations };
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
};
__decorate([
    Get("/internal/conversations"),
    __param(0, Headers("authorization")),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "listConversations", null);
__decorate([
    Get("/internal/conversations/:conversationId/messages"),
    __param(0, Headers("authorization")),
    __param(1, Param()),
    __param(2, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InternalInboxController.prototype, "listMessages", null);
InternalInboxController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [InboxQueryService])
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
