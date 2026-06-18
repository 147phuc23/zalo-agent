import "reflect-metadata";
import dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

dotenv.config();

let cachedApp: any;

async function bootstrap() {
  if (!cachedApp) {
    // Import from compiled dist — built by pnpm --filter @platform/api build
    const { AppModule } = await import("../services/api/dist/modules/app.module.js");
    const { requestIdMiddleware } = await import("../services/api/dist/middleware/request-id.middleware.js");
    const { AllExceptionsFilter } = await import("../services/api/dist/filters/all-exceptions.filter.js");

    cachedApp = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
    cachedApp.use(requestIdMiddleware);
    cachedApp.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidUnknownValues: false }),
    );
    cachedApp.useGlobalFilters(new AllExceptionsFilter());
    await cachedApp.init();
  }
  return cachedApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await bootstrap();
  app.getHttpServer().emit("request", req, res);
}
