import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseClient, runMigrations } from "./index.js";

// Load .env.local from repo root so this works the same as the dev servers.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

async function main() {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    console.error("[migrate] PLATFORM_DB_URL is not set");
    process.exit(1);
  }
  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  await runMigrations(client);
  await client.end();
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
