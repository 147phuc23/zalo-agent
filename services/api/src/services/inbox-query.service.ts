import { Inject, Injectable } from "@nestjs/common";
import { PostgresService } from "./postgres.service.js";
import { listConversations, listMessages } from "@platform/core";

@Injectable()
export class InboxQueryService {
  constructor(@Inject(PostgresService) private readonly postgres: PostgresService) {}

  async listConversations(input: { tenantId: string; limit: number }) {
    return listConversations(this.postgres.repos, input);
  }

  async listMessages(input: { conversationId: string; limit: number }) {
    return listMessages(this.postgres.repos, input);
  }
}
