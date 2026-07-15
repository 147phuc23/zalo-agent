import { Body, Controller, Headers, Inject, Post, UnauthorizedException, HttpCode } from "@nestjs/common";
import { z } from "zod";
import { QueueService } from "../services/queue.service.js";
import { loadApiEnv } from "@platform/config";

const ProcessBodySchema = z.object({
  tenantId: z.string().uuid(),
  documentId: z.string().uuid(),
});

@Controller()
export class InternalDocumentsController {
  constructor(@Inject(QueueService) private readonly queueService: QueueService) {}

  @Post("/internal/documents/process")
  @HttpCode(202)
  async process(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const env = loadApiEnv();
    const token = parseBearerToken(authorization);
    if (token !== env.INTERNAL_INGEST_TOKEN) {
      throw new UnauthorizedException("unauthorized");
    }

    const parsed = ProcessBodySchema.parse(body);
    await this.queueService.enqueueDocumentProcess({
      tenantId: parsed.tenantId,
      documentId: parsed.documentId,
    });
    return { ok: true };
  }
}

function parseBearerToken(value: string | undefined) {
  if (!value) return "";
  const m = /^Bearer (.+)$/.exec(value);
  return m ? m[1] : "";
}
