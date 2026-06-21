import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AppModule } from "./modules/app.module.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter.js";

// Logged once per cold start, at module load — confirms the bundle was loaded at all.
console.log("[serverless] bundle loaded; node:", process.version, "env keys:", {
  PLATFORM_DB_URL: Boolean(process.env.PLATFORM_DB_URL),
  INTERNAL_INGEST_TOKEN: Boolean(process.env.INTERNAL_INGEST_TOKEN),
  REDIS_URL: Boolean(process.env.REDIS_URL),
  DISABLE_DB_MIGRATIONS: process.env.DISABLE_DB_MIGRATIONS ?? "(unset)",
});

let cachedInstance: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let bootstrapPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

export async function bootstrapServer() {
  if (cachedInstance) return cachedInstance;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    console.log("[serverless] bootstrap: creating Nest app…");
    const app = await NestFactory.create(AppModule, {
      // Full logger so Nest's own boot errors (DI, module init) reach Vercel logs.
      logger: ["error", "warn", "log"],
    });
    console.log("[serverless] bootstrap: Nest app created, configuring…");
    app.use(requestIdMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidUnknownValues: false }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    console.log("[serverless] bootstrap: calling app.init()…");
    await app.init();
    console.log("[serverless] bootstrap: app.init() done");
    // platform-express: the underlying instance is a callable (req, res) handler
    const instance = app.getHttpAdapter().getInstance() as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => void;
    cachedInstance = instance;
    console.log("[serverless] bootstrap: ready");
    return instance;
  })();

  // If bootstrap fails, clear the promise so the next request retries instead of
  // being stuck on a rejected promise for the lifetime of the warm instance.
  bootstrapPromise.catch(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

// Vercel Node serverless handler — forwards the request into the NestJS/Express app.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  console.log(`[serverless] → ${req.method} ${req.url}`);
  try {
    const instance = await bootstrapServer();
    instance(req, res);
  } catch (err) {
    console.error("[serverless] bootstrap failed:", err instanceof Error ? err.stack : err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stage: "bootstrap",
      }),
    );
  }
}
