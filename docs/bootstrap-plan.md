# Zalo x Twenty Build Plan

## Goal

Build a single TypeScript monorepo that can:

1. receive inbound messages from Zalo through an isolated connector,
2. process messages through our own API and worker stack,
3. store platform state in our own database,
4. support real-estate and HR recruiting workflows through shared platform contracts,
5. sync operator-facing CRM records into Twenty,
6. keep enough separation to split services later without rewriting core contracts.

## Supported Verticals

This platform is intended for:

- real-estate teams handling buyer, renter, seller, landlord, and agent conversations,
- HR recruiting teams handling candidate, client-firm, recruiter, and hiring-manager conversations.

Shared platform capabilities should be reused across both verticals. Vertical-specific data models, workflow rules, and CRM mappings should stay configurable instead of being hardcoded as one-off logic.

## Product Boundaries

### Our Platform Owns

- tenant configuration,
- Zalo sessions and channel health,
- raw inbound and outbound messages,
- conversation state,
- AI runs and tool calls,
- audit logs,
- workflow rules,
- knowledge chunks and embeddings,
- approval state and inbox state.

### Twenty Owns

- people and organizations,
- opportunities, tasks, and notes,
- operator-facing pipeline views,
- custom fields or custom objects needed for real-estate and recruiting context.

### Connector Boundary

`zca-js` stays behind a disposable interface. No business logic should depend directly on `zca-js` types.

```ts
interface ChannelConnector {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(input: OutboundMessage): Promise<SendResult>;
  getContactProfile(channelUserId: string): Promise<ContactProfile>;
}
```

## Recommended Stack

### Monorepo

- Package manager: `pnpm`
- Task runner: `turborepo`
- Runtime target: `Node.js 22`
- Language: `TypeScript`

### Applications

- `apps/admin`: `Next.js` app router, `TypeScript`, `Tailwind CSS`, `shadcn/ui`
- `services/api`: `NestJS` for module boundaries, validation, and DI
- `services/worker`: `NestJS` or plain `BullMQ` worker process
- `services/zalo-connector`: lightweight `Node.js` service with minimal framework

### Data and Infra

- Main relational DB: `Supabase` local stack on top of local `Postgres`
- Realtime or auth: optional later through Supabase, not required for phase 1
- Queue: `Redis` + `BullMQ`
- Vector search: `pgvector` in Postgres
- Object storage: Supabase storage later or local S3-compatible storage later

### CRM and AI

- CRM: self-hosted `Twenty`
- LLM provider abstraction: OpenRouter first, model provider wrapped behind adapter
- JS AI client: `ai` + `@ai-sdk/openai-compatible`
- Embeddings: OpenRouter-compatible model or local provider later

### Observability

- Structured logs: `pino`
- Error tracking: `Sentry`
- Tracing: `OpenTelemetry`
- Metrics later: `Prometheus` + `Grafana`

### Dev Tooling

- Lint: `eslint`
- Format: `prettier`
- Tests: `vitest`
- API contract validation: `zod`
- DB migrations: `Supabase CLI` SQL migrations

## Code Conventions

### General

- Use `TypeScript` for all new services and packages.
- Use ESM modules consistently.
- Prefer small modules with explicit imports over large utility files.
- Keep business logic out of controllers, transport handlers, and SDK adapters.
- Never let `zca-js` types leak outside `services/zalo-connector`.
- Never let Twenty SDK or REST response shapes leak outside the CRM adapter.

### Naming

- Files: `kebab-case`
- Types and classes: `PascalCase`
- Variables and functions: `camelCase`
- Env vars: `UPPER_SNAKE_CASE`
- Queue names and event names: dot-separated lowercase, such as `message.received`

### Package Design

- `packages/shared`: pure shared contracts, schemas, enums, and helpers
- `packages/config`: env loading and validation
- `packages/database`: generated DB types, repository helpers, SQL helpers
- `packages/testing`: test factories and mocks
- `packages/mcp`: MCP tool definitions and shared adapters later

### Service Design

- Controllers only validate and delegate.
- Repositories only read and write persistence models.
- Use cases contain workflow logic.
- Adapters integrate with external systems.
- Queue consumers call use cases, not repositories directly when business logic exists.

