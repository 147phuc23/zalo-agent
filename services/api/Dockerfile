FROM node:22-alpine AS base
RUN npm install -g pnpm@10.11.0
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY services/api/ ./services/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @platform/api build
RUN pnpm deploy --filter @platform/api --prod /prod/api

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /prod/api/dist ./dist
COPY --from=builder /prod/api/node_modules ./node_modules
EXPOSE 7010
CMD ["node", "dist/main.js"]
