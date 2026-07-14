# Persona Example Exchanges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both the chitchat and HR_SPECIALIST reply paths a shared, single-sourced bank of example exchanges that demonstrate the intended warm, casual, Vietnamese Zalo-recruiter voice, and bring the stale generated persona prompt back in sync with its source markdown.

**Architecture:** Add a `# Signature Example Exchanges` section to `packages/agent/src/prompt/core-instructions.md`. Extend `scripts/generate-skills-content.ts` to extract that section into a new `PERSONA_EXAMPLES` export in the generated `core-instructions.ts`, alongside the existing `CORE_HR_AGENT_INSTRUCTIONS`. `router.ts`'s `CHITCHAT_SYSTEM_PROMPT` imports and appends `PERSONA_EXAMPLES`, replacing its own inline (and partly inconsistent) examples. Run the generator once so both prompts pick up the change.

**Tech Stack:** TypeScript, vitest, Node.js `fs/promises`, no new dependencies.

## Global Constraints

- Examples are developer-authored, static content — no DB storage, no runtime selection logic (per spec Non-goals).
- The examples bank must be authored in exactly one place (`core-instructions.md`) and consumed by both prompt paths — no hand-duplication (per spec Goals).
- Job-search caching, candidate profile freshness, and the 60-message history window are explicitly out of scope — do not touch `jobs_search`, `customer-profile-cache.ts`, or `prompt-cache-context.ts`'s history slicing.
- `scripts/generate-skills-content.ts` must fail loudly (throw) if the `# Signature Example Exchanges` section is missing from `core-instructions.md` — never silently emit an empty examples block.
- Regenerating `core-instructions.ts` is expected to produce a large diff (short paragraph → full rich persona doc) — this is intentional per the spec, not a bug to minimize.

---

## Task 1: Add the Signature Example Exchanges section to core-instructions.md

**Files:**
- Modify: `packages/agent/src/prompt/core-instructions.md`

**Interfaces:**
- Produces: a new markdown section titled exactly `# Signature Example Exchanges`, placed after the `# Persona` section and before `# Main Responsibilities`, terminated by a `---` line (matching the file's existing section-separator convention). This exact heading string and terminator are what Task 2's extractor searches for.

- [ ] **Step 1: Insert the new section**

In `packages/agent/src/prompt/core-instructions.md`, find this existing boundary (end of `# Persona`, start of `# Main Responsibilities`):

```markdown
If asked who you are, simply answer:

"Mình là Hoàng Phúc, AI hỗ trợ tuyển dụng của team nhé 😊"

---

# Main Responsibilities
```

Replace it with (inserting the new section between the two):

```markdown
If asked who you are, simply answer:

"Mình là Hoàng Phúc, AI hỗ trợ tuyển dụng của team nhé 😊"

---

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

---

# Main Responsibilities
```

- [ ] **Step 2: Verify the section is well-formed**

Run: `grep -n "^# Signature Example Exchanges$\|^# Main Responsibilities$" packages/agent/src/prompt/core-instructions.md`

Expected output: two lines, in that order, e.g.:
```
26:# Signature Example Exchanges
50:# Main Responsibilities
```
(exact line numbers may differ; what matters is Signature Example Exchanges appears once, immediately before Main Responsibilities)

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/prompt/core-instructions.md
git commit -m "docs: add signature example exchanges to core persona instructions"
```

---

## Task 2: Extract the examples section in the generator script

**Files:**
- Modify: `scripts/generate-skills-content.ts`

**Interfaces:**
- Consumes: `packages/agent/src/prompt/core-instructions.md` content (from Task 1), specifically the `# Signature Example Exchanges` ... `---` block.
- Produces: `extractSection(markdown: string, heading: string): string` — a function used only within this script. Also produces the `PERSONA_EXAMPLES` constant written into the generated `packages/agent/src/prompt/core-instructions.ts` (consumed by Task 4).

- [ ] **Step 1: Add the extractSection helper**

In `scripts/generate-skills-content.ts`, add this function after `parseSkillMarkdown` (after line 41, before `async function run()`):

```typescript
function extractSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedHeading}\\n([\\s\\S]*?)(?=\\n---|\\n# )`, "m");
  const match = pattern.exec(markdown);
  if (!match) {
    throw new Error(`Section "${heading}" not found in core-instructions.md`);
  }
  return match[1].trim();
}
```

- [ ] **Step 2: Use it when generating core-instructions.ts**

In `scripts/generate-skills-content.ts`, find this block (around line 100-114):

```typescript
  // Generate core instructions prompt file
  const promptMdFile = path.join(root, "packages/agent/src/prompt/core-instructions.md");
  const promptTsFile = path.join(root, "packages/agent/src/prompt/core-instructions.ts");
  try {
    const promptContent = await fs.readFile(promptMdFile, "utf-8");
    const promptCode = `// This file is auto-generated by scripts/generate-skills-content.ts.
// Do not edit this file manually.

export const CORE_HR_AGENT_INSTRUCTIONS = ${JSON.stringify(promptContent.trim())};
`;
    await fs.writeFile(promptTsFile, promptCode, "utf-8");
    console.log(`Generated static core instructions successfully at: ${promptTsFile}`);
  } catch (err) {
    console.error("Failed to generate core instructions", err);
    throw err;
  }
