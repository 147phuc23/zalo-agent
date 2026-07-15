# Phase 0 — Shared Foundation: documents table, storage package, document.process queue

Blocks: everything else. No feature work starts before this lands.

## Goal

One ingestion backbone shared by CV (feature 1) and JD (feature 2): a `documents` table, a storage abstraction (local disk in dev, Cloudflare R2 deployed), and a `document.process` BullMQ queue consumed by the worker. Retires the stubbed `cv.uploaded` path.

## DB schema — migration `09_documents.sql`

```sql
-- Immutable wrapper: array_to_string is STABLE, unusable in generated columns.
-- Defined here because migrations 10 and 15 both need it.
create or replace function public.f_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe
as $$ select array_to_string(arr, sep) $$;

-- Uploaded source documents (CVs, JDs); bytes live in storage, extracted text cached here.
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  kind           text not null check (kind in ('cv', 'jd')),
  storage_key    text not null,                 -- e.g. {tenant_id}/cv/{uuid}/{filename}
  file_name      text not null,
  mime_type      text not null default 'application/octet-stream',
  size_bytes     bigint,
  status         text not null default 'uploaded'
                 check (status in ('uploaded', 'processing', 'processed', 'failed')),
  parse_method   text,                          -- 'unpdf' | 'mammoth' | 'llm-vision' | 'plain-text'
  raw_text       text,
  error          text,
  -- provenance (nullable: JD has company_id; chat CV has contact/conversation; guest CV has guest_access_id)
  contact_id       uuid references public.contacts(id) on delete set null,
  guest_access_id  uuid references public.guest_access(id) on delete set null,
  conversation_id  uuid references public.conversations(id) on delete set null,
  company_id       uuid references public.companies(id) on delete set null,
  uploaded_by      text not null default 'admin' check (uploaded_by in ('admin', 'guest', 'zalo')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists documents_tenant_kind_idx
  on public.documents (tenant_id, kind, created_at desc);
create index if not exists documents_raw_text_fts_idx
  on public.documents using gin (to_tsvector('english', coalesce(raw_text, '')));
```

## New package: `packages/storage`

One interface, two drivers; selected by `createStorage(env)` — R2 when `R2_*` env vars set, else local.

```ts
export interface Storage {
  // Where the browser should PUT the bytes.
  // r2:    presigned PUT URL (expiresInSeconds default 600)
  // local: app-relative URL `/api/uploads/{documentId}` (admin route streams to putObject)
  getUploadTarget(input: { key: string; contentType: string; documentId: string }): Promise<{ url: string; method: "PUT" }>;
  putObject(key: string, body: Buffer, contentType?: string): Promise<void>;   // used by local upload route + CLI imports
  getObject(key: string): Promise<Buffer>;                                     // worker download
  presignGet(input: { key: string; expiresInSeconds?: number }): Promise<string>; // admin "view original" (local: static route)
}
```

- `r2` driver: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Endpoint `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, bucket `R2_BUCKET`.
- `local` driver: writes under `LOCAL_UPLOAD_DIR` (default `<repo>/.data/uploads/`, **gitignored**), path = storage_key. Worker and admin share the dir when running on one machine.
- `packages/config` `SharedSchema` gains optional `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `LOCAL_UPLOAD_DIR`.

| S3 client choice | Verdict |
|---|---|
| **@aws-sdk/client-s3 + presigner** | ✅ Cloudflare's documented R2 path, presigner built in; weight irrelevant server-side |
| aws4fetch | tiny but manual query signing |
| minio-js | no advantage |

## Queue + worker skeleton

- `services/api/src/services/queue.service.ts`: add `documentProcessQueue` (name `document.process`) + `enqueueDocumentProcess({ tenantId, documentId })` — copy the `enqueueKnowledgeEmbed` shape.
- New NestJS controller `services/api/src/controllers/internal-documents.controller.ts`: `POST /internal/documents/process` (guarded by `INTERNAL_INGEST_TOKEN` like the other internal routes) → enqueue.
- New `packages/agent/src/core/document-processor.ts`: `startDocumentWorker(deps)` — BullMQ `Worker("document.process", ...)`; skeleton loads document row, `markProcessing`, writes dummy raw_text, `markProcessed`. Registered **unconditionally** in `services/worker/src/main.ts` (no `HR_SKILL_MODE=twenty` gate — that gate is why the old CV path never ran).

## Repository — `createDocumentRepository(client)` in `packages/database/src/repositories.ts`

```ts
create(input: { tenantId; kind: "cv" | "jd"; storageKey; fileName; mimeType?; sizeBytes?;
  contactId?; guestAccessId?; conversationId?; companyId?; uploadedBy? }): Promise<DocumentRow>
findById(id: string): Promise<DocumentRow | null>
markProcessing(id: string): Promise<void>
markProcessed(input: { id; rawText; parseMethod }): Promise<void>
markFailed(input: { id; error }): Promise<void>
listByTenant(input: { tenantId; kind?; limit? }): Promise<DocumentRow[]>
```

Add `documents` to `createRepositorySet`.

## Step-by-step

1. Write `09_documents.sql`. Run `pnpm --filter @platform/database migrate` against a **Neon branch DB** first, then dev.
   - **Verify:** `psql $PLATFORM_DB_URL -c "\d documents"` shows the table; `select public.f_array_to_string(array['a','b'], ' ')` returns `a b`; `_migrations` has the row.
2. Add `DocumentRow` type + `createDocumentRepository` + wire into `createRepositorySet`. Unit test insert→statuses→findById round trip.
   - **Verify:** `pnpm --filter @platform/database test` green.
3. Scaffold `packages/storage` (package.json, tsconfig mirroring `packages/config`); implement **local driver first**, then r2 driver; config env additions; add `.data/` to `.gitignore`.
   - **Verify:** vitest — local driver put/get round trip in a temp dir; r2 tests skip when env unset.
4. API: queue + `POST /internal/documents/process` endpoint.
   - **Verify:** `curl -X POST localhost:7010/internal/documents/process -H "Authorization: Bearer $INTERNAL_INGEST_TOKEN" -d '{"tenantId":"...","documentId":"..."}'` → 202; Redis shows the job (`docker exec` redis-cli `KEYS bull:document.process:*`).
5. Worker skeleton: `startDocumentWorker` registered in `services/worker/src/main.ts`.
   - **Verify:** with the local stack up (`scripts/dev-up.sh` + worker), the curl from step 4 flips the seeded document row to `processed` with dummy text; worker log line appears.

## Deploy checklist (not dev blockers)

- Create R2 bucket + API token; set `R2_*` env on worker host and Vercel.
- R2 CORS rule allowing PUT from the admin/guest origins (needed for presigned browser uploads).

## Risks

- The local driver assumes admin (Next dev server) and worker run on the same filesystem — true for the current dev setup; document it in the package README.
- `documents.updated_at` maintained by repo code (no trigger), same as the rest of the schema.
