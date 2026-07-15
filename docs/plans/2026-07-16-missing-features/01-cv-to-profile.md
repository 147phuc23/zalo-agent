# Feature 1 — CV upload → candidate profile (full-text searchable)

Depends on: [00-foundation](00-foundation.md). Replaces the stubbed `cv-extractor.ts` / `cv.uploaded` path.

## Goal

Upload PDF/Word in admin chat or guest chat → bytes to storage → text extraction → LLM-structured profile (skills, work history, education, raw CV) persisted per contact/guest → agent's `crm_*` profile tools read/write the real table instead of mocks → full-text search over profiles.

## DB schema — migration `10_candidate_profiles.sql`

```sql
create table if not exists public.candidate_profiles (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  contact_id             uuid references public.contacts(id) on delete cascade,
  guest_access_id        uuid references public.guest_access(id) on delete cascade,
  source_document_id     uuid references public.documents(id) on delete set null,
  full_name              text,
  email                  text,
  phone                  text,
  location               text,
  current_title          text,
  years_of_experience    numeric(4,1),
  skills                 text[] not null default '{}',
  preferred_roles        text[] not null default '{}',
  salary_expectation_vnd bigint,
  availability           text,
  work_history           jsonb not null default '[]',  -- [{company,title,from,to,description}]
  education              jsonb not null default '[]',  -- [{school,degree,field,from,to}]
  languages              text[] not null default '{}',
  summary                text not null default '',
  raw_extraction         jsonb not null default '{}',  -- full LLM output for audit/reprocess; notes[] lives here
  -- English-first FTS (user decision): stemmed 'english' config, generated directly over fields
  search tsvector generated always as (
    to_tsvector('english',
      coalesce(full_name, '') || ' ' ||
      coalesce(current_title, '') || ' ' ||
      coalesce(public.f_array_to_string(skills, ' '), '') || ' ' ||
      coalesce(public.f_array_to_string(preferred_roles, ' '), '') || ' ' ||
      coalesce(location, '') || ' ' || summary
    )
  ) stored,
  embedding              vector(1536),                 -- pgvector-ready; no index until embeddings key chosen
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint candidate_profiles_owner_check
    check (contact_id is not null or guest_access_id is not null)
);

create unique index if not exists candidate_profiles_tenant_contact_key
  on public.candidate_profiles (tenant_id, contact_id) where contact_id is not null;
create unique index if not exists candidate_profiles_tenant_guest_key
  on public.candidate_profiles (tenant_id, guest_access_id) where guest_access_id is not null;
create index if not exists candidate_profiles_search_idx
  on public.candidate_profiles using gin (search);
create index if not exists candidate_profiles_skills_idx
  on public.candidate_profiles using gin (skills);
```

## Repository — `createCandidateProfileRepository(client)`

```ts
// upsert keyed on (tenant, contact) or (tenant, guest); merges patch over existing row
upsert(input: { tenantId; contactId?; guestAccessId?; sourceDocumentId?;
  patch: CandidateProfilePatch }): Promise<CandidateProfileRow>
findByContact(input: { tenantId; contactId }): Promise<CandidateProfileRow | null>
findByGuest(input: { tenantId; guestAccessId }): Promise<CandidateProfileRow | null>
findById(id: string): Promise<CandidateProfileRow | null>
// websearch_to_tsquery('english', query) @@ search, AND-ed structured filters
search(input: { tenantId; query?; skills?: string[]; minYears?; location?; limit? }): Promise<CandidateProfileRow[]>
```

Merge semantics for `upsert`: non-null patch fields overwrite; arrays replace (not union); `raw_extraction` deep-merged with `notes` preserved. Also add `contacts.findById` (needed here and by feature 5).

## Pipeline

```mermaid
sequenceDiagram
    participant UI as Admin/Guest UI (Vercel)
    participant RT as Next route
    participant ST as Storage (local disk dev / R2 deployed)
    participant API as NestJS API
    participant W as Worker: document.process
    participant DB as Neon
    participant LLM as OpenRouter

    UI->>RT: POST .../cv {fileName, mimeType, sizeBytes}
    RT->>DB: INSERT documents (kind=cv, status=uploaded)
    RT-->>UI: {documentId, uploadUrl}
    UI->>ST: PUT file bytes (presigned R2 / local /api/uploads/[id])
    UI->>RT: POST /api/documents/{id}/complete
    RT->>DB: INSERT inbound 'file' message (chat timeline, raw_payload.documentId)
    RT->>API: POST /internal/documents/process
    API->>W: document.process {tenantId, documentId}
    W->>ST: getObject(storage_key)
    W->>W: unpdf (pdf) / mammoth (docx) / passthrough (txt)
    alt scanned PDF: raw_text/pageCount < 200 chars
        W->>LLM: gemini-2.5-flash + base64 PDF file part (vision)
    end
    W->>DB: markProcessed(raw_text, parse_method)
    W->>LLM: structured CV extraction (json_object)
    W->>DB: candidateProfiles.upsert
    W->>W: clearHrAgentProfileCache()
    W->>DB: createOutbound (profile summary + top matches)
    W-->>UI: SSE / guest polling; message.send ONLY if conversation.channel='zalo'
```

## Files to create / modify

