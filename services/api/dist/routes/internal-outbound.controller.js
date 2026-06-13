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
import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { loadApiEnv } from "@platform/config";
import { OutboundMessageSchema } from "@platform/shared/schemas";
import { QueueService } from "../services/queue.service.js";
const OutboundSendSchema = OutboundMessageSchema.extend({
    idempotencyKey: z.string().min(1).optional(),
});
let InternalOutboundController = class InternalOutboundController {
    queueService;
    constructor(queueService) {
        this.queueService = queueService;
    }
    async enqueueOutbound(authorization, body) {
        assertAuthorized(authorization);
        const parsed = OutboundSendSchema.parse(body);
        await this.queueService.enqueueMessageSend(parsed);
        return { ok: true, enqueued: true };
    }
};
__decorate([
    Post("/internal/outbound/send"),
    __param(0, Headers("authorization")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalOutboundController.prototype, "enqueueOutbound", null);
InternalOutboundController = __decorate([
    Controller(),
    __param(0, Inject(QueueService)),
    __metadata("design:paramtypes", [QueueService])
], InternalOutboundController);
export { InternalOutboundController };
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
