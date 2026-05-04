# Zalo x Twenty Build Plan

## Goal

Build a single TypeScript monorepo that can:

1. receive inbound messages from Zalo through an isolated connector,
2. process messages through our own API and worker stack,
3. store platform state in our own database,
4. sync business-facing CRM records into Twenty,
5. keep enough separation to split services later without rewriting core contracts.

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

- people,
- companies,
- opportunities,
- tasks,
- notes,
- pipeline and CRM views used by operators.

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

- `services/zalo-connector` can log in, listen, normalize text messages, and append NDJSON.
- `Twenty` runs independently at `http://localhost:4000`.
- Shared code exists but the API service, worker, queue, and real database are not built yet.

## Detailed Build Backlog

## Track 1: Monorepo and Tooling

### T1.1 Workspace Bootstrapping

- [ ] Install `pnpm`, `turbo`, `typescript`, `tsx`, `eslint`, `prettier`, `vitest`.
- [ ] Add root `tsconfig.base.json` and per-package `tsconfig.json`.
- [ ] Add root lint, test, build, and dev scripts.
- [ ] Add `pnpm-workspace.yaml` package filters for all apps and packages.
- [ ] Add `.editorconfig` and prettier config.

Output:

- repo builds and typechecks from root.

Acceptance:

- `pnpm install`
- `pnpm -r typecheck`
- `pnpm -r lint`

### T1.2 Shared Package Foundation

- [ ] Move JS shared helpers to typed packages.
- [ ] Add `packages/shared` schemas for `InboundMessage`, `OutboundMessage`, `TenantConfig`, `ToolCallAudit`.
- [ ] Add `zod` validators next to shared types.
- [ ] Add package exports map.

Output:

- all services import platform contracts from one place.

## Track 2: Database and Supabase

### T2.1 Local Supabase Setup

- [ ] Initialize `infra/supabase`.
- [ ] Add startup instructions and local CLI commands.
- [ ] Add first migration set.
- [ ] Add generated DB types package flow.

Output:

- app database can be reset and recreated locally with one command.

Acceptance:

- `supabase start`
- `supabase db reset`

### T2.2 Core Schema

- [ ] Create `tenants` table.
- [ ] Create `channel_accounts` table.
- [ ] Create `conversations` table.
- [ ] Create `messages` table.
- [ ] Create `message_deliveries` table.
- [ ] Create `workflow_configs` table.
- [ ] Create `tool_call_audits` table.
- [ ] Create `human_tasks` table.
- [ ] Create `knowledge_documents` and `knowledge_chunks` tables.
- [ ] Enable `pgvector` for chunk embeddings.

Suggested entities and ownership:

- `tenants`: business account, plan, locale, timezone, feature flags
- `users`: internal operators and admins
- `tenant_users`: membership and role mapping
- `channel_accounts`: one Zalo account or future channel account per tenant
- `contacts`: app-side contact shadow profile keyed by channel identity
- `conversations`: one active thread per tenant + channel + external thread
- `messages`: normalized inbound and outbound message records
- `message_deliveries`: provider delivery attempts and outcomes
- `workflow_configs`: routing, policy, prompts, CRM mapping
- `tool_call_audits`: agent tool calls, approvals, outcomes
- `human_tasks`: handoff and approval tasks
- `knowledge_documents`: uploaded source docs
- `knowledge_chunks`: chunked retrieval units with vector columns

Suggested message schema shape:

- `messages.direction`: `inbound` or `outbound`
- `messages.channel`: `zalo` initially
- `messages.message_type`: `text`, `image`, `sticker`, `file`, `system`
- `messages.external_message_id`: provider-native message identifier if available
- `messages.idempotency_key`: dedupe key from channel + thread + sender + timestamp/content hash
- `messages.raw_payload`: JSONB raw event payload

Suggested workflow schema shape:

- `workflow_configs.mode`: `auto`, `approval`, `manual`, `blocked`
- `workflow_configs.business_profile`: JSONB
- `workflow_configs.qualification_schema`: JSONB
- `workflow_configs.crm_mapping`: JSONB
- `workflow_configs.tone_policy`: JSONB
- `workflow_configs.blocked_topics`: JSONB array

Suggested schema rules:

- Use UUID primary keys.
- Add `tenant_id` on every tenant-owned row.
- Add `created_at` and `updated_at` on every mutable table.
- Add `idempotency_key` where duplicate writes are possible.
- Add partial indexes for active conversations and pending tasks.

### T2.3 Repository Layer

- [ ] Add `packages/database`.
- [ ] Generate TS DB types from Supabase local.
- [ ] Create repositories for tenants, messages, conversations, tasks, and audits.
- [ ] Add transaction helper for conversation updates.
- [ ] Add repository method naming convention doc.

Output:

- services never write ad hoc SQL in controllers.

Repository conventions:

- `findById`, `findByExternalKey`, `listByTenant`, `create`, `update`, `upsert`, `softDelete`
- repositories return domain-friendly records, not raw driver responses
- write methods accept explicit input DTOs, not partial arbitrary objects

### T2.4 Security and Encryption

- [ ] Encrypt Zalo session blobs before writing them.
- [ ] Encrypt sensitive CRM tokens and provider keys.
- [ ] Separate public config from secret config.
- [ ] Add secret rotation notes.

### T2.5 Seed Data and Local Initialization

- [ ] Add `packages/testing` seed helpers using `@faker-js/faker`.
- [ ] Create deterministic tenant seed data.
- [ ] Create demo contacts, conversations, and messages.
- [ ] Create sample workflow configs for sales, support, and booking flows.
- [ ] Create sample knowledge documents and chunks.
- [ ] Add `supabase/seed.sql` or scripted seed runner.

Suggested libraries:

- `@faker-js/faker` for realistic but fake data
- `seedrandom` if deterministic seeded randomness is needed
- `date-fns` for timeline generation

Acceptance:

- one command initializes a demo tenant with usable inbox, CRM sync targets, and knowledge data.

### T2.6 Data Model Review and ERD

- [ ] Write `docs/data-model.md`.
- [ ] Add ERD for core entities.
- [ ] Define canonical IDs and external reference strategy.
- [ ] Define soft-delete vs hard-delete rules.
- [ ] Define retention policy per table.

Output:

- the team can review schema before migrations spread across services.

## Track 3: API Service

### T3.1 API Bootstrap

- [ ] Initialize `services/api` with `NestJS`.
- [ ] Add `/health` endpoint.
- [ ] Add `/ready` endpoint.
- [ ] Add global validation pipe and error filter.
- [ ] Add request ID middleware.

### T3.2 Tenant and Workflow APIs

- [ ] Add CRUD for tenants.
- [ ] Add CRUD for workflow configs.
- [ ] Add CRUD for business profile and tone settings.
- [ ] Add CRUD for automation policy levels: `auto`, `approval`, `manual`, `blocked`.

### T3.3 Conversation APIs

- [ ] Add list conversations endpoint.
- [ ] Add get conversation detail endpoint.
- [ ] Add get messages endpoint.
- [ ] Add assign owner endpoint.
- [ ] Add human takeover toggle endpoint.

### T3.4 Internal Connector APIs

- [ ] Add internal endpoint to receive normalized connector events.
- [ ] Add internal endpoint to enqueue outbound send requests.
- [ ] Add auth between connector and API using service token or signed secret.

## Track 4: Zalo Connector

### T4.1 Connector Cleanup

- [ ] Convert connector to TypeScript.
- [ ] Add config loader.
- [ ] Separate login manager, listener, serializer, and sender modules.
- [ ] Add graceful shutdown handling.

### T4.2 Session Management

- [ ] Move session storage from local JSON to encrypted DB storage.
- [ ] Support boot from DB session.
- [ ] Add session refresh and save flow.
- [ ] Add session invalidation detection.

### T4.3 Inbound Pipeline

- [ ] Normalize text, image, sticker, and attachment events.
- [ ] Add deduplication key generation.
- [ ] Post normalized events to API or queue.
- [ ] Add retry strategy when API or Redis is unavailable.

### T4.4 Outbound Pipeline

- [ ] Accept outbound message jobs from queue.
- [ ] Map platform message format to `zca-js` send calls.
- [ ] Record delivery success and failure.
- [ ] Add backoff for transient send failures.

### T4.5 Reliability