| File | Change |
|---|---|
| `packages/agent/src/core/document-processor.ts` | parse step + CV branch (new; replaces `cv-extractor.ts`) |
| `packages/agent/src/core/cv-extractor.ts` | **delete** (retire `cv.uploaded` producer block in worker `main.ts:438-461` too) |
| `packages/agent/src/cli/parse-doc.ts` | new debug CLI: file in → raw_text out |
| `apps/admin/src/app/api/conversations/[conversationId]/cv/route.ts` | rewrite: presign flow (was 501-on-Vercel local-write) |
| `apps/admin/src/app/api/documents/[documentId]/complete/route.ts` | new |
| `apps/admin/src/app/api/uploads/[documentId]/route.ts` | new (local-driver PUT target only) |
| `apps/admin/src/app/api/guest/[code]/cv/route.ts` | new (guest-session-authenticated) |
| guest chat UI `apps/admin/src/app/guest/[code]/page.tsx` | upload button |
| `packages/agent/src/skills/crm-{get,update,add-note}-candidate-profile/handler.ts` | optional injected `CandidateProfileContext { getProfile, updateProfile }`, DB-first mock-fallback (copy `createQueryCompanyTool` pattern) |
| `packages/agent/src/core/runner.ts` | `getCandidateProfileRepo()` + `getContactsRepo()` singletons; wire ctx; switch default-mode `CustomerProfileCache` loader from `getMockCandidateProfile` to DB-backed when `PLATFORM_DB_URL` set |
| `scripts/generate-skills-content.ts` | run to regenerate `skills-content.ts` after SKILL.md edits |

## Parsing libraries

| Purpose | Pick | Rejected | Why |
|---|---|---|---|
| PDF | **unpdf** | pdf-parse (unmaintained, CJS import crash), raw pdfjs-dist (worker wiring) | serverless pdfjs build, ESM, `extractText(buffer)`, per-page counts feed the scanned heuristic |
| DOCX | **mammoth** (`extractRawText`) | docx4js, textract | pure JS, battle-tested. Legacy `.doc`: reject at upload with Vietnamese message |
| Scanned PDF | **LLM vision** via existing OpenRouter factory (gemini-2.5-flash, base64 file part) | tesseract | no native dep; cap uploads 8MB |

Extraction prompt: extend the existing `CV_EXTRACTOR_SYSTEM_PROMPT` JSON contract with `work_history[]`, `education[]`, `languages[]`, `summary`; feed **raw text** (never just the filename, which is all the old stub sent); `responseFormat: { type: "json_object" }`; validate with zod, retry once on parse failure.

## Step-by-step

1. Migration 10 → migrate on Neon branch, then dev.
   - **Verify:** `\d candidate_profiles`; insert a row, `select * from candidate_profiles where search @@ websearch_to_tsquery('english','react developer')` matches (stemming: row saying "React development" must match "developer").
2. `createCandidateProfileRepository` + `contacts.findById` + repo set. Tests: upsert-merge (second upsert keeps earlier fields not in patch), owner-check violation, search with filter combos.
   - **Verify:** `pnpm --filter @platform/database test`.
3. Parse step in `document-processor.ts` + `cli/parse-doc.ts` + fixture files (one text PDF, one docx, one scanned PDF).
   - **Verify:** `npx tsx packages/agent/src/cli/parse-doc.ts fixtures/sample.pdf` prints text; scanned fixture routes to vision branch (log `parse_method=llm-vision`).
4. CV extraction branch: LLM call → zod → `upsert` → `clearHrAgentProfileCache()` → outbound summary message (channel-gated `message.send`).
   - **Verify:** seed a document row pointing at a fixture in local storage, enqueue via the internal endpoint, watch: documents.status=processed, candidate_profiles row created, outbound message row appears.
5. Upload routes + guest UI button; repoint the existing admin `MessageComposer` attach button.
   - **Verify (E2E, local stack):** upload a real CV in admin chat → chat shows the file message, then the Vietnamese profile-summary reply; `select full_name, skills from candidate_profiles` shows extracted data. Repeat in guest chat (poll-based reply, no message.send).
6. Agent rewiring (ctx into crm-* handlers, runner singletons, profile-cache loader swap); regenerate skills-content; extend `registry.test.ts`.
   - **Verify:** `hr-chat.ts` CLI: after step 5's upload, ask "bạn biết gì về mình?" — reply contains CV-derived facts; `tool_call_audits` shows `crm_getCandidateProfile` with DB data. With `PLATFORM_DB_URL` unset, mock fallback still answers (no crash).

## Risks

- **Profile cache staleness**: `clearHrAgentProfileCache()` is in-process; the worker is a single process, so sufficient. The admin Vercel runtime uses its own process — acceptable (TTL-bounded).
- **ai SDK file-part passthrough**: confirm base64 PDF parts flow through `createOpenRouterChatModel` to Gemini; fallback = raw `/chat/completions` in `OpenRouterAiClient`.
- **Guest pre-claim upload**: not possible (guest UI requires claim first) → owner resolution is contact-first; `guest_access_id` column covers edge cases.
- Vercel guest path needs `API_BASE_URL` reachable; if the always-on host is down, documents stay `uploaded` — add an admin "reprocess" button later if it bites.
