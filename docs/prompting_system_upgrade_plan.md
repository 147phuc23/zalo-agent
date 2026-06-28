# Upgrade the HR Agent Prompting System (Conversation Memory)

## Context

The HR recruiter chat agent (`packages/agent`) "doesn't remember much of the conversation." Investigation found three compounding root causes, all in the prompt-assembly layer — not in the callers, which already load up to 100 messages from the DB and pass the full thread in:

1. **History is flattened into one giant text blob, not real chat turns.** `buildPromptCacheContext` dumps the whole conversation as `[USER]:… [ASSISTANT]:…` lines inside a *single* user message (`prompt:` string in `runner.ts:124`). Models track multi-turn dialogue far better when history is passed as a native `messages` array with real `user`/`assistant` roles.
2. **A hard 30-message cap the prompt keeps apologizing for.** `formatState` does `state.history.slice(-30)` (`prompt-cache-context.ts:116`) even though callers pass 100. The system prompt repeatedly tells the model it is "strictly truncated to the last 30 messages" and "you will forget it" (`prompt-cache-context.ts:13,24`) — self-defeating instructions that also waste tokens.
3. **Structured state never survives in production.** `buildInitialState` always sets `requirement: {}` / `intent: undefined` (`runner.ts:188`), then repopulates them only from `getIntent()`/`getHistory()`, which read the **in-memory `mock/store.ts` Map**. On Vercel serverless (admin `core/reply.ts`) every invocation starts with an empty Map; the worker loses it on restart. So requirements saved via tools vanish next turn and the prompt shows `requirement: {}` forever.

**The deeper cause of "keeps asking the same questions again":** within one turn the `ai` SDK keeps tool calls + results in its working message array (up to `maxSteps: 8`), so mid-turn the model sees what `hr_gatherRequirement` / `jobs_search` returned. But **across turns this is lost**. Each new turn is rebuilt only from the plain-text `messages` table; tool results are written to `tool_call_audits` (via `onStepFinish` in `reply.ts:140-154`) but **never read back into any prompt** — the only readers are the admin "view audits" UI and an inbox API endpoint. So on turn N the model cannot see the requirement it extracted on turn N-1 (it was a tool result, never written to the text transcript) and re-asks.

