FROM node:22-alpine AS base
RUN npm install -g pnpm@10.11.0
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/admin/ ./apps/admin/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @platform/admin build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
