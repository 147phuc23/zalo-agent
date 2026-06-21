import { Inject, Injectable } from "@nestjs/common";
import { PostgresService } from "./postgres.service.js";
import { getActivePrompt, saveNewPromptVersion, listPromptVersions } from "@platform/core";

@Injectable()
export class PromptsService {
  constructor(@Inject(PostgresService) private readonly postgres: PostgresService) {}

  async getActive(tenantId: string, key: string) {
    return getActivePrompt(this.postgres.repos, tenantId, key);
  }

  async saveNewVersion(tenantId: string, key: string, content: string) {
    return saveNewPromptVersion(this.postgres.repos, tenantId, key, content);
  }

  async listVersions(tenantId: string, key: string) {
    return listPromptVersions(this.postgres.repos, tenantId, key);
  }
}