### Error Handling

- Throw typed domain errors for business cases.
- Log external request failures with request IDs and tenant IDs.
- Never swallow connector or CRM errors silently.
- Redact cookies, tokens, and session secrets from logs.

### Testing

- Unit-test pure use cases and mappers.
- Integration-test repositories, queue jobs, and external adapters with mocks.
- Add one end-to-end happy-path test for each major runtime slice.

## Repo Layout Target

```text
apps/
  admin/
services/
  api/
  worker/
  zalo-connector/
packages/
  shared/
  config/
  database/
  testing/
  mcp/
infra/
  supabase/
  docker/
docs/
```

## Local Development Environment

### Baseline Local Stack

- `Twenty` via `docker-compose.yml`
- `Supabase` local for application database and SQL workflow
- `Redis` for queues
- optional `Mailpit` later for notifications and magic links

### Supabase Local Recommendation

Use Supabase locally instead of managing raw Postgres by hand for the app database. It gives:

- local Postgres,
- migration workflow,
- generated DB types,
- optional storage/auth/realtime if needed later.

Suggested local commands once installed:

```bash
supabase start
supabase db reset
supabase gen types typescript --local
```

Suggested env split:

- `docker-compose.yml`: Twenty stack
- `infra/supabase/`: app database schema and seed data
- `.env.local`: app service runtime env

### Environment Variables

Minimum platform env set:

```env
NODE_ENV=development
APP_PORT=3010
WORKER_CONCURRENCY=5
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=local-anon-key
SUPABASE_SERVICE_ROLE_KEY=local-service-role-key
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
REDIS_URL=redis://127.0.0.1:6379
TWENTY_BASE_URL=http://localhost:4000
TWENTY_API_KEY=replace_me
OPENAI_API_KEY=replace_me
OPENROUTER_API_KEY=replace_me
ZALO_SESSION_ENCRYPTION_KEY=replace_me
```

## Current Status

### Completed

- [x] Create monorepo folder layout.
- [x] Preserve the standalone Twenty Docker setup.
- [x] Replace the single-file script with `services/zalo-connector`.
- [x] Add shared message normalization helper.
- [x] Add initial README and bootstrap docs.

### Current Runtime Slice

- `services/zalo-connector` can log in, listen, normalize text messages, append NDJSON, and post normalized events to the API.
- `services/api` accepts normalized events, persists them in Supabase, exposes internal read endpoints for conversations and messages, and now adds request IDs, validation, and outbound queue enqueueing.
- `services/worker` consumes `message.received` jobs and applies workflow mode routing through the repository layer.
- `packages/database` now holds the typed Supabase client, generated DB types, and repository factories.
- `Supabase` local schema and seed are in place, the ingest/readback runtime path has been smoke-tested, and workspace `typecheck`, `lint`, and `test` commands now pass.
- `Twenty` runs independently at `http://localhost:4000`.
- The runtime is still generic in naming and seeded examples. Domain-specific modeling for real estate and HR recruiting remains backlog work.

## Domain Brief

- [Architecture](architecture.md)
- [Vertical Scope](verticals.md)

## Sprint Files

- [Sprint 1: Platform Realization](bootstrap-plan/sprint-1.md)
- [Sprint 2: Queue and Persistence](bootstrap-plan/sprint-2.md)
- [Sprint 3: Vertical Workflows, CRM, and Operations](bootstrap-plan/sprint-3.md)

The detailed task backlog, checklists, lists, and nested list sections now live in the sprint files above.

## Appendix

### Definition of Done Per Feature

- code merged with lint and tests passing,
- env vars documented,
- logs added for the happy path and failure path,
- at least one integration test added if external state changes,
- operator-facing behavior documented in the README or runbook,
- tenant scoping verified.

### Runbook

Start Twenty:

```bash
docker compose up -d
```

Run the current connector:

```bash
node services/zalo-connector/src/index.js
```

Inspect current inbound event log:

```bash
tail -f services/zalo-connector/data/inbound.ndjson
```

Future local app DB commands:

```bash
supabase start
supabase db reset
supabase gen types typescript --local
```
