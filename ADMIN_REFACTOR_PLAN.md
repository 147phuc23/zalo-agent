# Admin → Direct-DB Refactor Plan

Make the **admin** a self-contained app that talks **directly to Neon Postgres** for
all read/query + prompt operations by importing shared business logic — instead of
HTTP-proxying to a separately deployed API. Keep the NestJS backend only for what
genuinely needs an always-on service (connector ingest, the agent worker, async queue work).

## Why this works

`@platform/database` is already pure `pg` + repository factories — **no NestJS**. The
only business logic stuck inside NestJS is the small transform in `InboxQueryService`
and `PromptsService`. Extract those into a shared package and both the API *and* the
admin can call them.

---

## Architecture

**Before**
```
admin (Next.js)  --HTTP+token-->  API (NestJS)  -->  @platform/database  -->  Neon
```

**After**
```
admin (Next.js route handlers) --> @platform/core --> @platform/database --> Neon
                                                            ^
API (NestJS, connector+worker) -----------------------------┘  (imports the same core)
```

- **Reads / prompt management** in the admin → direct to Neon (no API hop, no token, no separate service to keep up).
- **Async pipeline** (incoming Zalo webhooks, agent LLM replies, outbound send) → stays in the backend.

---

## Step 1 — Create `packages/core` (framework-agnostic business logic)

`packages/core/package.json`
```json
{
  "name": "@platform/core",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@platform/database": "workspace:*" }
}
```

`packages/core/src/inbox.ts` — lift the logic verbatim out of `InboxQueryService`:
```ts
import type { createRepositorySet } from "@platform/database";
type Repos = ReturnType<typeof createRepositorySet>;

export async function listConversations(repos: Repos, input: { tenantId: string; limit: number }) {
  const conversations = await repos.conversations.listByTenant(input);
  const contactIds = conversations.map((c) => c.contact_id);
  const contactsById = new Map<string, { displayName: string | null; externalUserId: string }>();
  if (contactIds.length > 0) {
    const contacts = await repos.contacts.listByIds({ ids: contactIds });
    for (const c of contacts) {
      contactsById.set(c.id, { displayName: c.display_name, externalUserId: c.external_user_id });
    }
  }
  return conversations.map((c) => ({
    id: c.id, tenantId: c.tenant_id, channel: c.channel,
    externalThreadId: c.external_thread_id, status: c.status,
    assigneeUserId: c.assignee_user_id, overrideModel: c.override_model,
    lastActivityAt: c.last_activity_at, createdAt: c.created_at,
    contact: contactsById.get(c.contact_id) ?? null,
  }));
}

export async function listMessages(repos: Repos, input: { conversationId: string; limit: number }) {
  const messages = await repos.messages.listByConversation(input);
  return messages.map((m) => ({
    id: m.id, tenantId: m.tenant_id, conversationId: m.conversation_id,
    direction: m.direction, messageType: m.message_type, text: m.text,
    externalMessageId: m.external_message_id, idempotencyKey: m.idempotency_key,
    rawPayload: m.raw_payload, isRead: m.is_read, readAt: m.read_at, createdAt: m.created_at,
  }));
}
```

`packages/core/src/prompts.ts` — lift from `PromptsService`:
```ts
import type { createRepositorySet } from "@platform/database";
type Repos = ReturnType<typeof createRepositorySet>;

export const getActivePrompt = (repos: Repos, tenantId: string, key: string) =>
  repos.prompts.findActive({ tenantId, key });

export const listPromptVersions = (repos: Repos, tenantId: string, key: string) =>
  repos.prompts.listVersions({ tenantId, key });

export async function saveNewPromptVersion(repos: Repos, tenantId: string, key: string, content: string) {
  const versions = await repos.prompts.listVersions({ tenantId, key });
  const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;
  return repos.prompts.create({ tenantId, key, content, version: nextVersion });
}
```

`packages/core/src/index.ts`
```ts
export * from "./inbox.js";
export * from "./prompts.js";
```

## Step 2 — Point the NestJS services at `@platform/core` (no duplication)

`InboxQueryService` / `PromptsService` become thin delegators:
```ts
import { listConversations, listMessages } from "@platform/core";
// ...
listConversations(this.postgres.repos, input)
```
Controllers unchanged. The API keeps working for the connector/worker, zero behavior change.

