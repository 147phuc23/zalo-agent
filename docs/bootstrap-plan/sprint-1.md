# Sprint 1: Platform Realization

## Goal

Make the platform real enough to accept normalized inbound events, persist them, and keep the shared contracts stable for both real-estate and HR recruiting use cases.

## Track 1: Monorepo and Tooling

### T1.1 Workspace Bootstrapping

- [x] Install `pnpm`, `turbo`, `typescript`, `tsx`, `eslint`, `prettier`, `vitest`.
- [x] Add root `tsconfig.base.json` and per-package `tsconfig.json`.
- [x] Add root lint, test, build, and dev scripts.
- [x] Add `pnpm-workspace.yaml` package filters for all apps and packages.
- [x] Add `.editorconfig` and prettier config.

Output:

- repo builds and typechecks from root.

Acceptance:

- `pnpm install`
- `pnpm -r typecheck`
- `pnpm -r lint`

### T1.2 Shared Package Foundation

- [x] Move JS shared helpers to typed packages.
- [x] Add `packages/shared` schemas for `InboundMessage`, `OutboundMessage`, `TenantConfig`, `ToolCallAudit`.
- [x] Add `zod` validators next to shared types.
- [x] Add package exports map.

Output:

- all services import platform contracts from one place.

## Track 2: Database and Supabase

### T2.1 Local Supabase Setup

- [x] Initialize `infra/supabase`.
- [x] Add startup instructions and local CLI commands.
- [x] Add first migration set.
- [x] Add generated DB types package flow.

Output:

- app database can be reset and recreated locally with one command.

Acceptance:

- `supabase start`
- `supabase db reset`

### T2.2 Core Schema

- [x] Create `tenants` table.
- [x] Create `channel_accounts` table.
- [x] Create `conversations` table.
- [x] Create `messages` table.
- [x] Create `message_deliveries` table.
- [x] Create `workflow_configs` table.
- [x] Create `tool_call_audits` table.
- [x] Create `human_tasks` table.
- [x] Create `knowledge_documents` and `knowledge_chunks` tables.
- [x] Enable `pgvector` for chunk embeddings.

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

Vertical shadow entities to add in later sprints:

- real estate: `property_inquiries`, `viewings`, `buyer_requirements`, `seller_intakes`
- HR recruiting: `candidates`, `client_firms`, `job_openings`, `applications`, `interviews`, `placements`

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

## Track 3: API Service

### T3.1 API Bootstrap

- [x] Initialize `services/api` with `NestJS`.
- [x] Add `/health` endpoint.
- [x] Add `/ready` endpoint.
- [x] Add global validation pipe and error filter.
- [x] Add request ID middleware.

## Track 4: Zalo Connector

### T4.1 Connector Cleanup

- [ ] Convert connector to TypeScript.
- [ ] Add config loader.
- [ ] Separate login manager, listener, serializer, and sender modules.
- [ ] Add graceful shutdown handling.
