# Next.js Best Practices — zalo-twenty-platform

Conventions for `apps/admin` (Next.js 16, App Router) and the `@platform/*` packages it
consumes. Written to be enforceable: every rule has a concrete example and, where possible,
a tool that checks it automatically.

---

## 1. Git commits

### Format — Conventional Commits with workspace scopes

```
<type>(<scope>): <imperative summary, ≤72 chars>

<optional body: what & why, not how>
```

- **type**: `feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `perf` | `ci`
- **scope**: the workspace that changed — `admin`, `api`, `worker`, `agent`, `core`,
  `database`, `ai-client`, `shared`, `connector`. Multi-package changes: use the *primary*
  package, or omit the scope for repo-wide chores.

```
feat(admin): add guest invite management panel
fix(agent): bound known-facts block to last 3 job searches
refactor(core): extract reply orchestration from worker main.ts
chore: untrack .env and rotate secrets
```

### Rules

- **One logical change per commit.** A migration + repository + route + UI for one feature is
  fine in one commit; "fix polling AND add auth AND update prompt" is three commits.
- **Imperative mood** ("add", not "added"/"adds"). The summary completes the sentence
  *"If applied, this commit will …"*.
- **Body explains why** when the diff doesn't: link the plan doc
  (`docs/plans/guest-chat-access.md`), the tradeoff taken, or the bug reproduced.
- **Never commit**: `.env` or any file with real secrets, `logs/`, uploaded user files,
  build output (`.next/`, `dist/`, `.turbo/`), lockfiles of other package managers.
  `.gitignore` covers these — do not force-add around it.
- **Branches**: `feat/<short-slug>`, `fix/<short-slug>` (e.g. `feat/guest-chat-access`).
  Keep `master` deployable; anything experimental lives on a branch.

---

## 2. Folder structure & components

### App-level layout (target state for `apps/admin`)

```
apps/admin/src/
  app/                        # App Router: ONLY routing concerns
    layout.tsx
    page.tsx                  # thin: server component that composes features
    guest/[code]/page.tsx
    api/                      # route handlers: thin HTTP adapters (see §7)
  components/                 # reusable UI, no data fetching inside
    ui/                       # primitives: Button, Modal, Toast, Spinner
    chat/                     # feature components: MessageBubble, ChatTimeline, Composer
    inspector/                # AuditCard, PromptsManager, ...
  hooks/                      # useConversations, useMessages, useGuestSession (SWR wrappers)
  lib/                        # non-React code: db.ts, fetcher.ts, format.ts
    types.ts                  # shared client/server types (see §8)
    constants.ts              # shared constants (see §3)
