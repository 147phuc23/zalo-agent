# Persona Example Exchanges — Design

## Background

Chitchat replies (`generateChitchatReply()` in `packages/agent/src/core/router.ts`) read as generic and robotic. The system already has a rich persona document (`packages/agent/src/prompt/core-instructions.md`, 518 lines: name, personality, tone, filler words, formatting rules) but two problems keep it from actually fixing the tone:

1. **`core-instructions.ts` is stale.** It's auto-generated from `core-instructions.md` by `scripts/generate-skills-content.ts`, but the current `.ts` holds a short, condensed one-paragraph prompt that predates the rich `.md` content. The generator hasn't been re-run since the `.md` was last edited, so production (`HR_SPECIALIST` path, via `CORE_HR_AGENT_INSTRUCTIONS`) has been running the short paragraph, not the rich persona doc.
2. **Chitchat has its own, separate, much thinner prompt.** `CHITCHAT_SYSTEM_PROMPT` in `router.ts` is a standalone hardcoded string with only 3 inline examples, entirely disconnected from `core-instructions.md`. It never benefited from the rich persona doc even when that doc is used elsewhere.

Confirmed out of scope for this design (from discussion):
- **Candidate profile freshness** — already re-fetched every request in production (`useLocalCache:false` in `reply.ts`); no gap found, no change needed.
- **60-message history window** — already the current behavior (`history.slice(-60)` in `prompt-cache-context.ts`); confirmed good as-is.
- **Session-scoped job-search caching** — `jobs_search`/`twenty_searchJobs` DB reads are cheap indexed lookups; not worth the added complexity of cross-invocation persistence on serverless. Dropped from scope; revisit only if job-search volume/cost becomes a real problem.

## Goals

- Give both the chitchat path and the HR_SPECIALIST path a shared bank of concrete example exchanges (`{candidate message/situation → ideal reply}`) that demonstrate the intended warm, casual, Vietnamese Zalo-recruiter voice.
- Author that bank in exactly one place, so adding a new scenario later is a one-file edit.
- Bring `core-instructions.ts` back in sync with `core-instructions.md` as part of this change, since the examples only matter if the rich persona doc is actually the one running in production.

## Non-goals

- Not building a searchable/selectable example library (progressive disclosure like `skills_search`/`skills_load`). The set is small (~8, expected to grow slowly) and always loads in full.
- Not making examples DB-editable. They're developer-authored content, same tier as `skills-content.ts`.
- Not touching job-search caching, profile freshness, or the history window (see above).

## Design

### 1. New section in `core-instructions.md`

Add `# Signature Example Exchanges`, placed after `# Persona` and before `# Main Responsibilities`. Format: pairs of `Candidate:` / `Reply:` (or `Situation:` / `Reply:` for proactive, non-reply-triggered lines), separated by blank lines, terminated by the section's `---`.

Starting content — consolidated from what's already scattered across the doc (Persona's identity answer, Human Conversation Rules' reaction example) plus `router.ts`'s existing 3 chitchat examples, reconciled where they conflicted, plus two new lines drafted directly from existing stated rules (salary deflection, farewell) so every documented behavior has a concrete line to point to:

```markdown
# Signature Example Exchanges

Candidate: "Chào bạn"
Reply: "Chào bạn! Mình có thể giúp gì cho bạn hôm nay? 😊"

Candidate: "Bạn là ai vậy?"
Reply: "Mình là Hoàng Phúc, AI hỗ trợ tuyển dụng của team nhé 😊"

Candidate: "Cảm ơn nha"
Reply: "Dạ không có gì ạ! Chúc bạn một ngày vui vẻ nhé! 👍"

Candidate: "Tạm biệt nha"
Reply: "Tạm biệt bạn nhé! Có gì cần cứ nhắn mình nha 😊"

Candidate: "Mình đang làm Java Backend."
Reply: "Java Backend hả 😄\n\nBên đó dùng Spring Boot luôn đúng không?"

Candidate: "Job này lương bao nhiêu vậy?"
Reply: "Lương thì mình chưa tiện nói con số cụ thể, nhưng yên tâm là cạnh tranh và hợp với mong muốn của bạn nha 😊"

Situation: presenting job recommendations
Reply: "Hiện mình thấy vài vị trí khá hợp 😊\n\nBackend Engineer\nHCM\nJava + Spring Boot\n2-4 năm kinh nghiệm\n\nSenior Fullstack\nRemote\nReact + Node\n4+ năm\n\nBạn thích mình gửi JD nào trước?"

Situation: light small talk after recommending jobs
Reply: "Đợt này thấy thị trường tuyển dụng cũng nhộn nhịp ghê 😄"
```