**Two reply paths re-ask, not one (confirmed by the user's screenshot).** `generateAndSaveReply` classifies each message (`classifyIntent`) and routes to either a **chitchat** branch (`generateChitchatReply`) or the **HR agent** branch (`runHrAgentScenario`). The screenshot — where, after a casual "chán quá… đi chơi đâu không?", the bot replies `Bạn đang muốn tìm job ngành gì ạ?` — is the **chitchat** branch. Two bugs there:
- `generateChitchatReply` / `classifyIntent` only see the **last 5 text messages** (`router.ts:102` `formatHistory` slices to 5) and have **no requirement/known-facts context at all**, so they cannot know the role was already given.
- `CHITCHAT_SYSTEM_PROMPT` is explicitly told to "transition" by asking what job the user wants (`router.ts:41`, example at `:44`), so it actively re-asks known fields.

Therefore the Known-Facts snapshot must be injected into **both** branches, and the chitchat prompt must be told never to re-ask a field already present in Known Facts.

**Decisions (confirmed with user):**
- Scope = memory + prompt-quality cleanup.
- Carry tool results across turns by reading the latest tool-call outputs from the **existing `tool_call_audits` table** each turn and injecting them as a compact "Known facts so far" block. No migration; reuses data already being logged.
- Conversation dialogue itself is still passed as native threaded turns.

This means `hr_gatherRequirement` and `memory_saveInteractionIntent` are **kept** — their audited outputs are precisely the durable memory we replay. Only `history_saveMessage` (redundant: the text is already in the `messages` table) is removed, and the runner's reads of the ephemeral mock store are dropped.

**Outcome:** the agent receives the full recent conversation as native turns plus a durable snapshot of facts/requirements it has already gathered, so it stops re-asking and recall no longer depends on ephemeral process memory.

## Changes

Changes span `packages/agent` (runner, prompt, router), `packages/core` (reply + new known-facts helper), and `services/worker`. Both production paths (`packages/core/src/reply.ts` and `services/worker/src/main.ts`) go through the same agent entry points, so the central fixes land on both.

### 1. Pass native multi-turn messages instead of a flat blob

**`packages/agent/src/prompt/prompt-cache-context.ts`**
- Change `buildPromptCacheContext` to return a `messages` array (typed as the `ai` SDK's `CoreMessage[]`) in addition to / instead of the single `prompt` string.
  - `system` (cached prefix): `CORE_HR_AGENT_INSTRUCTIONS` + skill index (`defaultSkillsPromptBlock`) + the loaded-skills block + the Customer Profile Snapshot + a compact Conversation State header (tenant/channel/intent/requirement *if present*). These are stable-ish and benefit from prompt caching.
  - `messages`: map `state.history` into `{ role: "user" | "assistant", content }` turns. Inbound → `user`, agent → `assistant`. Drop the `[ROLE]:` text formatting — the role is now structural.
- **Remove the `.slice(-30)`** (`formatState:116`). Use the full `state.history` (callers already cap at 100). Add a lightweight safety trim only if needed (e.g. keep the most recent ~60 turns) — document it, don't silently truncate.
- Keep `formatProfile` and the state-header formatting helpers; they move into the system string.
- Update `buildDiagnostics` to reflect the new section layout (system vs. per-turn messages) so token diagnostics stay meaningful.

**`packages/agent/src/core/runner.ts`**
- Change the `generateText` call (`runner.ts:118-140`) from `prompt: promptContext.prompt` to `messages: promptContext.messages`, keeping `system: options.systemPromptOverride || promptContext.system`. The existing `@platform/ai-client` `createOpenRouterChatModel` already normalizes `system`+`messages` into the OpenRouter request (`toOpenRouterMessage` flat-maps the prompt array), so no client change is needed.

### 2. Rewrite the system prompt (remove self-defeating language)

**`packages/agent/src/prompt/prompt-cache-context.ts` — `CORE_HR_AGENT_INSTRUCTIONS`**
- Delete the "strictly truncated to the last 30 messages / you will forget it" sentence (line 13) and the "most recent unread messages are at the very bottom" sentence (line 24, no longer true with native turns — the latest user turn is structurally last).
- Replace with positive framing: the full recent conversation is provided as prior turns; use it; the latest user message is the one to answer.
- Keep the recruiter behavior rules (Vietnamese-by-default, short message-bubble style with `\n\n` splits, friendly emojis, no markdown-bold job listings, salary-redaction rule). Reframe requirement-gathering as a helpful step, not a "or you forget" threat.

### 3. Inject a "Known facts so far" snapshot from tool-call audits (cross-turn memory)

This is the fix for "keeps re-asking." The snapshot is built in the caller (which has `repos` + `conversationId`) and passed into the runner.

**New shared helper — `packages/core/src/known-facts.ts`** (reused by both production callers to avoid duplication):
- `buildKnownFacts(repos, conversationId): Promise<string | undefined>`
- Read `repos.audits.listByConversation({ conversationId })` (`repositories.ts:483-492`).
- For each tool of interest, take the **most recent successful** audit output: `hr_gatherRequirement` (accumulated requirement), `memory_saveInteractionIntent` (intent + requirement), `jobs_search` / twenty job search (jobs already surfaced — render id/title only so we don't re-recommend), `crm_getCandidateProfile` (known profile facts).
- Render a compact, human-readable block (not raw JSON dumps), e.g.:
  ```
  # Known Facts So Far (from earlier tool results — do not re-ask these)
  - Requirement: role=Frontend Engineer, location=HCMC, salaryMinVnd=30000000, workMode=remote
  - Intent: looking_for_frontend_role
  - Jobs already shown: [JOB-12] Senior FE @ Acme, [JOB-31] FE @ Globex
  ```
- Return `undefined` when there are no relevant audits (first turn).

**`packages/core/src/reply.ts`** and **`services/worker/src/main.ts`**
- Call `buildKnownFacts(repos, conversationId)` and pass the result into `runHrAgentScenario` via a new option (e.g. `knownFacts?: string`).

**`packages/agent/src/types.ts` + `packages/agent/src/core/runner.ts` + `packages/agent/src/prompt/prompt-cache-context.ts`**
- Add `knownFacts?: string` to `HrAgentRunOptions`, thread it into `buildPromptCacheContext`.
- Render the Known-Facts block in the prompt **after** the cached stable prefix (it changes per turn, so it must not be inside the cached portion — place it alongside the profile snapshot / state header in the dynamic part of the system string).

**`packages/agent/src/core/router.ts` — feed Known-Facts to the chitchat branch too (fixes the screenshot bug):**
- Add an optional `knownFacts?: string` param to `generateChitchatReply` (and optionally `classifyIntent`); `reply.ts` passes the same snapshot it builds for the agent branch.
- Inject Known-Facts into the chitchat prompt, and amend `CHITCHAT_SYSTEM_PROMPT` so it **must not re-ask any field already present in Known Facts** — instead acknowledge what's known and ask only for a genuinely missing field (or just reply warmly). Soften the hard "transition by asking what job you want" instruction/example so it isn't triggered when the role is already known.
- Raise the `formatHistory` slice from the last 5 messages (`router.ts:102`) to a larger window (e.g. 15–20) so the chitchat branch has real context. The Known-Facts block is the durable backstop regardless.

### 4. Stop depending on the ephemeral store; remove the one redundant tool

**`packages/agent/src/core/runner.ts`**
- Remove the post-call `getIntent()` / `getHistory()` reads and the `state.intent/requirement/history` overwrite (`runner.ts:142-154`). Cross-turn state now comes from the injected Known-Facts block, not the mock store. (Confirmed safe: production `core/reply.ts` ignores `agentResult.state` — it only reads `assistantText` and `steps`.)

**`packages/agent/src/skills/registry.ts`** and **`packages/agent/src/skills-content.ts`**
- Remove `history_saveMessage` (`save-history`) from the default tool set and skill index — the message text is already persisted in the `messages` table, so this tool is pure redundant cost. Leave `mock/store.ts` in place for CLI/test usage.
- **Keep** `hr_gatherRequirement` and `memory_saveInteractionIntent` — their audited outputs are the source of the Known-Facts snapshot. Update the skill descriptions / system-prompt guidance so the model understands calling them records durable facts (and that already-known facts appear in the Known-Facts block).

Note: the `twenty` skill registry (`skills/twenty/registry.ts`) is a separate path; mirror the prompt/message/known-facts changes there only if `HR_SKILL_MODE=twenty` is in use. Default mode is the priority.

## Critical files

- `packages/agent/src/prompt/prompt-cache-context.ts` — prompt assembly (system prompt text, native messages, history formatting, 30-cap, known-facts block, diagnostics)
- `packages/agent/src/core/runner.ts` — `generateText` call (`prompt`→`messages`), `buildInitialState`, ephemeral-store reads, new `knownFacts` option
- `packages/agent/src/types.ts` — `HrAgentRunOptions.knownFacts`
- `packages/core/src/known-facts.ts` — NEW shared helper reading `tool_call_audits`
- `packages/core/src/reply.ts` + `services/worker/src/main.ts` — production callers: build `knownFacts`, pass to BOTH the chitchat (`generateChitchatReply`) and agent (`runHrAgentScenario`) branches
- `packages/agent/src/core/router.ts` — chitchat/classifier: accept `knownFacts`, stop re-asking known fields, raise 5-message history window
- `packages/agent/src/skills/registry.ts` + `packages/agent/src/skills-content.ts` — remove `history_saveMessage`; keep gather/intent tools
- `packages/database/src/repositories.ts` — `audits.listByConversation` (reused, no change)
- Reference (no change): `packages/ai-client/src/index.ts` (already supports `system`+`messages`)

## Verification

1. **Type-check / build** the agent package and the two consumers: `cd packages/agent && pnpm build` (or the repo's tsc), plus `packages/core` and `services/worker`.
2. **Multi-turn recall test (no API key needed):** run `packages/agent/src/cli/test-runner.ts` with `--mock-llm` to confirm the message array is built correctly and nothing throws. Then add/extend a test case that states a requirement early and, several turns later, asks "what role did I say I wanted?" — confirm recall from history.
3. **Known-facts unit check:** unit-test `buildKnownFacts` against a stubbed `repos.audits.listByConversation` returning a couple of `hr_gatherRequirement` / `jobs_search` audit rows — assert the rendered block contains the requirement and the already-shown job titles, and returns `undefined` for an empty audit list.
4. **Cross-turn re-ask test (real LLM, the actual symptom):** with `OPENROUTER_API_KEY` set, drive `generateAndSaveReply` against a seeded conversation: give a role/requirement on turn 1, then send a **casual chitchat** message several turns later (reproducing the screenshot: "chán quá, cuối tuần đi chơi đâu không?"). The reply must NOT re-ask `Bạn đang muốn tìm job ngành gì ạ?` — it should acknowledge the known role. Test both the chitchat branch (casual message) and the HR branch (a recruiting follow-up). This is the pass/fail for the user's complaint.
5. **Prompt diagnostics:** print cache diagnostics (`printCache` / `cache.prompt`) and confirm history is in the `messages` section, the Known-Facts block is present (and outside the cached prefix), and the system block no longer contains the "truncated to 30 / you will forget" text.
6. **Production-path sanity:** confirm `core/reply.ts` still parses `assistantText` into draft responses (`\n\n` splitting unchanged) and that tool-audit logging still fires.
