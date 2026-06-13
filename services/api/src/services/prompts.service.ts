import { Inject, Injectable } from "@nestjs/common";
import { PostgresService } from "./postgres.service.js";

@Injectable()
export class PromptsService {
  constructor(@Inject(PostgresService) private readonly postgres: PostgresService) {}

  async getActive(tenantId: string, key: string) {
    return this.postgres.repos.prompts.findActive({ tenantId, key });
  }

  async saveNewVersion(tenantId: string, key: string, content: string) {
    const versions = await this.postgres.repos.prompts.listVersions({ tenantId, key });
    const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;
    return this.postgres.repos.prompts.create({
      tenantId,
      key,
      content,
      version: nextVersion,
    });
  }

  async listVersions(tenantId: string, key: string) {
    return this.postgres.repos.prompts.listVersions({ tenantId, key });
  }
}
