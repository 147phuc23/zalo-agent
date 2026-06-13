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
import { NormalizedEventSchema } from "@platform/shared/schemas";
import { IngestService } from "../services/ingest.service.js";
import { loadApiEnv } from "@platform/config";
const EventsBodySchema = z.object({
    events: z.array(NormalizedEventSchema),
});
let InternalEventsController = class InternalEventsController {
    ingestService;
    constructor(ingestService) {
        this.ingestService = ingestService;
    }
    async ingest(authorization, body) {
        const env = loadApiEnv();
        const token = parseBearerToken(authorization);
        if (token !== env.INTERNAL_INGEST_TOKEN) {
            throw new UnauthorizedException("unauthorized");
        }
        const parsed = EventsBodySchema.parse(body);
        const result = await this.ingestService.ingestEvents(parsed.events);
        return { ok: true, result };
    }
};
__decorate([
    Post("/internal/events"),
    __param(0, Headers("authorization")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InternalEventsController.prototype, "ingest", null);
InternalEventsController = __decorate([
    Controller(),
    __param(0, Inject(IngestService)),
    __metadata("design:paramtypes", [IngestService])
], InternalEventsController);
export { InternalEventsController };
function parseBearerToken(value) {
    if (!value)
        return "";
    const m = /^Bearer (.+)$/.exec(value);
    return m ? m[1] : "";
}
