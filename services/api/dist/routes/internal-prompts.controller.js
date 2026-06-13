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
import { Body, Controller, Get, Headers, Inject, Post, Query, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { loadApiEnv } from "@platform/config";
import { PromptsService } from "../services/prompts.service.js";
const PromptsQuerySchema = z.object({
    tenantId: z.string().uuid(),
    key: z.string().min(1),
    listAll: z.string().optional(),
});
const SavePromptSchema = z.object({
    tenantId: z.string().uuid(),
    key: z.string().min(1),
    content: z.string().min(1),
});
let InternalPromptsController = class InternalPromptsController {
    promptsService;
    constructor(promptsService) {
        this.promptsService = promptsService;
    }
    async getPrompts(authorization, query) {
        assertAuthorized(authorization);
        const parsed = PromptsQuerySchema.parse(query);
        if (parsed.listAll === "true") {
            const versions = await this.promptsService.listVersions(parsed.tenantId, parsed.key);
            return { ok: true, versions };
        }
        const active = await this.promptsService.getActive(parsed.tenantId, parsed.key);
        return { ok: true, active };
    }
    async savePrompt(authorization, body) {
        assertAuthorized(authorization);
        const parsed = SavePromptSchema.parse(body);
        const saved = await this.promptsService.saveNewVersion(parsed.tenantId, parsed.key, parsed.content);
        return { ok: true, saved };
    }
};
__decorate([
    Get("/internal/prompts"),
    __param(0, Headers("authorization")),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalPromptsController.prototype, "getPrompts", null);
__decorate([
    Post("/internal/prompts"),
    __param(0, Headers("authorization")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalPromptsController.prototype, "savePrompt", null);
InternalPromptsController = __decorate([
    Controller(),
    __param(0, Inject(PromptsService)),
    __metadata("design:paramtypes", [PromptsService])
], InternalPromptsController);
export { InternalPromptsController };
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
