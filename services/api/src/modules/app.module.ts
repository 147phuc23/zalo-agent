import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller.js";
import { InternalEventsController } from "../routes/internal-events.controller.js";
import { InternalInboxController } from "../routes/internal-inbox.controller.js";
import { InternalOutboundController } from "../routes/internal-outbound.controller.js";
import { SupabaseModule } from "./supabase.module.js";
import { QueueModule } from "./queue.module.js";
import { IngestService } from "../services/ingest.service.js";
import { InboxQueryService } from "../services/inbox-query.service.js";

@Module({
  imports: [SupabaseModule, QueueModule],
  controllers: [HealthController, InternalEventsController, InternalInboxController, InternalOutboundController],
  providers: [IngestService, InboxQueryService],
})
export class AppModule {}
