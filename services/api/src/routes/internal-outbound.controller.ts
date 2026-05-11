import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { loadApiEnv } from "@platform/config";
import { OutboundMessageSchema } from "@platform/shared/schemas";
import { QueueService } from "../services/queue.service.js";

const OutboundSendSchema = OutboundMessageSchema.extend({
  idempotencyKey: z.string().min(1).optional(),
});

@Controller()
export class InternalOutboundController {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  @Post("/internal/outbound/send")
  async enqueueOutbound(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    assertAuthorized(authorization);
    const parsed = OutboundSendSchema.parse(body);
    await this.queueService.enqueueMessageSend(parsed);
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
