import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

export async function runMigrations(pool: pg.Pool) {
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
