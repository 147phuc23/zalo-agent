# Error Handling & Logging — Convention + Implementation Guide

Status: **to implement** (code below is ready to paste; nothing in this doc is applied yet).

---

## 1. The convention (the "what is best practice" answer)

### Log prefix: `[module:flow]`

Two coordinates identify every log line:

- **module** = *where the code lives*: `<package>/<area>` — `agent/router`, `agent/skills`,
  `admin/api`, `worker/main`, `core/reply`. Stable, matches the folder structure, greppable.
- **flow** = *which business flow was running*: `classify-intent`, `ai-reply`, `cv-upload`,
  `guest-login`, `message-ingest`. This is what you actually search for when debugging
  ("show me everything in the ai-reply flow").

Do **not** put raw file paths in the prefix (`src/core/router.ts:61` churns on every refactor
and adds no search value — module+flow is the durable version of the same idea). Stack traces
already carry exact file/line when an error is attached.

### Output format

- **Development**: human-readable — `[ERROR] [agent/router:classify-intent] message {ctx}`.
- **Production (Vercel/NODE_ENV=production)**: one JSON object per line:
  ```json
  {"ts":"2026-07-14T09:00:00.000Z","level":"error","module":"agent/router","flow":"classify-intent","conversationId":"c1","msg":"LLM call failed","err":{"name":"Error","message":"...","stack":"..."}}
  ```
  JSON lines are what Vercel log drains / Datadog / Axiom parse natively. Never build this by
  string concatenation — always via the logger.

### Levels

| Level | Use for | Examples |
|---|---|---|
| `debug` | High-volume tracing, off by default | prompt sizes, cache hits |
| `info`  | Normal state changes worth an audit trail | "reply generated", "guest claimed invite" |
| `warn`  | Degraded but handled — a fallback fired | "classifier failed, defaulting to HR_SPECIALIST" |
| `error` | A flow failed; someone may need to act | unhandled route error, DB unreachable |

`LOG_LEVEL` env var filters (default `info`).

### Rules

1. **Log once, at the boundary that handles the error.** If you catch-and-rethrow, don't also
   log — the final handler logs. One failure = one error line, not five.
2. **Context object, not string interpolation**: `log.error("send failed", err, { conversationId })`
   — searchable fields beat prose.
3. **Never log secrets** (tokens, passwords, API keys, `authorization` headers) **or full
   message/prompt bodies** (PII). Log lengths/ids instead: `{ textLength: 812 }`.
4. **Clients get generic errors; logs get details.** No `err.message` in any JSON response.
5. **Every fallback logs a `warn`** — silent fallbacks hide real outages (you'd never know the
   classifier has been down for a week).

---

## 2. Step 1 — Logger utility in `@platform/shared`

New file `packages/shared/src/logger.ts` (zero deps, works in Node and Next.js server runtime):

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;
export type SerializedError = { name: string; message: string; stack?: string };

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
  /** Derive a logger for a specific flow within the same module. */
  flow(flow: string): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error) };
}

function emit(
  module: string,
  flow: string | undefined,
  level: LogLevel,
  message: string,
  error?: unknown,
  context?: LogContext,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isProduction()) {
    sink(JSON.stringify({
      ts: new Date().toISOString(),
      level, module, flow, msg: message,
      ...(context ?? {}),
      ...(error !== undefined ? { err: serializeError(error) } : {}),
    }));
    return;
  }

  const prefix = `[${level.toUpperCase()}] [${module}${flow ? `:${flow}` : ""}]`;
  const parts: unknown[] = [`${prefix} ${message}`];
  if (context && Object.keys(context).length > 0) parts.push(context);
  if (error !== undefined) parts.push(error);
  sink(...parts);
}

