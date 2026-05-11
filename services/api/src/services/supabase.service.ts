import { Injectable } from "@nestjs/common";
import { loadApiEnv } from "@platform/config";
import { createDatabaseClient } from "@platform/database";
import type { DatabaseClient } from "@platform/database/repositories";

@Injectable()
export class SupabaseService {
  readonly client: DatabaseClient;

  constructor() {
    this.client = createDatabaseClient(loadApiEnv());
  }
}
