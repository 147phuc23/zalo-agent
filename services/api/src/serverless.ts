import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AppModule } from "./modules/app.module.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter.js";

let cachedInstance: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let bootstrapPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

export async function bootstrapServer() {
  if (cachedInstance) return cachedInstance;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
    app.use(requestIdMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidUnknownValues: false }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    // platform-express: the underlying instance is a callable (req, res) handler
    const instance = app.getHttpAdapter().getInstance() as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => void;
    cachedInstance = instance;
    return instance;
  })();

  return bootstrapPromise;
}

// Vercel Node serverless handler — forwards the request into the NestJS/Express app.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const instance = await bootstrapServer();
  instance(req, res);
}