- [ ] Add watchdog for listener disconnects.
- [ ] Add heartbeat status updates.
- [ ] Add one-active-listener guard by account.
- [ ] Add alert when Zalo web session is replaced.

## Track 5: Queue and Worker

### T5.1 Queue Foundation

- [ ] Add `BullMQ` connection module.
- [ ] Create queue `message.received`.
- [ ] Create queue `message.send`.
- [ ] Create queue `crm.sync`.
- [ ] Create queue `human.task.create`.
- [ ] Create queue `knowledge.embed`.
- [ ] Add dead-letter queues.
- [ ] Add retry and backoff defaults.

### T5.2 Message Processing Worker

- [ ] Consume `message.received`.
- [ ] Upsert conversation and contact shadow data.
- [ ] Persist raw message and normalized message.
- [ ] Evaluate workflow rules.
- [ ] Route to AI, human inbox, or blocked state.

### T5.3 AI Orchestration Worker

- [ ] Add intent classifier use case.
- [ ] Add tool-loop executor with max turns.
- [ ] Add confidence threshold handling.
- [ ] Add audit log for every model response and tool call.
- [ ] Add model selection strategy by tenant and workflow.

Suggested AI client shape:

```ts
interface AiClient {
  generate(input: GenerateInput): Promise<GenerateOutput>;
  stream(input: StreamInput): Promise<StreamResult>;
  embed(input: EmbedInput): Promise<EmbedOutput>;
}
```

Suggested model config fields:

- `workflow_configs.default_model`
- `workflow_configs.classifier_model`
- `workflow_configs.embedding_model`
- `workflow_configs.max_tool_turns`
- `workflow_configs.temperature`

### T5.4 Delivery Worker

- [ ] Consume `message.send`.
- [ ] Call connector send adapter.
- [ ] Update message delivery status.
- [ ] Schedule retry or dead-letter.

## Track 6: Twenty CRM Integration

### T6.1 Twenty Workspace Setup

- [ ] Create local Twenty workspace and admin user.
- [ ] Create API key with limited role.
- [ ] Document required custom objects and fields.
- [ ] Decide object mapping before coding adapter.

Suggested object mapping:

- person: customer or lead
- company: organization if present
- opportunity: qualified lead or sales deal
- task: follow-up task
- note: AI summary or staff note

### T6.2 CRM Adapter

- [ ] Add `services/api` or `packages/shared` CRM interface.
- [ ] Implement `TwentyCrmAdapter`.
- [ ] Add `findOrCreatePerson`.
- [ ] Add `findOrCreateCompany`.
- [ ] Add `createOpportunity`.
- [ ] Add `createTask`.
- [ ] Add `createNote`.

### T6.3 Idempotency and Mapping

- [ ] Add external reference table in our app DB.
- [ ] Map our tenant and contact IDs to Twenty record IDs.
- [ ] Prevent duplicate person and opportunity creation.
- [ ] Store sync timestamps and last sync status.

### T6.4 Metadata Discovery

- [ ] Read Twenty metadata for custom fields.
- [ ] Build field mapping config in admin UI.
- [ ] Validate required fields before sync.

## Track 7: MCP and Internal Tooling

### Why MCP Here

Use MCP for internal tool surfaces that the agent runtime can call in a controlled way. Keep MCP separate from raw repositories so we can audit tools cleanly.

### T7.1 Database MCP Server

- [ ] Create `packages/mcp` or `services/mcp`.
- [ ] Add read-only tool: `db.findContact`.
- [ ] Add read-only tool: `db.getConversation`.
- [ ] Add write tool: `db.createHumanTask`.
- [ ] Add write tool: `db.appendAuditLog`.
- [ ] Gate every tool by tenant context and policy level.

Suggested implementation:

- back MCP tools with repository/use-case methods,
- never expose free-form SQL execution to the agent,
- log tool input and output metadata.

### T7.2 CRM MCP Tools

- [ ] Add `crm.findPerson`.
- [ ] Add `crm.createNote`.
- [ ] Add `crm.createTask`.
- [ ] Add `crm.createOpportunity`.
- [ ] Add dry-run mode for approval flows.

### T7.3 Knowledge MCP Tools

