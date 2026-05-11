# Sprint 3: Vertical Workflows, CRM, and Operations

## Goal

Expose operator-facing workflows and the surrounding platform features needed for real-estate and HR recruiting operations, CRM sync, MCP tools, knowledge retrieval, admin UI, observability, and test coverage.

## Track 6: Vertical Domain and Twenty Integration

### T6.1 Domain Framing and Workspace Setup

- [ ] Define shared objects versus vertical-specific objects.
- [ ] Create local Twenty workspace and admin user.
- [ ] Create API key with limited role.
- [ ] Document required custom objects and fields by vertical.
- [ ] Decide object mapping before coding adapter.

Suggested real-estate mapping:

- person: buyer, renter, seller, landlord, or owner contact
- company: brokerage, developer, or property-management company
- opportunity: active property interest or transaction pipeline item
- task: viewing follow-up, document follow-up, agent callback
- note: AI summary, property preference note, or operator note

Suggested HR recruiting mapping:

- person: candidate or hiring contact
- company: client firm or employer
- opportunity or custom object: job opening, application, or placement tracking item
- task: screening follow-up, interview scheduling, recruiter callback
- note: AI summary, screening note, interview note, or operator note

### T6.2 CRM Adapter

- [ ] Add `services/api` or `packages/shared` CRM interface.
- [ ] Implement `TwentyCrmAdapter`.
- [ ] Add `findOrCreatePerson`.
- [ ] Add `findOrCreateCompany`.
- [ ] Add `createOpportunity` or vertical-equivalent custom record.
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

### T6.5 Vertical Workflow Definitions

- [ ] Define real-estate stages such as inquiry, qualified, viewing, negotiating, closed, lost.
- [ ] Define HR recruiting stages such as sourced, screened, shortlisted, interviewed, offered, placed, rejected.
- [ ] Define per-stage AI permissions and human approval rules.
- [ ] Define ownership and SLA rules for agent and recruiter queues.

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
- [ ] Add `crm.createOpportunity` or mapped vertical-equivalent record.
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

Vertical policy examples:

- real estate: schedule viewing follow-up only during business hours unless human-approved
- HR recruiting: do not send rejection, offer, or interview reschedule messages without configured policy or human approval

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

- [ ] Upload FAQ, markdown, PDF, resume, job description, brochure, and plain text.
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
- [ ] Vertical selector and tenant capability config.
- [ ] Qualification questions config.
- [ ] CRM field mapping config.
- [ ] Tone and language config.
- [ ] Business hours and blocked-topic config.

### T9.3 Inbox

- [ ] Conversation list.
- [ ] Message timeline.
- [ ] Approve draft / reject draft actions.
- [ ] Human takeover toggle.
- [ ] CRM side panel with vertical context.

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
- route segments map to product areas: inbox, workflows, crm-mapping, verticals, settings, operations
- timeline and inbox UI should be mobile-safe from the start

## Track 10: Agent Runtime

### T10.1 Intent and Policy

- [ ] Build intent classifier.
- [ ] Add tenant policy resolution.
- [ ] Resolve whether action is auto, approval, manual, or blocked.

Intent families to support first:

- real estate: property inquiry, viewing request, budget qualification, location preference, owner intake
- HR recruiting: candidate screening, CV follow-up, interview scheduling, salary expectation, client-firm request

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

- [ ] Replace `sales-demo` with `real-estate-demo`.
- [ ] Replace `support-demo` with `hr-recruiting-demo`.
- [ ] Replace `booking-demo` with `mixed-ops-demo`.
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

Suggested real-estate acceptance cases:

- prospect asks about a listing and receives a qualified follow-up path
- operator schedules a viewing and the conversation timeline reflects the action
- buyer preferences are summarized into CRM context for later follow-up
- seller inquiry is routed to the correct agent queue with source and urgency

### T12.4 End-to-End Runtime Cases

- [x] Inbound Zalo message creates or reopens conversation.
- [ ] Workflow policy routes message to AI or human.
- [ ] AI reads knowledge and CRM context through tools.
- [ ] AI creates viewing or interview follow-up task when user asks for callback.
- [ ] Outbound send is recorded with delivery status.
- [ ] Audit trail captures prompts, tools, and final action.