```

Rules:

- **`app/` contains routing only.** A `page.tsx` should read like a table of contents —
  compose components, pass initial data. If a `page.tsx` exceeds ~150 lines, extract.
  (Current `page.tsx` is 1,514 lines — the anti-example this section exists to prevent.)
- **One component per file**, named the same as the file. Subcomponents used only by one
  parent may live in the parent's file if <30 lines; otherwise, own file.
- **Colocate by feature, not by kind** inside `components/` (`chat/`, `inspector/`), except
  true primitives which go in `ui/`.
- **Server Components by default.** Add `"use client"` only to leaf components that need
  state, effects, or browser APIs. Never put `"use client"` on a layout or page unless the
  whole route is genuinely interactive — push it down to the smallest subtree.
- **Data flows down, events flow up.** Components receive data via props or their own hook;
  they never reach into a global store that doesn't exist yet, and they never `fetch` directly
  (that's what `hooks/` is for).

### Monorepo layering (already established — keep it)

```
shared/config → database → agent → core → { api, worker, admin }
```

- The admin imports **`@platform/core`** for business logic. Importing `@platform/database`
  directly from a route handler is allowed only for plumbing (`getRepos()` in `lib/db.ts`);
  query/transform logic belongs in `core`.
- Never import from another package's internals (`@platform/agent/src/...`) — only through
  its `exports` map (`@platform/agent`, `@platform/agent/cv-extractor`).

---

## 3. Constants & file naming

### File naming

| Thing | Convention | Example |
|---|---|---|
| Component files | PascalCase `.tsx` | `MessageBubble.tsx` |
| Hooks | camelCase, `use` prefix | `useConversations.ts` |
| Non-React modules | kebab-case | `known-facts.ts`, `api-proxy.ts` |
| Route handlers | Next.js convention | `route.ts`, `page.tsx`, `layout.tsx`, `proxy.ts` |
| Tests | same name + `.test.ts(x)` next to the source | `known-facts.test.ts` |
| SQL migrations | zero-padded ordinal + snake_case | `05_guest_access.sql` |
| Docs/plans | kebab-case in `docs/` / `docs/plans/` | `guest-chat-access.md` |

Pick one style per category and never mix (`MessageBubble.tsx` and `message-bubble.tsx` must
not coexist — kebab vs Pascal mismatches break case-insensitive→sensitive filesystem moves).

### Constants

- **No magic values inline.** Anything used twice, or once-but-meaningful, gets a named
  constant: `const POLL_INTERVAL_MS = 5000`, `const MAX_AGENT_STEPS = 8`.
- **Placement ladder** — put a constant at the *narrowest* scope that covers all its users:
  1. Module-level `const` in the file that uses it.
  2. `src/lib/constants.ts` when shared across the app.
  3. `@platform/shared` when shared across services (e.g. channel names, event kinds).
- **Naming**: `SCREAMING_SNAKE_CASE` for true constants; PascalCase for constant *objects/maps*
  used as lookup tables (`EmojiByCode`). Suffix units: `_MS`, `_BYTES`, `_VND`.
- **Env vars are not constants.** Read them in one place per package (a `env.ts` validated
  with zod — `ai-client` already does this correctly), export typed values, and never sprinkle
  `process.env.X` through components. Client-exposed vars must be `NEXT_PUBLIC_*` and must
  never hold secrets.

---

## 4. Shared components

- **Promote on the second consumer, not the first.** Build components inside the feature
  folder; move to `components/ui/` when a second feature needs them. Don't design "reusable"
  components speculatively.
- **Primitives (`ui/`) are dumb**: props in, JSX out. No fetching, no `process.env`, no
  router. They accept `className` and merge it (`clsx`/`tailwind-merge`) so callers can adjust
  spacing without forking the component.
- **Variants via a `variant` prop**, not boolean explosions:
  `<Button variant="primary" | "ghost" | "danger">`, not `<Button isPrimary isGhost>`.
- **Memoize list-item components** (`React.memo`) — anything rendered inside a `.map()` over
  polled data (MessageBubble, AuditCard, ConversationListItem). Keep their props primitive or
  stable so memo actually works.
- **Cross-app sharing**: if a second Next.js app appears (e.g. a standalone guest app), create
  `packages/ui` with the same `exports`-map pattern as the other `@platform/*` packages and add
  it to `transpilePackages`. Until then, don't.
- Every shared component ships with: typed props (exported interface), sensible defaults,
  and — for interactive ones — keyboard/aria basics (buttons are `<button>`, modals trap focus,
  icons get `aria-hidden`).

---

## 5. Lint & pre-push

### Layers of enforcement (fast → slow)

1. **Editor**: Prettier on save; ESLint surfaced inline.
2. **Pre-commit** (husky + lint-staged): format + lint only *staged* files — keeps commits fast.
3. **Pre-push**: typecheck + tests for affected packages.
4. **CI**: full `turbo run lint typecheck test build` — the source of truth. Local hooks are
   a convenience; CI is the gate.

### Setup (repo root)

```bash
pnpm add -D husky lint-staged
pnpm husky init
```

`.husky/pre-commit`
```bash
pnpm lint-staged
```

`.husky/pre-push`
```bash
pnpm turbo run typecheck test --filter="...[origin/master]"   # only affected packages
```

`package.json` (root)
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix --max-warnings=0"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### Lint policy

- `--max-warnings=0` — warnings rot; either it's a rule or it isn't.
- No `eslint-disable` without a comment explaining why, and never file-wide disables.
- Add `@typescript-eslint/no-explicit-any: error` (current code has `rawPayload?: any` &
  friends — fix by typing, not disabling; see §8).
- Keep the flat `eslint.config.js` at root as the single source; per-package configs may only
  *extend* it.
- Never bypass with `git commit -n` / `git push --no-verify` except for genuine emergencies,
  and say so in the commit body.

---

## 6. Testing core data

**Priority order — test where the risk is:**

1. **Pure business logic in `@platform/core` / `@platform/agent`** (highest value):
   known-facts extraction, reply parsing/fallbacks, requirement extraction, guest session
   verification. These are pure functions — test them exhaustively with table-driven cases,
   including malformed input (the LLM *will* produce garbage; tests must cover fence-stripped
   JSON, missing fields, wrong types).
2. **Repositories against a real Postgres** (integration): spin up the docker `platform-db`
   (or a disposable schema on Neon) and run repository methods against real SQL — mocked `pg`
   tests prove nothing about SQL. Focus: tenant scoping (query for tenant A must never return
   tenant B rows), idempotency keys (double insert → single row), cursor pagination bounds.
3. **Route handlers** (thin, so few tests): validation rejects bad payloads, auth rejects
   missing/invalid tokens, happy path returns the documented shape. Mock the `core` layer here,
   not the DB.
4. **Components**: only ones with logic (timeline merging/ordering, optimistic message
   reconciliation). Skip snapshot tests of styling.

### Rules

- **Mock at the module boundary, never inside.** `router.test.ts` mocking `@platform/ai-client`
  is the house pattern — an LLM call is mocked as "the client returns X", not by faking fetch.
- **No live-network tests.** Anything touching OpenRouter/Twenty runs only behind an explicit
  opt-in env flag, and never in CI.
- **Deterministic fixtures**: seed data lives in code (`packages/testing`), not in a shared
  dev DB. Time-dependent logic takes a clock/timestamp parameter (the codebase already avoids
  `Date.now()` in core paths — keep it that way).
- **Every bug fix lands with the test that would have caught it** (the stale
  `registry.test.ts` expectation went unnoticed because tests weren't run pre-push — §5 fixes
  the process, this rule fixes the coverage).
- Tests live next to the source (`known-facts.ts` + `known-facts.test.ts`), run with vitest via
  `turbo run test`, and `--passWithNoTests` is a temporary crutch, not a policy — a package
  with real logic and zero tests fails review.

---

## 7. Split client vs backend logic

### The three layers, and what's allowed in each

```
Client components (hooks/, components/)   → render + interaction ONLY
Route handlers (app/api/**/route.ts)      → HTTP adapter ONLY
@platform/core (+ database)               → ALL business logic
```

**Route handlers are ≤40-line adapters.** Their entire job:

```ts
export const runtime = "nodejs";
export const maxDuration = 60;            // any route that runs the agent