- [ ] Add `knowledge.search`.
- [ ] Add `knowledge.getDocument`.
- [ ] Add source attribution in tool output.
- [ ] Add permission filter for tenant-private documents.

### T7.4 Messaging MCP Tools

- [ ] Add `channel.sendMessage`.
- [ ] Add `channel.getContactProfile`.
- [ ] Add policy gate before send.
- [ ] Add simulation mode in non-production.

### T7.5 Tool Definition Standards

- [ ] Define one schema file per tool with `zod`.
- [ ] Define tool names as stable verbs, not prompt-like phrases.
- [ ] Keep tools narrow and side-effect aware.
- [ ] Add approval metadata to tools that mutate external state.
- [ ] Add audit serializer for every tool execution.

How to define tools for the AI:

1. Write a typed input schema with `zod`.
2. Write a typed output schema with `zod`.
3. Add a short description focused on when to use the tool.
4. Keep tool side effects explicit in the name and description.
5. Route tool handlers to use cases, not raw DB calls or SDK calls.
6. Log tool input, output summary, tenant, actor, and duration.

Suggested tool shape:

```ts
export const createTaskTool = {
  name: "crm.createTask",
  description: "Create a follow-up CRM task for a tenant contact.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    contactId: z.string().uuid(),
    title: z.string().min(1),
    notes: z.string().optional(),
    dueAt: z.string().datetime().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  }),
  outputSchema: z.object({
    taskId: z.string(),
    provider: z.literal("twenty"),
    status: z.enum(["created", "skipped"]),
  }),
};
```

Tool design rules:

- prefer `read` tools and `write` tools as separate tools
- never create a tool that accepts raw SQL or arbitrary HTTP URLs
- keep one business action per tool
- include tenant-scoped identifiers, not globally ambiguous names
- return machine-friendly structured output, not prose
- expose dry-run mode for dangerous write tools when possible

## Track 8: Knowledge Base

### T8.1 Document Ingestion

- [ ] Upload FAQ, markdown, PDF, and plain text.
- [ ] Normalize files into documents.
- [ ] Chunk text with deterministic chunking rules.
- [ ] Store chunk metadata and source references.

### T8.2 Embeddings

- [ ] Create embedding job queue.
- [ ] Generate embeddings for chunks.
- [ ] Store vector in `pgvector`.
- [ ] Re-embed changed documents only.

### T8.3 Retrieval

- [ ] Build top-k semantic search.
- [ ] Add hybrid keyword fallback later.
- [ ] Return source references for audit and UI display.

## Track 9: Admin UI

### T9.1 App Bootstrap

- [ ] Initialize `Next.js` with auth shell.
- [ ] Add tenant switcher.
- [ ] Add layout, navigation, and role guards.

### T9.2 Workflow Builder

- [ ] Business profile form.
- [ ] Qualification questions config.
- [ ] CRM field mapping config.
- [ ] Tone and language config.
- [ ] Business hours and blocked-topic config.

### T9.3 Inbox

- [ ] Conversation list.
- [ ] Message timeline.
- [ ] Approve draft / reject draft actions.
- [ ] Human takeover toggle.
- [ ] CRM side panel.

### T9.4 Operations

- [ ] Connector health dashboard.
- [ ] Queue status dashboard.
- [ ] Audit viewer.
- [ ] Failed delivery report.

### T9.5 Frontend Data Layer and Component Standards

- [ ] Use `shadcn/ui` for primitive components and forms.
- [ ] Use `react-hook-form` + `zod` for admin forms.
- [ ] Use `tanstack-query` for server state.
- [ ] Use `zustand` only for small client-only UI state if needed.
- [ ] Define table, form, and timeline component patterns before feature sprawl.

Suggested frontend conventions:

- server state comes from query hooks, not global state
- form schemas live beside the form or feature module
- route segments map to product areas: inbox, workflows, crm-mapping, settings, operations
- timeline and inbox UI should be mobile-safe from the start

## Track 10: Agent Runtime

### T10.1 Intent and Policy

- [ ] Build intent classifier.
- [ ] Add tenant policy resolution.
- [ ] Resolve whether action is auto, approval, manual, or blocked.

### T10.2 Tool Loop

