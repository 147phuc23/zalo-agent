import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

// Resolve the migrations directory lazily, inside the function — computing it at
// module top-level breaks when this file is bundled to CJS (import.meta.url is empty),
// even if migrations are disabled. MIGRATIONS_DIR env var overrides the default.
function resolveMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../migrations");
}

export async function runMigrations(pool: pg.Pool) {
  const MIGRATIONS_DIR = resolveMigrationsDir();
  console.log(`[migrator] running migrations from ${MIGRATIONS_DIR}...`);

  // Ensure migrations metadata table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id serial PRIMARY KEY,
      name text UNIQUE NOT null,
      applied_at timestamptz DEFAULT now() NOT null
    );
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      "SELECT id FROM public._migrations WHERE name = $1",
      [file]
    );

    if (rows.length > 0) {
      // Already applied
      continue;
    }

    console.log(`[migrator] applying migration: ${file}`);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlContent = fs.readFileSync(filePath, "utf8");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sqlContent);
      await client.query(
        "INSERT INTO public._migrations (name) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      console.log(`[migrator] applied successfully: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`[migrator] failed applying ${file}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("[migrator] all migrations are up to date.");
}