export function createLogger(module: string, flow?: string): Logger {
  return {
    debug: (m, c) => emit(module, flow, "debug", m, undefined, c),
    info:  (m, c) => emit(module, flow, "info", m, undefined, c),
    warn:  (m, c) => emit(module, flow, "warn", m, undefined, c),
    error: (m, e, c) => emit(module, flow, "error", m, e, c),
    flow: (nextFlow) => createLogger(module, nextFlow),
  };
}
```

Wire-up:
- `packages/shared/src/index.ts`: add `export * from "./logger.js";`
- Consumers that don't yet depend on shared need `"@platform/shared": "workspace:*"` added:
  check `packages/agent`, `packages/core`, `apps/admin` (admin's `next.config.ts` already has
  `@platform/shared` in `transpilePackages`, so only package.json needs the dep).

Usage pattern — one logger per file, derive flows:

```ts
const log = createLogger("agent/router");
// inside a function:
log.flow("classify-intent").warn("LLM failed, using fallback", { model });
```

Suggested test (`packages/shared/src/logger.test.ts`): assert (a) dev prefix format,
(b) prod output is parseable JSON containing `module`/`flow`/`err.name`, (c) `LOG_LEVEL=error`
suppresses `info`/`warn`, (d) `serializeError` handles non-Error values. Mock `console.*` with
vitest `vi.spyOn` and restore env in `afterEach`.

---

## 3. Step 2 — Timeout support in `@platform/ai-client`

`OpenRouterAiClient.generate` currently has no timeout — a hung upstream call runs until the
serverless function is killed. Add to `GenerateInput`:

```ts
export type GenerateInput = {
  // ...existing fields...
  /** Abort after this many ms (default 30_000). Ignored when abortSignal is provided. */
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};
```

And in `generate()` pass the signal to fetch (Node 18+ has `AbortSignal.timeout`):

```ts
const response = await fetch(url, {
  method: "POST",
  headers: { /* ... */ },
  body: JSON.stringify({ /* ... */ }),
  signal: input.abortSignal ?? AbortSignal.timeout(input.timeoutMs ?? 30_000),
});
```

Note: the retry branch (json_object unsupported) recurses into `this.generate` — pass the
original `timeoutMs`/`abortSignal` through so the retry is also bounded.

---

## 4. Step 3 — Router fallbacks (`packages/agent/src/core/router.ts`)

Both exported functions must never throw on upstream failure — one OpenRouter 5xx currently
kills the whole reply. Wrap the LLM call (not just the JSON parse):

```ts
import { createLogger } from "@platform/shared";
const log = createLogger("agent/router");

export async function classifyIntent(messages, model = "tencent/hy3:free", knownFacts?) {
  const client = new OpenRouterAiClient();
  // ...build prompt as today...
  let response;
  try {
    response = await client.generate({
      model, system: CLASSIFIER_SYSTEM_PROMPT, prompt,
      temperature: 0.1,
      responseFormat: { type: "json_object" },
      timeoutMs: 15_000,               // classification is cheap; fail fast
    });
  } catch (err) {
    log.flow("classify-intent").warn("LLM call failed, falling back to HR_SPECIALIST", { model, err: String(err) });
    return { category: "HR_SPECIALIST", reason: "Fallback: classifier unavailable." };
  }
  // ...existing parse + parse-fallback logic (keep; move its console.error to log.warn)...
}

export async function generateChitchatReply(messages, model = "tencent/hy3:free", knownFacts?) {
  // ...build prompt as today...
  try {
    const response = await client.generate({ model, system: CHITCHAT_SYSTEM_PROMPT, prompt, temperature: 0.7, timeoutMs: 20_000 });
    return response.text;
  } catch (err) {
    log.flow("chitchat-reply").warn("LLM call failed, using canned reply", { model, err: String(err) });
    return "Xin lỗi, hệ thống đang hơi bận. Bạn nhắn lại giúp mình sau ít phút nhé! 🙏";
  }
}
```

Design choices (deliberate — keep them):
- **Classifier fallback = `HR_SPECIALIST`**, matching the existing parse-failure fallback:
  wrongly routing chitchat to the specialist is harmless; dropping a job request is not.
- **Chitchat fallback = canned apology**, so the candidate always gets *something*.
- Both are `warn`, not `error` — the flow succeeded degraded. Add a test per fallback
  (mock `@platform/ai-client` to throw, assert the fallback value — same mocking pattern as
  the existing `router.test.ts`).

---

## 5. Step 4 — Skill tool error wrapper (`packages/agent/src/skills/`)

Today, if any tool's `execute` throws mid-loop, the entire `generateText` agent run dies.
Best practice: a failed tool returns a **structured error result** so the model can react
("tool unavailable, apologize / try another way"), and the failure is logged once.

New file `packages/agent/src/skills/tool-error-handling.ts`:

```ts
import { createLogger, serializeError } from "@platform/shared";

const log = createLogger("agent/skills");

type AnyTool = { execute?: (...args: never[]) => Promise<unknown> };

/** Wrap every tool's execute so a failure logs once and returns a structured error
 *  result instead of aborting the whole agent run. */
export function withToolErrorHandling<T extends Record<string, AnyTool>>(tools: T): T {
  const wrapped = Object.fromEntries(
    Object.entries(tools).map(([name, t]) => {
      if (!t.execute) return [name, t];
      const original = t.execute.bind(t);
      return [name, {
        ...t,
        execute: async (...args: never[]) => {
          try {
            return await original(...args);
          } catch (err) {
            log.flow(name).error("tool execution failed", err);
            return { ok: false, error: `Tool ${name} is temporarily unavailable.`, detail: serializeError(err).message };
          }
        },
      }];
    }),
  );
  return wrapped as T;
}
```

Apply at the end of both factories:

- `skills/registry.ts` → `return withToolErrorHandling({ skills_search: ..., ... });`
- `skills/twenty/registry.ts` → same.

Notes:
- The `runner.ts` `onStepFinish` audit logging still records these results (status can be
  derived from `ok: false`) — no change needed there.
- The registry tests assert tool *names*, so wrapping (which preserves keys) won't break them.
- Do **not** include stack traces in the returned result — the model doesn't need them and
  they'd end up in the audits table; `detail` carries only the message.

---

## 6. Step 5 — Admin API route sweep

### Helper — `apps/admin/src/lib/api-helpers.ts`

```ts
import { NextResponse } from "next/server";
import { createLogger, type Logger } from "@platform/shared";

