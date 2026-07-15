import { z } from "zod";

const SharedSchema = z.object({
  NODE_ENV: z.string().optional(),
  PLATFORM_DB_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().min(20).optional(),
  // Set to "true" to skip auto-running migrations on boot (e.g. serverless/Vercel,
  // where migrations are applied separately via `pnpm db:migrate`).
  DISABLE_DB_MIGRATIONS: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  LOCAL_UPLOAD_DIR: z.string().optional(),
});

const ApiSchema = SharedSchema.extend({
  APP_PORT: z.coerce.number().int().positive().default(7010),
  INTERNAL_INGEST_TOKEN: z.string().min(16),
});

const WorkerSchema = SharedSchema;

export interface ApiEnv {
  NODE_ENV?: string;
  PLATFORM_DB_URL: string;
  REDIS_URL?: string;
  OPENROUTER_API_KEY?: string;
  DISABLE_DB_MIGRATIONS?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  LOCAL_UPLOAD_DIR?: string;
  APP_PORT: number;
  INTERNAL_INGEST_TOKEN: string;
}

export interface WorkerEnv {
  NODE_ENV?: string;
  PLATFORM_DB_URL: string;
  REDIS_URL?: string;
  OPENROUTER_API_KEY?: string;
  DISABLE_DB_MIGRATIONS?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  LOCAL_UPLOAD_DIR?: string;
}

export function loadApiEnv(input: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = ApiSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid API environment: ${parsed.error.message}`);
  return parsed.data as unknown as ApiEnv;
}

export function loadWorkerEnv(input: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = WorkerSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid worker environment: ${parsed.error.message}`);
  return parsed.data as unknown as WorkerEnv;
}
