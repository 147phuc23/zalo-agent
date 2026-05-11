import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import type { NormalizedEvent } from "@platform/shared/contracts";
import { NormalizedEventSchema } from "@platform/shared/schemas";
import { IngestService } from "../services/ingest.service.js";
import { loadApiEnv } from "@platform/config";

const EventsBodySchema = z.object({
  events: z.array(NormalizedEventSchema),
});

@Controller()
export class InternalEventsController {
  constructor(@Inject(IngestService) private readonly ingestService: IngestService) {}

  @Post("/internal/events")
  async ingest(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const env = loadApiEnv();
    const token = parseBearerToken(authorization);
    if (token !== env.INTERNAL_INGEST_TOKEN) {
      throw new UnauthorizedException("unauthorized");
    }

    const parsed = EventsBodySchema.parse(body);
    const result = await this.ingestService.ingestEvents(parsed.events as NormalizedEvent[]);
    return { ok: true, result };
  }
}

function parseBearerToken(value: string | undefined) {
  if (!value) return "";
  const m = /^Bearer (.+)$/.exec(value);
  return m ? m[1] : "";
}
