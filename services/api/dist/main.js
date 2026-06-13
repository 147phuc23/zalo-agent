import dotenv from "dotenv";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./modules/app.module.js";
import { loadApiEnv } from "@platform/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter.js";
async function bootstrap() {
    loadRepoEnv();
    const env = loadApiEnv();
    const app = await NestFactory.create(AppModule, {
        logger: ["log", "error", "warn"],
    });
    app.use(requestIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: false,
    }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(env.APP_PORT);
    console.log(`[api] listening on http://localhost:${env.APP_PORT}`);
}
bootstrap().catch((err) => {
    console.error("[api] fatal", err);
    process.exitCode = 1;
});
function loadRepoEnv() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, "../../..");
    dotenv.config({ path: path.join(repoRoot, ".env.local") });
}
