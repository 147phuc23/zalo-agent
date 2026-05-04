# Zalo x Twenty Bootstrap Plan

## Goal

Initialize a single TypeScript-oriented monorepo that can:

1. receive inbound messages from Zalo through an isolated connector,
2. run Twenty as a standalone CRM service,
3. leave clean seams for the future admin UI, API gateway, worker, and shared packages.

## Current Starting Point

- The repo already had a minimal `zca-js` login/listener script.
- The repo already had a working `docker-compose.yml` for Twenty CRM.
- There was no monorepo structure, no shared contracts, and no project plan.

## Architectural Rules

- Keep Zalo behind a disposable connector interface because `zca-js` is unofficial.
- Keep Twenty standalone and integrate with it over APIs instead of modifying source.
- Keep platform state in our own database later; use Twenty only for CRM records.
- Start simple: local persistence for inbound messages first, then Redis/BullMQ, then orchestration.

## Phase 0 Deliverables

- [x] Create monorepo folder layout.
- [x] Preserve the existing Twenty standalone Docker setup.
- [x] Replace the single-file bot with an isolated Zalo connector service.
- [x] Add shared message contracts and normalization utilities.
- [x] Write a bootstrap TODO doc for the next build phases.

## Immediate TODO

- [ ] Add `pnpm install` once network/package install is available.
- [ ] Add `typescript`, `tsx`, `turbo`, and workspace package dependencies.
- [ ] Add a real `services/api` app with health and inbound webhook endpoints.
- [ ] Add Redis and BullMQ for message queueing.
- [ ] Add Postgres schema for tenants, conversations, messages, and audit logs.
- [ ] Add encrypted session storage for Zalo credentials.
- [ ] Add QR login UX for connector operators.
- [ ] Add outbound command path from API/worker to Zalo connector.
- [ ] Add Twenty API client with people/company/opportunity/task/note actions.
- [ ] Add idempotency strategy for contact and opportunity creation.

## Repo Layout

```text
apps/
  admin/
services/
  api/
  worker/
  zalo-connector/
packages/
  shared/
docs/
```

## First Runtime Slice

### Zalo Connector

- Reads credentials from local disk if available.
- Falls back to QR login when credentials are missing.
- Starts the Zalo web listener.
- Normalizes inbound messages into a platform event shape.
- Appends normalized events to `services/zalo-connector/data/inbound.ndjson`.

### Twenty

- Runs through `docker-compose.yml`.
- Stays independent from platform services.
- Opens at `http://localhost:4000`.

## Next Phases

### Phase 1: Platform Foundation

- Add workspace dependencies and TypeScript configs.
- Create shared env loading and config validation.
- Add platform Postgres and Redis services.
- Add basic API and worker services.

### Phase 2: Message Pipeline

- Replace local file sink with BullMQ publishing.
- Add dead-letter handling and retry strategy.
- Add listener watchdog and reconnect handling.

### Phase 3: CRM Integration

- Configure Twenty workspace and API credentials.
- Build CRM adapter for find/create/update flows.
- Map workflow fields to Twenty metadata.

### Phase 4: Agent Runtime

- Add orchestration worker.
- Add tool permissions and audit logs.
- Add human handoff path.

## Runbook

Start Twenty:

```bash
docker compose up -d
```

Run the connector:

```bash
node services/zalo-connector/src/index.js
```

Inspect received events:

```bash
tail -f services/zalo-connector/data/inbound.ndjson
```
