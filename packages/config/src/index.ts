import { z } from "zod";

const SharedSchema = z.object({
  NODE_ENV: z.string().optional(),
  PLATFORM_DB_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:7379"),
  OPENROUTER_API_KEY: z.string().min(20).optional(),
});

const ApiSchema = SharedSchema.extend({
  APP_PORT: z.coerce.number().int().positive().default(7010),
  INTERNAL_INGEST_TOKEN: z.string().min(16),
});

const WorkerSchema = SharedSchema;

export type ApiEnv = z.infer<typeof ApiSchema>;
export type WorkerEnv = z.infer<typeof WorkerSchema>;

export function loadApiEnv(input: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = ApiSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid API environment: ${parsed.error.message}`);
  return parsed.data;
}

export function loadWorkerEnv(input: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = WorkerSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid worker environment: ${parsed.error.message}`);
  return parsed.data;
}