```

Replace it with:

```typescript
  // Generate core instructions prompt file
  const promptMdFile = path.join(root, "packages/agent/src/prompt/core-instructions.md");
  const promptTsFile = path.join(root, "packages/agent/src/prompt/core-instructions.ts");
  try {
    const promptContent = await fs.readFile(promptMdFile, "utf-8");
    const personaExamples = extractSection(promptContent, "# Signature Example Exchanges");
    const promptCode = `// This file is auto-generated by scripts/generate-skills-content.ts.
// Do not edit this file manually.

export const CORE_HR_AGENT_INSTRUCTIONS = ${JSON.stringify(promptContent.trim())};

export const PERSONA_EXAMPLES = ${JSON.stringify(personaExamples)};
`;
    await fs.writeFile(promptTsFile, promptCode, "utf-8");
    console.log(`Generated static core instructions successfully at: ${promptTsFile}`);
  } catch (err) {
    console.error("Failed to generate core instructions", err);
    throw err;
  }
```

- [ ] **Step 3: Verify extractSection throws on a missing section**

Run:
```bash
node --experimental-strip-types -e '
const markdown = "# Persona\ncontent\n\n---\n\n# Main Responsibilities\nmore";
function extractSection(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedHeading}\\n([\\s\\S]*?)(?=\\n---|\\n# )`, "m");
  const match = pattern.exec(markdown);
  if (!match) {
    throw new Error(`Section "${heading}" not found in core-instructions.md`);
  }
  return match[1].trim();
}
try {
  extractSection(markdown, "# Signature Example Exchanges");
  console.log("FAIL: should have thrown");
} catch (e) {
  console.log("OK: threw as expected:", e.message);
}
'
```

Expected output: `OK: threw as expected: Section "# Signature Example Exchanges" not found in core-instructions.md`

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-skills-content.ts
git commit -m "feat: extract persona example exchanges into a generated export"
```

---

## Task 3: Update router.ts to use the shared persona examples

**Files:**
- Modify: `packages/agent/src/core/router.ts`
- Test: `packages/agent/src/core/router.test.ts`

**Interfaces:**
- Consumes: `PERSONA_EXAMPLES` (string) from `../prompt/core-instructions.js` — this import will fail to resolve until Task 4 regenerates `core-instructions.ts`, so this task's test is expected to fail until Task 4 runs. Note in Step 2 below.
- Produces: no new exports; `CHITCHAT_SYSTEM_PROMPT`'s content changes (internal to the module, already exported indirectly via `generateChitchatReply`).

- [ ] **Step 1: Write the failing test**

