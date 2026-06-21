// Vercel serverless entry point. Delegates to the esbuild-bundled NestJS app
// (services/api/dist/serverless.cjs), built by `pnpm --filter @platform/api build:vercel`.
// @ts-expect-error - the bundle is produced at build time and has no type declarations.
import handler from "../services/api/dist/serverless.mjs";

export default handler;
