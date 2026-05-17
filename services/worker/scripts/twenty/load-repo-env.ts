import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load repo-root `.env.local` when running worker scripts via `tsx`.
 */
export function loadRepoEnvLocal(): { repoRoot: string; envPath: string } {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "../../../..");
  const envPath = path.join(repoRoot, ".env.local");
  dotenv.config({ path: envPath });
  return { repoRoot, envPath };
}