- [ ] Add orchestrator prompt layer.
- [ ] Add max-turn guard.
- [ ] Add tool allow-list per tenant and workflow.
- [ ] Add failure fallback response.
- [ ] Add structured system prompt sections for role, guardrails, and tool policy.

### T10.3 Human Handoff

- [ ] Create human task when confidence is low.
- [ ] Notify inbox.
- [ ] Pause automated replies during takeover.
- [ ] Resume automation after staff release.

## Track 11: Observability and Operations

### T11.1 Logs and Metrics

- [ ] Add structured logger shared package.
- [ ] Add request IDs and correlation IDs.
- [ ] Add queue job tracing.
- [ ] Add connector health logs.

### T11.2 Errors and Alerts

- [ ] Add Sentry to API, worker, and connector.
- [ ] Alert on Zalo session expiry.
- [ ] Alert on dead-letter queue growth.
- [ ] Alert on CRM sync failures.

### T11.3 Security and Retention

- [ ] Define PII retention periods.
- [ ] Add message redaction rules for logs.
- [ ] Add audit export path.
- [ ] Add backup and restore runbook.

## Track 12: Test Cases and HR Scenarios

### T12.1 Test Infrastructure

- [ ] Add `vitest` workspace setup.
- [ ] Add test env loader.
- [ ] Add database reset helper for integration tests.
- [ ] Add factory builders for tenants, contacts, conversations, and messages.

### T12.2 Seeded Demo Scenarios

- [ ] Create `sales-demo` tenant.
- [ ] Create `support-demo` tenant.
- [ ] Create `booking-demo` tenant.
- [ ] Create at least 30 seeded conversations with mixed outcomes.
- [ ] Create messages across text, image placeholder, and handoff paths.

### T12.3 HR Review Test Cases

- [ ] Add low-confidence handoff case.
- [ ] Add approval-required outbound message case.
- [ ] Add blocked-topic escalation case.
- [ ] Add duplicate contact merge case.
- [ ] Add CRM sync retry case.
- [ ] Add session-expired connector case.

Suggested HR-style acceptance cases:

- human reviewer sees AI draft, edits it, and approves send
- human reviewer takes over conversation and automation pauses
- human reviewer receives task when policy blocks automated reply
- human reviewer sees CRM context and last AI actions beside the chat

### T12.4 End-to-End Runtime Cases

- [ ] Inbound Zalo message creates or reopens conversation.
- [ ] Workflow policy routes message to AI or human.
- [ ] AI reads knowledge and CRM context through tools.
- [ ] AI creates CRM task when user asks for callback.
- [ ] Outbound send is recorded with delivery status.
- [ ] Audit trail captures prompts, tools, and final action.

## Suggested Build Order

## Sprint 1: Make the Platform Real

- [ ] T1.1 Workspace bootstrapping
- [ ] T2.1 Local Supabase setup
- [ ] T2.2 Core schema
- [ ] T3.1 API bootstrap
- [ ] T4.1 Connector cleanup

Goal:

- connector can send normalized events into our API and persist them in our app DB.

## Sprint 2: Queue and Persistence

- [ ] T5.1 Queue foundation
- [ ] T5.2 Message processing worker
- [ ] T4.3 Inbound pipeline
- [ ] T2.3 Repository layer

Goal:

- inbound messages flow through queue into DB-backed conversations.

## Sprint 3: CRM and Inbox Foundations

- [ ] T6.1 Twenty workspace setup
- [ ] T6.2 CRM adapter
- [ ] T3.3 Conversation APIs
- [ ] T9.3 Inbox

Goal:

- operator can see a conversation and push actions into Twenty.

## Sprint 4: Agent and Tools

- [ ] T7.1 Database MCP server
- [ ] T7.2 CRM MCP tools
- [ ] T8.1 Document ingestion
- [ ] T10.1 Intent and policy
- [ ] T10.2 Tool loop
- [ ] T12.3 HR review test cases

Goal:

- agent can read context, write safe actions, and fall back to human review.

## Definition of Done Per Feature

- code merged with lint and tests passing,
- env vars documented,
- logs added for the happy path and failure path,
- at least one integration test added if external state changes,
- operator-facing behavior documented in the README or runbook,
- tenant scoping verified.

## Runbook

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
