# Admin App — Next.js Best-Practice Refactor & Performance Review

Reviewed: `apps/admin` (Next.js 16, App Router). Main offender: `src/app/page.tsx` — a single
1,514-line `"use client"` component holding all state, fetching, polling, and UI.
Rule IDs in parentheses refer to Vercel's React best-practices catalog.

---

## P0 — Bugs and things that waste real money/requests

### 1. Duplicate polling loops — every request fires twice
`page.tsx:259-271` (10s interval) and `page.tsx:285-309` (5s interval) are two effects keyed on
`[selectedId]` that call the same three fetches (`fetchConversations`, `fetchMessages`,
`fetchAudits`). Every open tab does ~2× the serverless invocations and DB queries it needs.
**Fix:** delete the 10s effect entirely; the 5s visibility-gated one already covers it.

### 2. No request deduplication, caching, or abort (`client-swr-dedup`)
All fetching is hand-rolled `fetch` + `useState`. Consequences:
- Overlapping polls: if a poll takes >5s (cold Neon, slow agent), responses race and an older
  response can overwrite a newer one (no `AbortController`, no sequencing).
- Switching conversations doesn't cancel the previous conversation's in-flight fetches —
  messages from conversation A can land after you selected B.
- Every poll `setState`s a brand-new array even when nothing changed → full timeline re-render
  every 5 seconds.

**Fix:** adopt **SWR** (Vercel's own, smallest fit) or React Query:
```tsx
const { data: conversations } = useSWR("/api/inbox/conversations", fetcher, { refreshInterval: 5000 });
const { data: messages } = useSWR(selectedId ? `/api/inbox/conversations/${selectedId}/messages` : null, fetcher, { refreshInterval: 5000 });
```
This gives dedup, focus revalidation, keeps stale data referentially equal (kills the re-render
storm), per-key caching when switching conversations, and `mutate()` for clean optimistic sends.
It replaces both polling effects, `fetchConversations/fetchMessages/fetchAudits/fetchPromptTemplates`,
and the visibilitychange listener (~120 lines deleted).

### 3. `/api/export` writes to the local filesystem
`api/export/route.ts` walks up directories looking for `logs/` and writes a file — breaks on
Vercel (read-only FS) and is a path-traversal risk (`filename` is not sanitized, so
`../../x` escapes `logs/`). **Fix:** return the markdown as a download
(`Content-Disposition: attachment`) and build it client-side with a Blob — no server FS at all.
This also removes the `alert()`-based UX.

### 4. Silent failure everywhere
Every handler catches and `console.error`s — the operator sees nothing when a send, AI reply, or
prompt save fails (and the AI routes can legitimately 504 at 60s). **Fix:** surface errors in UI
state (toast/inline banner). SWR's `error` field gives this for free on the read paths.

---

## P1 — Component architecture (the 1,514-line client component)

### 5. Split `page.tsx` into components + hooks (`rerender-memo`, maintainability)
Target structure:
```
src/
  components/
    ConversationList.tsx     (sidebar: search + list)
    ChatTimeline.tsx         (merged messages/audits scroller)
    MessageBubble.tsx        (memoized — see #6)
    AuditCard.tsx            (memoized; owns its expand state — see #7)
    MessageComposer.tsx      (input + CV upload button)
    InspectorPanel.tsx       (tabs: audits / prompts)
    PromptsManager.tsx
    NewChatModal.tsx
    AuditDetailModal.tsx
  hooks/
    useConversations.ts, useMessages.ts, useAudits.ts, usePrompts.ts  (SWR wrappers)
  lib/types.ts               (Conversation, Message, Audit, PromptVersion — shared with routes)
```

### 6. Memoize list items (`rerender-memo`)
`mergedTimeline.map(...)` re-renders every bubble whenever *any* state changes (each keystroke in
the composer re-renders the whole timeline, every poll re-renders everything).
`React.memo(MessageBubble)` / `React.memo(AuditCard)` with primitive-ish props stops that.
The emoji-code→emoji mapping at `page.tsx:965-973` should be a module-level `Record` (`js-index-maps`),
and `EMOJI_OPTIONS`/`AVAILABLE_MODELS`/`PRESET_CONTEXTS` stay module-level (already correct).

### 7. Per-item UI state lives in parent maps
`expandedAudits`, `activeActions`, `activeReactionPickerMessageId` are parent-level maps —
toggling one audit re-renders the whole page. Move expand state *into* `AuditCard`; keep only
truly shared state up top.

### 8. `renderActionButtons` is a render function closing over parent state
(`rerender-no-inline-components`) — convert to a `<MessageActions messageId direction />`
memoized component; pass stable callbacks (`rerender-functional-setstate` already used — good).

### 9. JSON.stringify in render (`js-cache-function-results`)
Every render stringifies every audit's input/output twice (`page.tsx:1011-1012`, again in the
inspector at 1250-1257, again in the modal). With big tool payloads this is real main-thread
work every 5s poll. Memoize inside `AuditCard` (`useMemo` keyed on `audit.id`), and render large
payloads only when expanded (already partially true — keep it that way after the split).

