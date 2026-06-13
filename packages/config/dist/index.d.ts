import { z } from "zod";
declare const ApiSchema: z.ZodObject<{
    NODE_ENV: z.ZodOptional<z.ZodString>;
    PLATFORM_DB_URL: z.ZodString;
    REDIS_URL: z.ZodDefault<z.ZodString>;
    OPENROUTER_API_KEY: z.ZodOptional<z.ZodString>;
} & {
    APP_PORT: z.ZodDefault<z.ZodNumber>;
    INTERNAL_INGEST_TOKEN: z.ZodString;
}, "strip", z.ZodTypeAny, {
    PLATFORM_DB_URL: string;
    REDIS_URL: string;
    APP_PORT: number;
    INTERNAL_INGEST_TOKEN: string;
    NODE_ENV?: string | undefined;
    OPENROUTER_API_KEY?: string | undefined;
}, {
    PLATFORM_DB_URL: string;
    INTERNAL_INGEST_TOKEN: string;
    NODE_ENV?: string | undefined;
    REDIS_URL?: string | undefined;
    OPENROUTER_API_KEY?: string | undefined;
    APP_PORT?: number | undefined;
}>;
declare const WorkerSchema: z.ZodObject<{
    NODE_ENV: z.ZodOptional<z.ZodString>;
    PLATFORM_DB_URL: z.ZodString;
    REDIS_URL: z.ZodDefault<z.ZodString>;
    OPENROUTER_API_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    PLATFORM_DB_URL: string;
    REDIS_URL: string;
    NODE_ENV?: string | undefined;
    OPENROUTER_API_KEY?: string | undefined;
}, {
    PLATFORM_DB_URL: string;
    NODE_ENV?: string | undefined;
    REDIS_URL?: string | undefined;
    OPENROUTER_API_KEY?: string | undefined;
}>;
export type ApiEnv = z.infer<typeof ApiSchema>;
export type WorkerEnv = z.infer<typeof WorkerSchema>;
export declare function loadApiEnv(input?: NodeJS.ProcessEnv): ApiEnv;
export declare function loadWorkerEnv(input?: NodeJS.ProcessEnv): WorkerEnv;
export {};