## Step 3 — Admin DB singleton (serverless-safe)

`apps/admin/src/lib/db.ts`
```ts
import { createDatabaseClient, createRepositorySet } from "@platform/database";

// Cache the pool on globalThis so warm invocations reuse one connection.
const g = globalThis as unknown as { _repos?: ReturnType<typeof createRepositorySet> };

export function getRepos() {
  if (!g._repos) {
    const url = process.env.PLATFORM_DB_URL;
    if (!url) throw new Error("PLATFORM_DB_URL is not set");
    g._repos = createRepositorySet(createDatabaseClient({ PLATFORM_DB_URL: url }));
  }
  return g._repos;
}
```

## Step 4 — Rewrite admin read routes to call core directly

`apps/admin/src/app/api/inbox/conversations/route.ts`
```ts
import { NextResponse } from "next/server";
import { listConversations } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs"; // REQUIRED: pg does not run on Edge

export async function GET() {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) return NextResponse.json({ ok: false, error: "missing TENANT_ID" }, { status: 500 });
  try {
    const conversations = await listConversations(getRepos(), { tenantId, limit: 50 });
    return NextResponse.json({ ok: true, conversations });
  } catch (err: any) {
    console.error("[api/inbox/conversations]", err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
```
Do the same for: messages list, prompts GET/POST, audits, read, model.
**No HTTP hop, no INTERNAL_INGEST_TOKEN, no dependency on the API being up.**

## Step 5 — Admin deps

`apps/admin/package.json` add:
```json
"@platform/core": "workspace:*",
"@platform/database": "workspace:*",
"pg": "^8.13.3"
```
Then `pnpm install`. The existing `--filter @platform/admin...` install now pulls these in,
and Vercel bundles the workspace packages + traces `pg`.

---

## What STAYS on the backend (do NOT move to admin)

These need a separate always-on service:
- **Zalo connector ingest** (`/internal/events`) — webhooks → write inbound + enqueue agent work.
- **The worker / agent** — long-running queue consumer that calls the LLM.
- **Outbound send** — push replies back to Zalo.

## The AI actions (`ai-reply`, `ai-react`) — hybrid

They enqueue worker jobs, so they still need the backend. Keep these admin routes as
HTTP proxies (`proxyToApi`) to the backend API. Only the **read** routes go direct-to-DB.

So the split is:
| Admin route | After refactor |
|---|---|
| inbox conversations / messages | direct-to-DB |
| prompts GET/POST | direct-to-DB |
| audits / read / model | direct-to-DB |
| ai-reply / ai-react / cv upload / events | proxy to backend (needs worker/queue) |

---

## Deployment after refactor

- **Admin** → Vercel, self-contained. Env: `PLATFORM_DB_URL` (Neon pooled), `TENANT_ID`,
  and `API_BASE_URL` + `INTERNAL_INGEST_TOKEN` **only** if you keep the AI-action proxies.
- **Backend (API + worker + Redis/queue)** → Railway/Render (always-on), when you want the
  agent pipeline live. Until then, the admin fully works for viewing + prompt management.

---

## Real-time

Admin polls the direct-DB conversations endpoint, **visibility-gated, ~10s**. Cheap now —
it's a direct Neon query with a reused pool, no API hop. Pause when `document.hidden`.

---

## Gotchas checklist

- [ ] `export const runtime = "nodejs"` on every route that imports `pg` (Edge can't run pg).
- [ ] Pool cached on `globalThis` (Step 3) — don't `new Pool()` per request.
- [ ] `PLATFORM_DB_URL` = Neon **pooled** URL (`-pooler` host). It's a server-only secret — never expose to the client (no `NEXT_PUBLIC_`).
- [ ] Run migrations out-of-band: `PLATFORM_DB_URL=... pnpm --filter @platform/database migrate`.
- [ ] Keep `max: 1` in `createDatabaseClient` for serverless.

---

## Suggested order

1. `packages/core` + move logic (Steps 1–2). Verify API still builds.
2. Admin DB singleton + deps (Steps 3, 5).
3. Convert read routes one at a time (Step 4), test each.
4. Add polling (visibility-gated).
5. Decide backend host for the worker/agent when you need the AI pipeline.
