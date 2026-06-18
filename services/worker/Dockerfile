FROM node:22-alpine AS base
RUN npm install -g pnpm@10.11.0
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY services/worker/ ./services/worker/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @platform/worker build
RUN pnpm deploy --filter @platform/worker --prod /prod/worker

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /prod/worker/dist ./dist
COPY --from=builder /prod/worker/node_modules ./node_modules
CMD ["node", "dist/main.js"]