const Body = z.object({ text: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireGuestSession(req, params);        // 1. authn/authz
  if (!auth.ok) return jsonError(401, "unauthorized");
  const body = Body.safeParse(await req.json());              // 2. validate (zod)
  if (!body.success) return jsonError(400, "invalid body");
  try {
    const result = await sendGuestMessage(getRepos(), auth.guest, body.data); // 3. delegate to core
    return NextResponse.json({ ok: true, ...result });        // 4. serialize
  } catch (err) {
    console.error("[guest/messages]", err);                   // log detail server-side
    return jsonError(500, "internal error");                  // NEVER leak err.message to client
  }
}
```

- **Validate every input with zod at the HTTP boundary** — body, query params, route params.
  Inside `core`, types are trusted; at the edge, nothing is.
- **Error responses are generic**; details go to server logs. (Current handlers return raw
  `err.message` — migrate them to this pattern.)
- **Auth on every route** — the proxy gives coarse Basic Auth, but each handler still checks
  what it specifically needs (guest token, tenant scope). Defense in depth.
- **Business logic lives in `@platform/core`** so worker, API, and admin share one
  implementation (`generateAndSaveReply` is the model — one function, three callers). If a
  route handler contains a loop, a transform, or a multi-step DB sequence, extract it to core.

### Client side

- Client components never build SQL-ish logic, never receive secrets, never see other tenants'
  data — the server shapes the payload to exactly what the UI renders
  (`server-serialization`: don't ship 50 fields to render 4).
- All client data access goes through `hooks/` (SWR): components stay declarative; caching,
  polling, dedup, and error state live in one place.
- Long-running AI actions: the route sets `maxDuration`, the client shows optimistic state and
  reconciles from the next poll — no client-side spinning on a 60s fetch without timeout
  handling.

### Server components vs route handlers

- Pages/server components fetch **directly through `core`** (no HTTP hop to your own
  `/api/*` — that's an extra serverless invocation and a serialization tax).
- Route handlers exist for *client-initiated* mutations and polling — not for server-to-itself
  reads.

---

## 8. Types

- **`strict: true` stays on** (already in `tsconfig.base.json`). No new `any` — for unknown
  external data use `unknown` and narrow with zod/type guards.
  ```ts
  // ✗  const attachments = (m.rawPayload as any)?.attachments || [];
  // ✓
  const RawPayload = z.object({
    attachments: z.array(Attachment).optional(),
    quote: z.object({ msg: z.string().optional(), text: z.string().optional() }).optional(),
    reactions: z.array(z.object({ emoji: z.string() })).optional(),
  }).partial();
  type RawPayload = z.infer<typeof RawPayload>;
  ```
- **One source of truth per shape.** Derive, don't duplicate:
  - DB row types (`MessageRow`) live in `@platform/database`.
  - API/DTO types (camelCase, serialized) live next to the `core` function that produces them —
    export them and import them in the client (`lib/types.ts` re-exports for convenience).
    The current situation — `Conversation`/`Message`/`Audit` hand-retyped inside `page.tsx`,
    drifting from what routes return (snake_case `tenant_id` in `Audit`, camelCase in
    `Message`) — is the anti-pattern: when the server changes, the client types must fail to
    compile, not silently disagree.
  - Where zod schemas exist, **infer** (`z.infer<typeof X>`) instead of writing the interface
    twice.
- **Unions over string + comment**: `type HrSkillMode = "mock" | "default" | "twenty"`,
  `direction: "inbound" | "outbound"`. Exhaustive `switch` with `never` check for behavior
  keyed on unions.
- **No unsafe casts** (`as HrSkillMode`-style). Parse/resolve instead
  (`resolveHrSkillMode(process.env.HR_SKILL_MODE)` is the house pattern now).
- **Type-only imports** (`import type { … }`) for types — keeps runtime bundles clean and
  makes intent visible.
- Function signatures: explicit return types on exported functions in `packages/*`
  (API surface); inference is fine for internal helpers and components.

---

## 9. Quick checklist (PR review card)

- [ ] Commit messages: `type(scope): imperative summary`; no secrets/artifacts in the diff
- [ ] New UI logic is in `components/` + `hooks/`, not appended to a `page.tsx`
- [ ] `"use client"` only on leaf components that need it
- [ ] No magic values; constants named with units; env read through validated `env.ts`
- [ ] Route handlers: zod-validate input, auth check, delegate to `core`, generic errors
- [ ] No new `any`; external data parsed with zod; DTO types imported, not re-declared
- [ ] List items memoized; no new polling loops (SWR only); no `alert()`
- [ ] Tests: new logic in `core`/`agent` has unit tests; bug fixes include regression test
- [ ] `pnpm turbo run lint typecheck test` passes locally before push
