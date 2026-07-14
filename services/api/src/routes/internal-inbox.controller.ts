import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Query,
  Post,
  Body,
  UnauthorizedException,
  Sse,
  MessageEvent,
} from "@nestjs/common";
import { z } from "zod";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { loadApiEnv } from "@platform/config";
import { InboxQueryService } from "../services/inbox-query.service.js";
import { PostgresService } from "../services/postgres.service.js";
import { SseService } from "../services/sse.service.js";
import { QueueService } from "../services/queue.service.js";

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

@Controller()
export class InternalInboxController {
  constructor(
    @Inject(InboxQueryService) private readonly inboxQueryService: InboxQueryService,
    @Inject(PostgresService) private readonly postgres: PostgresService,
    @Inject(SseService) private readonly sseService: SseService,
    @Inject(QueueService) private readonly queueService: QueueService,
  ) {}

  @Sse("/internal/sse")
  streamEvents(
    @Headers("authorization") authorization: string | undefined,
  ): Observable<MessageEvent> {
    assertAuthorized(authorization);
    return this.sseService
      .getEventStream()
      .pipe(map((event) => ({ data: event }) as MessageEvent));
  }

  @Get("/internal/conversations")
  async listConversations(
    @Headers("authorization") authorization: string | undefined,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    assertAuthorized(authorization);
    const parsed = ConversationsQuerySchema.parse(query);
    const conversations = await this.inboxQueryService.listConversations({
      tenantId: parsed.tenantId as string,
      limit: parsed.limit as number,
    });
    return { ok: true, conversations };
  }

  @Post("/internal/conversations/new")
  async createConversation(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
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

  @Get("/internal/conversations/:conversationId/audits")
  async listAudits(
    @Headers("authorization") authorization: string | undefined,
    @Param() params: Record<string, string | undefined>,
  ) {
    assertAuthorized(authorization);
    const parsedParams = ConversationParamsSchema.parse(params);
    const audits = await this.postgres.repos.audits.listByConversation(
      parsedParams.conversationId,
    );
    return { ok: true, audits };
  }

  @Post("/internal/conversations/:conversationId/read")
  async markRead(
    @Headers("authorization") authorization: string | undefined,
    @Param() params: Record<string, string | undefined>,
  ) {
    assertAuthorized(authorization);
    const parsedParams = ConversationParamsSchema.parse(params);
    await this.postgres.repos.messages.markAsRead(parsedParams.conversationId);
    return { ok: true, read: true };
  }

  @Post("/internal/conversations/:conversationId/model")
  async updateModel(
    @Headers("authorization") authorization: string | undefined,
    @Param() params: Record<string, string | undefined>,
    @Body() body: unknown,
  ) {
    assertAuthorized(authorization);
    const parsedParams = ConversationParamsSchema.parse(params);
    const parsedBody = UpdateModelSchema.parse(body);
    await this.postgres.repos.conversations.updateOverrideModel(
      parsedParams.conversationId,
      parsedBody.model,
    );
    await this.sseService.publish({
      type: "conversation_updated",
      payload: { conversationId: parsedParams.conversationId },
    });
    return { ok: true, updated: true };
  }

  @Get("/internal/models")
  async listModels(@Headers("authorization") authorization: string | undefined) {
    assertAuthorized(authorization);
    const models = [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "tencent/hy3:free", name: "OpenRouter Owl Alpha (Default)" },
    ];
    return { ok: true, models };
  }

  @Post("/internal/conversations/:conversationId/messages/:messageId/ai-react")
  async aiReact(
    @Headers("authorization") authorization: string | undefined,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @Body() body: any,
  ) {
    assertAuthorized(authorization);
    const conversation = await this.postgres.repos.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    const idempotencyKey = `ai-react:${conversationId}:${messageId}:${Date.now()}`;
    await this.queueService.enqueueMessageReceived({
      tenantId: conversation.tenant_id,
      conversationId,
      idempotencyKey,
      action: "ai-react",
      targetMessageId: messageId,
      reaction: body?.reaction,
    });
    return { ok: true, enqueued: true };
  }

  @Post("/internal/conversations/:conversationId/messages/:messageId/ai-reply")
  async aiReply(
    @Headers("authorization") authorization: string | undefined,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
  ) {
    assertAuthorized(authorization);
    const conversation = await this.postgres.repos.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    const idempotencyKey = `ai-reply:${conversationId}:${messageId}:${Date.now()}`;
    await this.queueService.enqueueMessageReceived({
      tenantId: conversation.tenant_id,
      conversationId,
      idempotencyKey,
      action: "ai-reply",
      targetMessageId: messageId,
    });
    return { ok: true, enqueued: true };
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
