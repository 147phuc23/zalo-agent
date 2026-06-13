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
let PromptsService = class PromptsService {
    postgres;
    constructor(postgres) {
        this.postgres = postgres;
    }
    async getActive(tenantId, key) {
        return this.postgres.repos.prompts.findActive({ tenantId, key });
    }
    async saveNewVersion(tenantId, key, content) {
        const versions = await this.postgres.repos.prompts.listVersions({ tenantId, key });
        const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;
        return this.postgres.repos.prompts.create({
            tenantId,
            key,
            content,
            version: nextVersion,
        });
    }
    async listVersions(tenantId, key) {
        return this.postgres.repos.prompts.listVersions({ tenantId, key });
    }
};
PromptsService = __decorate([
    Injectable(),
    __param(0, Inject(PostgresService)),
    __metadata("design:paramtypes", [PostgresService])
], PromptsService);
export { PromptsService };
