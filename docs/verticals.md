# Zalo Platform Verticals

## Product Positioning

This platform is not a generic chatbot. It is a Zalo-first operator workflow platform for teams that acquire, qualify, and manage people through chat.

Primary verticals:

- real estate,
- HR recruiting.

Shared platform responsibilities:

- ingest and normalize inbound/outbound Zalo messages,
- store conversation state and workflow state,
- route conversations between AI and human operators,
- maintain audit logs, approvals, and inbox status,
- sync operator-facing records into Twenty.

## Real-Estate Scope

Primary actors:

- buyer,
- renter,
- seller,
- landlord,
- agent,
- broker.

Primary workflow examples:

- inquiry capture from listing or ad,
- lead qualification,
- property matching,
- viewing scheduling,
- follow-up reminders,
- handoff to agent,
- deal-stage tracking.

Recommended domain objects:

- `property_listings`,
- `property_inquiries`,
- `viewing_requests`,
- `viewings`,
- `buyer_requirements`,
- `seller_intakes`,
- `deal_interests`.

Twenty-facing records:

- person,
- company,
- opportunity,
- task,
- note,
- custom fields or custom objects for listing, inquiry, and viewing context.

## HR Recruiting Scope

Primary actors:

- candidate,
- recruiter,
- hiring coordinator,
- client firm,
- hiring manager.

Primary workflow examples:

- candidate sourcing,
- screening and qualification,
- CV or profile collection,
- interview scheduling,
- offer follow-up,
- rejection and nurture flows,
- placement tracking.

Recommended domain objects:

- `candidates`,
- `client_firms`,
- `job_openings`,
- `applications`,
- `interviews`,
- `placements`,
- `candidate_consents`.

Twenty-facing records:

- person,
- company,
- opportunity or custom recruiting object,
- task,
- note,
- custom fields or custom objects for job opening, application, interview, and placement context.

## Shared Design Rules

- Keep Zalo connector concerns isolated from business logic.
- Keep vertical workflow logic in use cases, not in transport handlers.
- Treat AI actions as policy-gated workflow steps, not autonomous free-form behavior.
- Store enough app-side state so the platform can later split from Twenty without contract rewrites.
- Keep CRM mapping configurable per tenant and per vertical.

## Compliance and Operations

Both verticals require stronger controls than a generic CRM chatbot:

- explicit opt-in and opt-out handling,
- human takeover and approval workflows,
- PII redaction in logs,
- retention rules by message, document, and audit type,
- role-based access for recruiters, agents, and managers,
- source attribution for AI-generated decisions or summaries.

## Immediate Documentation Gaps

The next docs that should exist are:

- `docs/data-model.md` for shared and vertical-specific entities,
- `docs/crm-mapping.md` for Twenty object and field mapping by vertical,
- `docs/workflow-modes.md` for approval, manual, blocked, and auto-routing behavior,
- `docs/compliance.md` for consent, retention, and audit requirements.
