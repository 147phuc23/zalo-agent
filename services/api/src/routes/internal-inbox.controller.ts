import { Controller, Get, Headers, Inject, Param, Query, UnauthorizedException } from "@nestjs/common";
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

@Controller()
export class InternalInboxController {
  constructor(
    @Inject(InboxQueryService) private readonly inboxQueryService: InboxQueryService,
  ) {}

  @Get("/internal/conversations")
  async listConversations(
    @Headers("authorization") authorization: string | undefined,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    assertAuthorized(authorization);
    const parsed = ConversationsQuerySchema.parse(query);
    const conversations = await this.inboxQueryService.listConversations(parsed);
    return { ok: true, conversations };
  }

  @Get("/internal/conversations/:conversationId/messages")
  async listMessages(
    @Headers("authorization") authorization: string | undefined,
    @Param() params: Record<string, string | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    assertAuthorized(authorization);
    const parsedParams = ConversationParamsSchema.parse(params);
    const parsedQuery = MessagesQuerySchema.parse(query);
    const messages = await this.inboxQueryService.listMessages({
      conversationId: parsedParams.conversationId,
      limit: parsedQuery.limit,
    });
    return { ok: true, messages };
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
