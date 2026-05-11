# Sprint 2: Queue and Persistence

## Goal

Move from event ingress to durable, queue-backed processing so inbound messages flow through the system into DB-backed conversations.

## Track 2: Database and Supabase

### T2.3 Repository Layer

- [x] Add `packages/database`.
- [x] Generate TS DB types from Supabase local.
- [x] Create repositories for tenants, messages, conversations, tasks, and audits.
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
- [x] Create deterministic tenant seed data.
- [x] Create demo contacts, conversations, and messages.
- [ ] Replace generic demo flows with real-estate and HR recruiting flows.
- [x] Create sample knowledge documents and chunks.
- [x] Add `supabase/seed.sql` or scripted seed runner.

Suggested libraries:

- `@faker-js/faker` for realistic but fake data
- `seedrandom` if deterministic seeded randomness is needed
- `date-fns` for timeline generation

Acceptance:

- one command initializes vertical demo tenants with usable inbox, CRM sync targets, and knowledge data.

### T2.6 Data Model Review and ERD

- [ ] Write `docs/data-model.md`.
- [ ] Add ERD for core entities.
- [ ] Define canonical IDs and external reference strategy.
- [ ] Define soft-delete vs hard-delete rules.
- [ ] Define retention policy per table.

Output:

- the team can review schema before migrations spread across services.

## Track 4: Zalo Connector

### T4.2 Session Management

- [ ] Move session storage from local JSON to encrypted DB storage.
- [ ] Support boot from DB session.
- [ ] Add session refresh and save flow.
- [ ] Add session invalidation detection.

### T4.3 Inbound Pipeline

- [ ] Normalize text, image, sticker, and attachment events.
- [x] Add deduplication key generation.
- [x] Post normalized events to API or queue.
- [ ] Add retry strategy when API or Redis is unavailable.

### T4.4 Outbound Pipeline

- [ ] Accept outbound message jobs from queue.
- [ ] Map platform message format to `zca-js` send calls.
- [ ] Record delivery success and failure.
- [ ] Add backoff for transient send failures.

### T4.5 Reliability

- [ ] Add watchdog for listener disconnects.
- [x] Add heartbeat status updates.
- [ ] Add one-active-listener guard by account.
- [ ] Add alert when Zalo web session is replaced.

## Track 5: Queue and Worker

### T5.1 Queue Foundation

- [x] Add `BullMQ` connection module.
- [x] Create queue `message.received`.
- [x] Create queue `message.send`.
- [x] Create queue `crm.sync`.
- [x] Create queue `human.task.create`.
- [x] Create queue `knowledge.embed`.
- [x] Add dead-letter queues.
- [x] Add retry and backoff defaults.

### T5.2 Message Processing Worker

- [x] Consume `message.received`.
- [ ] Upsert conversation and contact shadow data.
- [ ] Persist raw message and normalized message.
- [x] Evaluate workflow rules.
- [x] Route to AI, human inbox, or blocked state.

Vertical behavior to support:

- real estate: listing inquiry, viewing request, buyer qualification, seller intake
- HR recruiting: candidate screening, CV follow-up, interview scheduling, client-firm handoff

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
