# Plan: Run the AI Agent Reply inside Next.js

Goal: generate an AI reply **inline in a Next.js route** (admin), so producing a draft
reply no longer needs the Redis queue + worker. The admin becomes able to generate
replies on its own.

---

## ⚠️ Read this first — does this even make sense for you?

Your **Zalo connector** (`services/zalo-connector`, run via `zalo:listen`) is a
**persistent process**: it holds a live Zalo client connection AND consumes the
`message.send` queue to deliver replies to customers. It **cannot run on serverless**.

So decide:

- **You run the Zalo connector** (the bot sends/receives real Zalo messages):
  → You already need an always-on host + Redis for the connector. **Don't do this plan.**
  Just run the worker on that same host (connector + worker + Redis in one place).
  Moving the agent into Next.js buys you nothing and adds complexity.

- **Your Zalo integration is webhook-based / you have no persistent connector, and you
  want fully serverless:** → this plan applies.

**This plan only covers generating + saving a draft reply.** Delivering that reply to the
customer on Zalo still requires the connector (or a direct Zalo send HTTP API), which is
out of scope here.

---

## Two hard blockers to engineer around

1. **Skills load from disk at runtime.** `skill-cache.ts` does `fs.readdir` / `fs.readFile`
   over a skills directory. Webpack does **not** bundle arbitrary runtime file reads. Fix
   by either:
   - `outputFileTracingIncludes` in `next.config.ts` to ship the skill files, **or**
   - (cleaner, recommended) refactor `skill-cache` to **statically import** skill
     definitions so they're bundled as code. More work, but robust on serverless.
2. **`maxDuration`.** Agent runs up to `maxSteps: 8`. Set the route's `maxDuration`
   (60s Hobby / 300s Pro). Typical replies finish in 5–20s; worst case can approach 60s.

Also: pass `useLocalCache: false` when calling the agent from Next.js — the on-disk cache
path won't work on Vercel's read-only FS (only `/tmp` is writable).

---

## Architecture (after)

```
admin ai-reply route (Next.js, nodejs runtime, maxDuration set)
   → @platform/agent  (runner + router + skills + caches)
   → OpenRouter (OPENROUTER_API_KEY)
   → saves draft via getRepos()  (direct Neon)
admin polls → sees the new draft message
```

No Redis, no worker — **for draft generation only**.

---

## Steps

### 1. Extract the agent into `@platform/agent`
Move `services/worker/src/agent/**` → `packages/agent/src/**`.
- `package.json`: `"exports": { ".": "./src/index.ts" }` (source, like the other packages).
- deps: `@platform/ai-client`, `ai`, `zod`, and `@platform/database` only if needed by
  the profile loader (mock mode doesn't need it).
- `src/index.ts` re-exports `runHrAgentScenario`, `classifyIntent`, `generateChitchatReply`.
- Add `@platform/agent` to `transpilePackages` in `apps/admin/next.config.ts`.

### 2. Fix skill loading for serverless (pick one)
- **A (quick):** `next.config.ts` →
  ```ts
  outputFileTracingIncludes: { "/api/**": ["../../packages/agent/src/agent/skills/**"] }
  ```
  (adjust the glob to wherever the skill definition files live)
- **B (robust):** refactor `skill-cache.ts` to import skill modules statically instead of
  reading a directory. Eliminates the runtime FS dependency entirely.

### 3. Extract the reply orchestration into `@platform/core`
Pull the meat of `generateDraftReply` (worker `main.ts`) into a pure function:
```ts
// packages/core/src/reply.ts
export async function generateAndSaveReply(repos, deps, input: {
  tenantId: string;
  conversationId: string;
  targetMessageId?: string;
}) {
  // load messages + conversation + contact (repos)
  // classifyIntent → chitchat OR agent run (runHrAgentScenario, useLocalCache:false)
  // parse responses → repos.messages.createOutbound(...) for each
  // return the saved draft messages
}
```
Strip out the worker-only bits:
- **SSE publish** → remove (no Redis); the admin polls instead. Optionally accept an
  `onMessage` callback so the caller can react.
- **`enqueueZaloMessage`** (outbound send) → remove from this path, or accept an optional
  `send` callback. Sending to the customer stays the connector's job.
- **session cache / debounce / abort** → drop for the manual `ai-reply` case (those exist
  to bundle bursts of inbound webhook messages; not needed when a human clicks "reply").

### 4. Rewrite the admin `ai-reply` route to run inline
```ts
// apps/admin/src/app/api/conversations/[conversationId]/messages/[messageId]/ai-reply/route.ts
import { NextResponse } from "next/server";
import { generateAndSaveReply } from "@platform/core";
import { getRepos } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60; // 300 on Pro

export async function POST(_req: Request, { params }) {
  const { conversationId, messageId } = await params;
  const tenantId = process.env.TENANT_ID!;
  try {
    const drafts = await generateAndSaveReply(getRepos(), {}, {
      tenantId, conversationId, targetMessageId: messageId,
    });
    return NextResponse.json({ ok: true, drafts });
  } catch (err: any) {
    console.error("[ai-reply]", err?.stack ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
```
Do the same shape for `ai-react` (it's a single short LLM call — easier, no skills).

### 5. Admin reflects the draft via polling
Already covered by the polling plan — the new draft message appears on the next poll of
the messages endpoint. (Optionally, return the drafts from the route and append them
optimistically.)

---

## Env to add (admin Vercel project)

| Variable | Value |
|---|---|
| `OPENROUTER_API_KEY` | your OpenRouter key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `HR_SKILL_MODE` | `default` (or `twenty`) |
| `TWENTY_BASE_URL`, `TWENTY_API_KEY` | only if `HR_SKILL_MODE=twenty` |

(plus the `PLATFORM_DB_URL` + `TENANT_ID` it already needs)

---

## What you still DON'T get from this

- **Delivery to the customer on Zalo** — needs the connector (persistent) or a direct Zalo
  send API. Drafts are generated + saved only.
- **Auto-reply to inbound webhook messages with debounce/abort** — the burst-bundling and
  cancel-on-newer-message logic depends on a stateful long-running worker. A serverless
  version would be simpler and lossy.
- **Durable retries** — if the function times out mid-run, the draft is lost; the human
  clicks again.

---

## Honest recommendation

If you're running the **Zalo connector at all**, you have an always-on host already — put
the worker there and skip this. Do this plan **only** if you're going fully serverless with
a webhook-based Zalo integration and accept the limits above. The cleanest long-term split
is usually: **admin on Vercel (reads direct-to-DB) + connector/worker/Redis on one small
always-on host (Railway/Render/Fly).**