Note: the identity answer above (`"Mình là Hoàng Phúc, AI hỗ trợ tuyển dụng của team nhé 😊"`) replaces `router.ts`'s current divergent version (`"Mình là trợ lý tuyển dụng tự động..."`), which didn't name the persona and drifted from the canonical answer already specified elsewhere in `core-instructions.md`. This resolves that inconsistency.

Reviewer note: these are a real, usable starting set (not placeholders), but the tone should get a native-speaker read-through before merging, since two lines (salary deflection, farewell) are newly drafted rather than extracted from existing text.

### 2. Generator change — `scripts/generate-skills-content.ts`

Add a small extraction helper and a second generated export:

```ts
function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`^${heading}\\n([\\s\\S]*?)(?=\\n---|\\n# )`, "m");
  const match = pattern.exec(markdown);
  if (!match) {
    throw new Error(`Section "${heading}" not found in core-instructions.md`);
  }
  return match[1].trim();
}
```

Called after reading `promptMdFile`, producing a second constant written into `core-instructions.ts`:

```ts
export const CORE_HR_AGENT_INSTRUCTIONS = "...(unchanged mechanism, full doc)...";
export const PERSONA_EXAMPLES = "...(just the Signature Example Exchanges section)...";
```

Throwing when the section is missing (rather than emitting an empty string) means a future edit that accidentally deletes the heading fails the generator loudly at build time instead of silently shipping an examples-free chitchat prompt.

### 3. `router.ts` change

`CHITCHAT_SYSTEM_PROMPT` drops its inline `Examples:` block (lines currently hardcoded at the end of the string) and imports the shared bank instead:

```ts
import { PERSONA_EXAMPLES } from "../prompt/core-instructions.js";

const CHITCHAT_SYSTEM_PROMPT = `You are a friendly, helpful HR recruiter chat agent for Zalo.
...existing rules unchanged...
CRITICAL: If a "Known Facts" block is provided, ...

${PERSONA_EXAMPLES}`;
```

`CORE_HR_AGENT_INSTRUCTIONS` needs no separate wiring for the examples — they're already part of the full doc it's generated from.

### 4. Regeneration

Run `scripts/generate-skills-content.ts` once as part of this change. This is the step with real blast radius: it replaces today's live short paragraph with the full rich persona doc (plus the new examples section) for **both** CHITCHAT and HR_SPECIALIST in production. Every reply's tone, length, and formatting will shift, not just chitchat's.

### 5. Testing

- `router.test.ts`: add a case asserting `CHITCHAT_SYSTEM_PROMPT` contains content from `PERSONA_EXAMPLES` (e.g. checks for a known substring like `"Hoàng Phúc"`), so a future refactor can't silently drop the import.
- No new test for the `.md` → `.ts` extraction mechanism itself — the generator has no existing test coverage, and adding a test harness for it is out of scope here (noting, not fixing).
- Manual smoke test via `packages/agent/src/cli/hr-chat.ts` before merging, covering: a greeting, a "who are you" question, sharing a current role, asking about salary, and a farewell — to confirm the regenerated prompt reads naturally and no section extraction broke mid-sentence.

### 6. Error handling

None needed at runtime — this is all build-time content generation. The only failure mode is the generator's `extractSection` throwing if the heading is missing or malformed, which is the desired behavior (fail the build, not the conversation).

## Rollout

1. Add the new section to `core-instructions.md`.
2. Update `scripts/generate-skills-content.ts` with `extractSection` + the new export.
3. Update `router.ts` to import and use `PERSONA_EXAMPLES`.
4. Run the generator; review the diff in `core-instructions.ts` (expect it to grow substantially — this is expected, see Background).
5. Manual smoke test via `hr-chat.ts` per the scenarios above.
6. Commit `core-instructions.md`, `core-instructions.ts`, `router.ts`, and the generator script change together.
