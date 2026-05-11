import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";
import { loadApiEnv } from "@platform/config";
async function bootstrap() {
    const env = loadApiEnv();
    const app = await NestFactory.create(AppModule, {
        logger: ["log", "error", "warn"],
    });
    await app.listen(env.APP_PORT);
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${env.APP_PORT}`);
}
bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[api] fatal", err);
    process.exitCode = 1;
});
