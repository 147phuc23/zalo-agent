import { createDatabaseClient, createRepositorySet } from "@platform/database";

// Cache the pool on globalThis so warm invocations reuse one connection.
const g = globalThis as unknown as { _repos?: ReturnType<typeof createRepositorySet> };

export function getRepos() {
  if (!process.env.TENANT_ID) {
    process.env.TENANT_ID = "b545a6ca-eabe-4bb8-852d-2c497edb8e38";
  }
  if (!g._repos) {
    const url = process.env.PLATFORM_DB_URL;
    if (!url) throw new Error("PLATFORM_DB_URL is not set");
    g._repos = createRepositorySet(createDatabaseClient({ PLATFORM_DB_URL: url }));
  }
  return g._repos;
}