export const apiLog = createLogger("admin/api");

export function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Catch-all for route handlers: logs detail server-side, returns a generic message. */
export function handleRouteError(log: Logger, err: unknown, context?: Record<string, unknown>) {
  log.error("unhandled route error", err, context);
  return jsonError(500, "Internal error");
}
```

### Pattern — before / after

```ts
// BEFORE (leaks internals, no structured log)
} catch (err: any) {
  console.error("upload failed:", err?.stack ?? err?.message ?? err);
  return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
}

// AFTER
} catch (err) {
  return handleRouteError(apiLog.flow("cv-upload"), err, { conversationId });
}
```

For *expected* failures keep specific-but-generic messages with correct status codes:
`jsonError(400, "invalid body")`, `jsonError(404, "conversation not found")`,
`jsonError(401, "unauthorized")` — never the raw upstream/DB error text.

### Checklist — routes currently returning `err.message` (grep-verified 2026-07-14)

- [ ] `api/conversations/[conversationId]/cv/route.ts` (flow: `cv-upload`; also returns upstream body text — replace)
- [ ] `api/conversations/[conversationId]/messages/[messageId]/ai-react/route.ts` (`ai-react`)
- [ ] `api/conversations/[conversationId]/messages/[messageId]/ai-reply/route.ts` (`ai-reply`)
- [ ] `api/conversations/[conversationId]/model/route.ts` (`set-model`)
- [ ] `api/conversations/[conversationId]/read/route.ts` (`mark-read`)
- [ ] `api/conversations/new/route.ts` (`new-conversation`)
- [ ] `api/events/route.ts` (`message-ingest`)
- [ ] `api/inbox/conversations/route.ts` (`list-conversations`)
- [ ] `api/prompts/route.ts` (`prompts`)
- [ ] `api/guest/[code]/claim/route.ts` (`guest-claim`)
- [ ] `api/guest/[code]/login/route.ts` (`guest-login`) — **extra care: never log the password or session secret**
- [ ] `api/guest/[code]/me/route.ts` (`guest-session`)

Also (not leaking today, but add the same try/catch + logger for consistency):
`audits`, `models`, `export`, `guest/state`, `guest/messages`, `admin/guests`,
`admin/guests/[id]/revoke`, `inbox/conversations/[conversationId]/messages`.

Worker/API services: same logger works there — replace the ad-hoc `console.log("[worker] ...")`
prefixes with `createLogger("worker/main").flow("message-flow")` etc. incrementally as files
are touched (no big-bang rename needed; both formats grep the same in the interim).

---

## 7. Step 6 — Minimal UI error surface (until the SWR refactor)

Every `catch` in `page.tsx` currently swallows into `console.error`. Minimal fix without
restructuring:

```tsx
const [errorToast, setErrorToast] = useState<string | null>(null);
const showError = (msg: string) => {
  setErrorToast(msg);
  window.setTimeout(() => setErrorToast(null), 6000);
};
```

- Call `showError("Failed to send message")`, `showError("AI reply failed or timed out")`, etc.
  from the catch blocks AND from `if (!data.ok)` branches of: send message, ai-reply, ai-react,
  create chat, save prompt, CV upload. (Read fetches/polling stay silent — a failed poll
  self-heals on the next tick.)
- Render once, near the root:

```tsx
{errorToast && (
  <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
    {errorToast}
  </div>
)}
```

Replace the two `alert()` calls (prompt save, export) with `showError`/a success variant while
you're there. When the SWR refactor lands, SWR's `error` + `onError` global handler supersedes
the per-callsite calls; the toast component stays.

---

## 8. Verification checklist

- [ ] `pnpm --filter @platform/shared test` — logger tests green
- [ ] `pnpm --filter @platform/agent test` — router fallback tests green (mock client throws)
- [ ] `pnpm turbo run typecheck` — all packages
- [ ] `pnpm --filter @platform/admin build` — Next build passes
- [ ] Manual: stop your network / set an invalid `OPENROUTER_API_KEY` locally → send a message
      → candidate still gets the canned chitchat fallback or a toast, server log shows ONE
      structured `warn`/`error` line with `[module:flow]`, and the response body contains no
      internal error text
- [ ] Grep gate before commit: `grep -rn "error: err" apps/admin/src/app/api` returns nothing
```