In `packages/agent/src/core/router.test.ts`, add this test inside the existing `describe("Router & Classifier Agent", ...)` block, after the `"generates a friendly chitchat reply"` test (after line 75's closing brace, before the final `});` that closes the describe block):

```typescript
  it("includes the shared persona examples in the chitchat system prompt", async () => {
    mockGenerate.mockResolvedValue({
      text: "Chào bạn!",
      model: "tencent/hy3:free",
    });

    await generateChitchatReply([{ role: "user", content: "Chào bạn" }]);

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.system).toContain("Hoàng Phúc");
    expect(callArgs.system).toContain("Java Backend hả");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/agent/src/core/router.test.ts`
Expected: FAIL — either because `CHITCHAT_SYSTEM_PROMPT` doesn't yet include `PERSONA_EXAMPLES` content, or (if Step 3 below is done first) because the import from `core-instructions.js` doesn't yet export `PERSONA_EXAMPLES` (Task 4 hasn't run yet). Either failure mode is expected at this point.

- [ ] **Step 3: Update CHITCHAT_SYSTEM_PROMPT**

In `packages/agent/src/core/router.ts`, add the import at the top of the file (after line 1's existing import):

```typescript
import { OpenRouterAiClient } from "@platform/ai-client";
import { PERSONA_EXAMPLES } from "../prompt/core-instructions.js";
```

Then replace the `CHITCHAT_SYSTEM_PROMPT` constant (lines 35-46) — which currently ends with its own inline `Examples:` block — with:

```typescript
const CHITCHAT_SYSTEM_PROMPT = `You are a friendly, helpful HR recruiter chat agent for Zalo.
You handle initial greetings, casual chitchat, and general inquiries.
Keep your responses extremely short, warm, and natural (1-2 sentences maximum).
Reply in Vietnamese unless the candidate writes in English.
Add appropriate friendly emojis (e.g., 😊, 👍, ✨).
Do not try to match or recommend jobs, and do not look up CRM records.
If the user asks to find a job or shares their skills/experience, politely transition to finding them a job (but keep it brief).
CRITICAL: If a "Known Facts" block is provided, look at it. If the candidate's target role, location, or other requirements are already known/filled, do NOT ask for those details again. Acknowledge what is already known if relevant, or simply reply warmly without re-asking any known field.

${PERSONA_EXAMPLES}`;
```

- [ ] **Step 4: Run test to verify it still fails (expected — Task 4 hasn't regenerated core-instructions.ts yet)**

Run: `npx vitest run packages/agent/src/core/router.test.ts`
Expected: FAIL with a module resolution error, e.g. `"PERSONA_EXAMPLES" is not exported by "src/prompt/core-instructions.ts"` — this is expected until Task 4 runs the generator. Do not attempt to fix this in this task; proceed to Task 4.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/core/router.ts packages/agent/src/core/router.test.ts
git commit -m "feat: source chitchat examples from shared persona examples bank"
```

---

## Task 4: Regenerate core-instructions.ts and verify both prompts

**Files:**
- Modify (generated, not hand-edited): `packages/agent/src/prompt/core-instructions.ts`
- Modify (generated, not hand-edited): `packages/agent/src/skills-content.ts` (regenerated as a side effect of running the same script; expect no content change here since no skill files changed)

**Interfaces:**
- Consumes: `extractSection` and the updated core-instructions generation block from Task 2; the `# Signature Example Exchanges` section from Task 1.
- Produces: `CORE_HR_AGENT_INSTRUCTIONS` (full rich persona doc, string) and `PERSONA_EXAMPLES` (string) exported from `packages/agent/src/prompt/core-instructions.ts`, resolving Task 3's import.

- [ ] **Step 1: Run the generator**

Run: `npx tsx scripts/generate-skills-content.ts`

Expected output:
```
Generating skills content...
Generated static skills content successfully at: /Users/phuc.dang/repos/twenty/packages/agent/src/skills-content.ts
Generated static core instructions successfully at: /Users/phuc.dang/repos/twenty/packages/agent/src/prompt/core-instructions.ts
```

- [ ] **Step 2: Verify core-instructions.ts now exports PERSONA_EXAMPLES**

Run: `grep -c "export const PERSONA_EXAMPLES" packages/agent/src/prompt/core-instructions.ts`
Expected: `1`

Run: `grep -o "Ho.ng Ph.c" packages/agent/src/prompt/core-instructions.ts | head -1`
Expected: a match (confirms the persona name made it into the generated file)

- [ ] **Step 3: Run the router test to verify it now passes**

Run: `npx vitest run packages/agent/src/core/router.test.ts`
Expected: PASS, all 5 tests (4 existing + 1 new) green.

- [ ] **Step 4: Review the diff in core-instructions.ts**

Run: `git diff --stat packages/agent/src/prompt/core-instructions.ts packages/agent/src/skills-content.ts`

Expected: `core-instructions.ts` shows a large diff (short paragraph replaced by the full rich persona doc + examples — this is the intended outcome per the spec, not a bug). `skills-content.ts` should show no diff (no skill `SKILL.md` files changed), confirming the generator's other output is unaffected.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/prompt/core-instructions.ts packages/agent/src/skills-content.ts
git commit -m "chore: regenerate core-instructions.ts with rich persona and examples"
```

---

## Task 5: Manual smoke test via the CLI

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: the fully wired persona + examples from Tasks 1-4, via `packages/agent/src/cli/hr-chat.ts`.

- [ ] **Step 1: Check required environment variable**

Run: `grep -c OPENROUTER_API_KEY .env 2>/dev/null || echo "not set"`

If "not set": ask the user for an `OPENROUTER_API_KEY` before proceeding — this smoke test makes real LLM calls and cannot run without it. Do not fabricate or skip this check.

- [ ] **Step 2: Start the CLI chat**

Run: `npx tsx packages/agent/src/cli/hr-chat.ts`

- [ ] **Step 3: Exercise the five scenarios from the spec's Testing section**

Send each of these messages in turn, observing the reply:
1. `Chào bạn` — expect a short, warm greeting (not a robotic acknowledgment).
2. `Bạn là ai vậy?` — expect the reply to name "Hoàng Phúc".
3. `Mình đang làm Java Backend` — expect a reaction first (e.g. acknowledging Java Backend) before any follow-up question, not an immediate interrogation.
4. `Job này lương bao nhiêu vậy?` — expect a deflection that doesn't reveal an exact number.
5. `Tạm biệt nha` — expect a warm farewell, not a generic closing line.

- [ ] **Step 4: Confirm no mid-sentence truncation**

While reading the five replies, confirm none of them look cut off or garbled (this would indicate the `extractSection` regex boundary in Task 2 clipped the examples section incorrectly). If any reply looks malformed, stop and re-check the section boundaries in `core-instructions.md` (Task 1) and the regex in `scripts/generate-skills-content.ts` (Task 2) before continuing.

- [ ] **Step 5: Exit the CLI**

Press `Ctrl+C` or send an empty message per the CLI's exit convention to end the session.

(No commit for this task — verification only, no files changed.)

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec §1 (content), Task 2 covers §2 (generator), Task 3 covers §3 (router.ts), Task 4 covers §4 (regeneration) and includes the §5 automated test, Task 5 covers the §5 manual smoke test. §6 (error handling) is covered by Task 2 Step 1's throw-on-missing-section behavior, verified in Task 2 Step 3.
- **Placeholder scan:** no TBD/TODO; all code steps show complete, exact code.
- **Type consistency:** `PERSONA_EXAMPLES` is a `string` everywhere it's produced (Task 2, generator output) and consumed (Task 3, template literal interpolation; Task 4, verification). `extractSection(markdown: string, heading: string): string` signature is used identically in Task 2's Step 1 definition and Step 3's standalone verification snippet.