---

## P2 — Next.js platform usage

### 10. Fetch initial data on the server (`server-*`, streaming)
The page is 100% client: the user gets an empty shell, then a fetch waterfall
(models → conversations → prompts fire in parallel, but only after hydration).
With App Router the natural shape is: `page.tsx` = server component that fetches the initial
conversation list via `@platform/core` directly (no HTTP hop to your own API), passes it as
`fallbackData` to the client SWR hooks. First paint shows real data; polling takes over after.
Optional (the app is behind auth and fully dynamic, so this is polish, not correctness).

### 11. Global window listeners (`client-event-listeners`, `rerender-move-effect-to-event`)
- `page.tsx:319-327` adds a global click listener just to close the reaction picker — replace
  with a backdrop element or `onBlur`, or at least attach only while a picker is open.
- `page.tsx:147-151` reads `window.innerWidth` in an effect to open the inspector — causes a
  hydration flicker on desktop. Prefer CSS (`lg:flex` default-open) or `matchMedia` in a lazy
  `useState` initializer.

### 12. `scrollToBottom` setTimeout hack
`page.tsx:164-168` scrolls on a 100ms timer and races the render. Use an effect keyed on
`messages.length` (scroll after commit), or `flushSync`-free `ref` callback on the last item.

### 13. Long-list rendering (`rendering-content-visibility`)
Messages/audits are unbounded and fully rendered. Cheap win: `content-visibility: auto` on
bubble wrappers. Real fix (pairs with #14): paginate.

### 14. API payloads grow forever
`listMessages`/`listByConversation` fetch the full history every 5s. Add `?after=<lastCreatedAt>`
cursor support to the messages/audits routes and merge increments client-side (SWR makes this
easy with a custom compare). This is the biggest DB/egress saver as conversations get long.

### 15. Bundle hygiene (`bundle-barrel-imports`, `bundle-dynamic-imports`)
- `lucide-react` is imported as a barrel (`page.tsx:4-30`). Next 16 usually handles it via
  `optimizePackageImports`, but verify with `next build --analyze`; if not, switch to
  `lucide-react/icons/...` deep imports.
- `NewChatModal` and `AuditDetailModal` render only on demand → `next/dynamic` candidates once
  split out (#5).

### 16. Misc cleanups
- Delete dead `src/lib/api-proxy.ts` (never imported) and the no-op `/api/sse` route once the
  client stops calling it.
- `alert()` calls in prompt save/export (`page.tsx:655,713-720`) → toast component.
- `rawPayload?: any`, `(a: any)` casts → type `rawPayload` once in `lib/types.ts` and reuse
  server + client (the route handlers return these exact shapes already).
- Route handlers return raw `err.message` to the client — log server-side, return generic
  messages (security, not perf).
- `AVAILABLE_MODELS` hardcodes a fallback list that can drift from `/api/conversations/models`;
  after #10 the server can inject the real list at render time.

---

## Suggested order of work

1. Delete duplicate 10s poll (5 min, immediate 50% request cut).
2. Introduce SWR hooks + delete hand-rolled fetch/poll plumbing (#2, #4).
3. Split components + memoize list items (#5-#9).
4. Cursor pagination on messages/audits (#14).
5. Fix `/api/export` (#3) and misc cleanups (#16).
6. Optional: server-render initial data (#10), bundle polish (#15).

Items 1-3 remove the two user-visible symptoms (typing lag in long conversations, request storms);
item 4 keeps it fast as data grows.
