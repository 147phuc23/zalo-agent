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
    // Never run migrations on boot in serverless (Vercel): the migration files
    // aren't deployed, and running DDL on every cold start is wrong. Apply them
    // out-of-band with `pnpm --filter @platform/database migrate`.
    if (env.DISABLE_DB_MIGRATIONS === "true" || process.env.VERCEL) {
      console.log("[postgres] skipping migrations on boot (serverless or DISABLE_DB_MIGRATIONS=true)");
      return;
    }
    await runMigrations(this.client);
  }
}
