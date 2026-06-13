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

@Controller()
export class InternalPromptsController {
  constructor(@Inject(PromptsService) private readonly promptsService: PromptsService) {}

  @Get("/internal/prompts")
  async getPrompts(
    @Headers("authorization") authorization: string | undefined,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    assertAuthorized(authorization);
    const parsed = PromptsQuerySchema.parse(query);
    if (parsed.listAll === "true") {
      const versions = await this.promptsService.listVersions(parsed.tenantId, parsed.key);
      return { ok: true, versions };
    }
    const active = await this.promptsService.getActive(parsed.tenantId, parsed.key);
    return { ok: true, active };
  }

  @Post("/internal/prompts")
  async savePrompt(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    assertAuthorized(authorization);
    const parsed = SavePromptSchema.parse(body);
    const saved = await this.promptsService.saveNewVersion(parsed.tenantId, parsed.key, parsed.content);
    return { ok: true, saved };
  }
}

function assertAuthorized(value: string | undefined) {
  const env = loadApiEnv();
  const token = parseBearerToken(value);
  if (token !== env.INTERNAL_INGEST_TOKEN) {
    throw new UnauthorizedException("unauthorized");
  }
}

function parseBearerToken(value: string | undefined) {
  if (!value) return "";
  const match = /^Bearer (.+)$/.exec(value);
  return match ? match[1] : "";
}
