# Feature Plan: Guest Chat Access (admin-generated invite links)

## Goal

Let an external ("random") user chat with the bot without having the admin Basic Auth password:

1. **Admin generates an invite URL** — only the admin can mint links; a guest can never
   self-create one (prevents anyone on the internet from opening chat sessions and burning
   OpenRouter credit).
2. Guest opens the URL for the first time → **sets their own password** and **fills in a short
   profile** (name, etc.). The system generates their guest identity (ID + contact + conversation).
3. Guest chats with the bot in a simplified chat UI (same inline agent flow the admin simulator
   uses).
4. On later visits the guest must enter their password — **unless a valid secret is already in
   `localStorage`**, in which case they go straight to the chat.

## Data model

New migration `packages/database/migrations/05_guest_access.sql`:

```sql
CREATE TABLE guest_access (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  invite_code        text NOT NULL UNIQUE,          -- unguessable, e.g. nanoid(24)
  status             text NOT NULL DEFAULT 'pending', -- pending | claimed | revoked
  password_hash      text,                          -- null until claimed (bcrypt/scrypt)
  display_name       text,
  profile            jsonb NOT NULL DEFAULT '{}',   -- role interest, experience, salary, ...
  contact_id         uuid REFERENCES contacts(id),
  conversation_id    uuid REFERENCES conversations(id),
  session_token_hash text,                          -- sha256 of the current bearer secret
  created_at         timestamptz NOT NULL DEFAULT now(),
  claimed_at         timestamptz,
  last_seen_at       timestamptz
);
CREATE INDEX guest_access_tenant_idx ON guest_access (tenant_id, created_at DESC);
```

Add `createGuestAccessRepository` to `packages/database/src/repositories.ts` (same factory
pattern as the others) and business logic in `packages/core/src/guest.ts` so both the admin app
and any future service reuse it.

## Flows

### A. Admin generates a link
- Admin UI: a "Guest Links" section (new tab in the inspector panel or a `/guests` page):
  generate, copy URL, revoke, see status/last-seen.
- `POST /api/admin/guests` → inserts `guest_access` row with fresh `invite_code`,
  returns `https://<host>/guest/<invite_code>`.
- These `/api/admin/*` routes stay behind the existing Basic Auth proxy.

### B. First visit (claim)
- Guest opens `/guest/<code>`.
- `GET /api/guest/<code>/state` → `{ status: "pending" | "claimed" | "revoked" }`
  (never returns profile or any other data).
- If `pending`: show **claim form** — password (+ confirm) and profile fields
  (display name, desired role, years of experience, expected salary — final list TBD).
- `POST /api/guest/<code>/claim` `{ password, profile }`:
  1. Reject if already claimed/revoked (first writer wins — atomic
     `UPDATE ... WHERE status = 'pending'`).
  2. Hash password (bcrypt, cost ≥ 10).
  3. Create `contacts` row (`external_user_id = "guest-" + id`) and a `conversations` row
     (channel `zalo`, threadId `guest-<id>` — reuses the existing ingest/reply path unchanged).
  4. Optionally ingest a first synthetic message built from the profile ("Xin chào, tôi là …")
     so the agent has context and greets the guest.
  5. Generate session secret: 32 random bytes, base64url. Store **sha256 hash** in
     `session_token_hash`; return the raw secret once.
- Client stores it in `localStorage` (versioned, per `client-localstorage-schema`):
  `localStorage["guest:<code>"] = JSON.stringify({ v: 1, secret })`.

### C. Return visit
- Page loads → read `localStorage["guest:<code>"]`.
  - Secret present → call `GET /api/guest/<code>/me` with `Authorization: Bearer <secret>`;
    if valid → straight to chat (this is the "logged in, don't ask again" path).
  - Absent/invalid → **password prompt** → `POST /api/guest/<code>/login` `{ password }` →
    verifies hash, rotates and returns a new session secret → saved to localStorage.
- Rate-limit login attempts (e.g. 5/min per code) to slow brute force.

### D. Chat
- `GET  /api/guest/<code>/messages?after=<ts>` — list messages for **their** conversation only.
- `POST /api/guest/<code>/messages` `{ text }` — ingests the inbound message and runs the inline
  agent reply (reuse `generateAndSaveReply` from `@platform/core`, `maxDuration = 60`), exactly
  like the admin `/api/events` route but with the conversation resolved from the guest row —
  never from a client-supplied conversationId.
- Client polls with SWR (5s, visibility-gated), same pattern as the admin refactor plan.
- Page `/guest/[code]/page.tsx`: minimal chat UI (message list + composer). No inspector, no
  audits, no prompts.

## Auth boundaries (important)

- `apps/admin/src/proxy.ts` currently Basic-Auths **everything**. Exempt the guest surface:
  ```ts
  const publicPrefixes = ["/guest/", "/api/guest/"];
  if (publicPrefixes.some((p) => request.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  ```
  Guest routes enforce their own bearer-secret auth instead.
- Every guest route handler must:
  1. Look up the row by `invite_code`; 404 on unknown/revoked.
  2. For authenticated endpoints, compare `sha256(bearer)` to `session_token_hash`
     (constant-time compare); 401 otherwise.
  3. Scope all reads/writes by the row's `tenant_id` + `conversation_id` — a guest can never
     reference another conversation, even by guessing UUIDs.
- Secrets: never store the raw session secret or password server-side; never log them; raw
  secret appears only in the claim/login response body.

## Implementation checklist

1. [ ] Migration `05_guest_access.sql` + `guestAccess` repository (`packages/database`).
2. [ ] `packages/core/src/guest.ts`: `createInvite`, `claimInvite`, `loginGuest`,
       `verifyGuestSession`, `listGuestMessages`, `sendGuestMessage` (wraps the existing
       ingest + `generateAndSaveReply`).
3. [ ] Admin routes: `POST/GET /api/admin/guests`, `POST /api/admin/guests/[id]/revoke`.
4. [ ] Guest routes: `state`, `claim`, `login`, `me`, `messages` under `/api/guest/[code]/`.
5. [ ] Proxy exemption for `/guest/*` + `/api/guest/*`.
6. [ ] Guest UI: `/guest/[code]` — claim form, password prompt, chat screen; localStorage
       session handling.
7. [ ] Admin UI: guest-links management panel (generate / copy / revoke / status).
8. [ ] Rate limiting on `login` + `claim` (in-memory per-instance is acceptable for v1;
       note it resets per serverless instance).
9. [ ] Deps: `bcryptjs` (pure JS, serverless-safe) or Node `crypto.scrypt` (no new dep).

## Open questions (defaults chosen, adjust if wrong)

- **Profile fields**: defaulting to display name, desired role, years of experience, expected
  salary — should match what `gather-requirement`/known-facts consume so the agent uses them.
- **Expiry**: invites currently never expire; add `expires_at` if links will be shared broadly.
- **One conversation per guest**: yes in v1 (the invite *is* the conversation). "New chat" for
  the same guest = admin generates another link.
- **Password reset**: not in v1 — admin revokes the link and issues a new one.
