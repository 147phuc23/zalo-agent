import { Injectable, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@platform/config";
import { createDatabaseClient, createRepositorySet, runMigrations } from "@platform/database";
import type { DatabaseClient } from "@platform/database";

@Injectable()
export class PostgresService implements OnModuleInit {
  readonly client: DatabaseClient;
  readonly repos: ReturnType<typeof createRepositorySet>;

  constructor() {
    const env = loadApiEnv();
    this.client = createDatabaseClient(env);
    this.repos = createRepositorySet(this.client);
  }

  async onModuleInit() {
    const env = loadApiEnv();
    if (env.DISABLE_DB_MIGRATIONS === "true") {
      console.log("[postgres] DISABLE_DB_MIGRATIONS=true — skipping migrations on boot");
      return;
    }
    await runMigrations(this.client);
  }
}
