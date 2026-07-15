import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller.js";
import { InternalEventsController } from "../routes/internal-events.controller.js";
import { InternalInboxController } from "../routes/internal-inbox.controller.js";
import { InternalOutboundController } from "../routes/internal-outbound.controller.js";
import { InternalPromptsController } from "../routes/internal-prompts.controller.js";
import { InternalDocumentsController } from "../routes/internal-documents.controller.js";
import { PostgresModule } from "./postgres.module.js";
import { QueueModule } from "./queue.module.js";
import { IngestService } from "../services/ingest.service.js";
import { InboxQueryService } from "../services/inbox-query.service.js";
import { PromptsService } from "../services/prompts.service.js";
import { SseService } from "../services/sse.service.js";

@Module({
  imports: [PostgresModule, QueueModule],
  controllers: [
    HealthController,
    InternalEventsController,
    InternalInboxController,
    InternalOutboundController,
    InternalPromptsController,
    InternalDocumentsController,
  ],
  providers: [IngestService, InboxQueryService, PromptsService, SseService],
})
export class AppModule {}
