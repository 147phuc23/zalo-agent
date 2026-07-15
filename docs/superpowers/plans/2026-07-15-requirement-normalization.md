# Candidate Requirement Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `hr_gatherRequirement`'s regex-only candidate requirement extraction with an LLM-based normalization pass folded into `classifyIntent`'s existing call, backed by a canonical role/skill/availability/language taxonomy, while preserving durable cross-turn requirement memory via `tool_call_audits`.

**Architecture:** `classifyIntent()` (`packages/agent/src/core/router.ts`) gains a `normalizedRequirement` field in its JSON response and a `currentRequirement` input parameter, using a new canonical taxonomy (`packages/agent/src/core/requirement-taxonomy.ts`). `packages/core/src/known-facts.ts` is refactored to also return the structured requirement object (not just formatted text) so `reply.ts` can pass it into `classifyIntent`, and to accept a new `requirement_normalizer` audit tool-name (alongside the existing `hr_gatherRequirement`) so cross-turn memory keeps working once the old tool is deleted. `reply.ts` writes a `requirement_normalizer` audit entry each turn mirroring what the deleted tool used to produce.

**Tech Stack:** TypeScript, vitest, Vercel AI SDK (`ai` package), no new dependencies.

## Global Constraints

- All canonical taxonomy values are lowercase strings (per design spec §1).
- `role`, `availability`, and `language` are closed enums — an out-of-enum value from the LLM must be dropped (never accepted), never crash the turn.
- `skills` is a reference vocabulary, not a closed enum — lowercase every entry, normalize to the reference list when there's a clear match, but never reject/drop a skill just because it isn't on the list (per design spec Non-goals).
- `locationSlugs` in the LLM's response are advisory only — the real value always comes from re-deriving via the existing `extractLocationSlugs()` against the raw message text, never trusted verbatim from the LLM (same defensive pattern already used in `services/worker/scripts/twenty/parse-jobs-to-sql.ts`).
- Malformed/missing `normalizedRequirement` in the classifier's JSON response must leave the existing requirement completely unchanged for that turn — never partially apply, never crash.
- Total LLM calls per HR_SPECIALIST turn must stay at 2 (classify+normalize combined, then the main agent loop) — do not add a separate third call.
- Job-posting ingestion (`services/worker/scripts/twenty/parse-jobs-to-sql.ts`) is out of scope — do not touch it.
- `scoreJob()`'s matching algorithm in `core/location-normalizer.ts` is out of scope — do not modify it (verified in the design spec that canonical 2-3 word role values still substring-match realistic job titles under the existing logic).
- The `requirement_normalizer` audit entry must use the exact same output shape (`{ requirement: {...} }`) that `hr_gatherRequirement`'s audit entries already use, so `known-facts.ts`'s existing merge logic works unchanged for both tool names.

---

## Task 1: Canonical requirement taxonomy

**Files:**
- Create: `packages/agent/src/core/requirement-taxonomy.ts`
- Test: `packages/agent/src/core/requirement-taxonomy.test.ts`

**Interfaces:**
- Produces: `ROLE_VALUES: readonly string[]`, `SKILL_VALUES: readonly string[]`, `AVAILABILITY_VALUES: readonly string[]`, `LANGUAGE_VALUES: readonly string[]`, `isRoleValue(value: string): boolean`, `isAvailabilityValue(value: string): boolean`, `isLanguageValue(value: string): boolean` — all consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `packages/agent/src/core/requirement-taxonomy.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ROLE_VALUES,
  SKILL_VALUES,
  AVAILABILITY_VALUES,
  LANGUAGE_VALUES,
  isRoleValue,
  isAvailabilityValue,
  isLanguageValue,
} from "./requirement-taxonomy.js";

describe("requirement-taxonomy", () => {
  it("every canonical value is lowercase", () => {
    for (const list of [ROLE_VALUES, SKILL_VALUES, AVAILABILITY_VALUES, LANGUAGE_VALUES]) {
      for (const value of list) {
        expect(value).toBe(value.toLowerCase());
      }
    }
  });

  it("isRoleValue accepts canonical roles and rejects unknown strings", () => {
    expect(isRoleValue("backend engineer")).toBe(true);
    expect(isRoleValue("Backend Engineer")).toBe(false);
    expect(isRoleValue("astronaut")).toBe(false);
  });

  it("isAvailabilityValue accepts canonical values and rejects unknown strings", () => {
    expect(isAvailabilityValue("immediate")).toBe(true);
    expect(isAvailabilityValue("asap")).toBe(false);
  });

  it("isLanguageValue accepts canonical values and rejects unknown strings", () => {
    expect(isLanguageValue("english")).toBe(true);
    expect(isLanguageValue("French")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/agent/src/core/requirement-taxonomy.test.ts`
Expected: FAIL with "Cannot find module './requirement-taxonomy.js'" or similar — the source file doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `packages/agent/src/core/requirement-taxonomy.ts`:

```typescript
export const ROLE_VALUES = [
  "frontend engineer",
  "backend engineer",
  "fullstack engineer",
  "ai engineer",
  "devops engineer",
  "data engineer",
  "mobile engineer",
  "qa engineer",
  "product designer",
  "engineering manager",
  "support engineer",
  "recruiter",
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

// Reference vocabulary, not a closed enum: the LLM normalizes to this when
// there's a clear match, and passes through its own lowercased term
// otherwise, since job-relevant tech terms change too often for a strict
// enum to stay usable.
export const SKILL_VALUES = [
  "react", "typescript", "next.js", "tailwindcss", "node.js", "nestjs",
  "postgresql", "redis", "python", "llm", "sql", "rag", "graphql", "aws",
  "kubernetes", "terraform", "ci/cd", "spark", "airflow", "react native",
  "swift", "kotlin", "playwright", "cypress", "jest", "figma", "java",
  "azure", "gcp", "powershell", "jenkins", "azure pipelines", "datadog",
  "prometheus", "grafana", "scrum", "kanban", "c#", ".net", "leadership",
  "system design", "agile",
] as const;

export const AVAILABILITY_VALUES = ["immediate", "2_weeks", "1_month", "negotiable"] as const;
export type AvailabilityValue = (typeof AVAILABILITY_VALUES)[number];

export const LANGUAGE_VALUES = ["english", "vietnamese"] as const;
export type LanguageValue = (typeof LANGUAGE_VALUES)[number];

export function isRoleValue(value: string): value is RoleValue {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

export function isAvailabilityValue(value: string): value is AvailabilityValue {
  return (AVAILABILITY_VALUES as readonly string[]).includes(value);
}

export function isLanguageValue(value: string): value is LanguageValue {
  return (LANGUAGE_VALUES as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/agent/src/core/requirement-taxonomy.test.ts`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/core/requirement-taxonomy.ts packages/agent/src/core/requirement-taxonomy.test.ts
git commit -m "feat: add canonical requirement taxonomy (role/skill/availability/language)"
```

---

## Task 2: Extend classifyIntent with normalizedRequirement

**Files:**
- Modify: `packages/agent/src/core/router.ts`
- Modify: `packages/agent/src/core/router.test.ts`
- Modify: `packages/agent/src/index.ts`

**Interfaces:**
- Consumes: `ROLE_VALUES`, `AVAILABILITY_VALUES`, `LANGUAGE_VALUES`, `isRoleValue`, `isAvailabilityValue`, `isLanguageValue` from `./requirement-taxonomy.js` (Task 1); `extractLocationSlugs` from `./location-normalizer.js` (already exists); `CandidateRequirement` from `../types.js` (already exists).
- Produces: `classifyIntent(messages: RouterMessage[], model?: string, knownFacts?: string, currentRequirement?: CandidateRequirement): Promise<ClassificationResult>` where `ClassificationResult` now includes `normalizedRequirement?: CandidateRequirement`. Also: `CandidateRequirement` becomes part of `@platform/agent`'s public type exports, consumed by Task 3 and Task 4.

- [ ] **Step 1: Write the failing tests**

In `packages/agent/src/core/router.test.ts`, add these tests inside the existing `describe("Router & Classifier Agent", ...)` block, after the existing `"falls back to HR_SPECIALIST if classifier JSON is invalid"` test (after line 63's closing brace):

```typescript
  it("returns normalizedRequirement merged with the passed-in currentRequirement", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "User wants a backend role",
        normalizedRequirement: {
          role: "backend engineer",
          skills: ["Node.js", "SQL"],
          workMode: "remote",
        },
      }),
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent(
      [{ role: "user", content: "Mình muốn làm backend, biết Node.js" }],
      "tencent/hy3:free",
      undefined,
      { yearsOfExperience: 3 },
    );

    expect(result.normalizedRequirement).toEqual({
      yearsOfExperience: 3,
      role: "backend engineer",
      skills: ["node.js", "sql"],
      workMode: "remote",
    });
  });

  it("drops invalid role/availability/language values while keeping valid fields", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "test",
        normalizedRequirement: {
          role: "astronaut",
          availability: "asap",
          language: "french",
          workMode: "hybrid",
        },
      }),
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent([{ role: "user", content: "test" }]);

    expect(result.normalizedRequirement).toEqual({ workMode: "hybrid" });
  });

  it("re-derives locationSlugs from raw message text instead of trusting the LLM's proposed slugs", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "test",
        normalizedRequirement: { locationSlugs: ["totally-made-up-slug"] },
      }),
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent([
      { role: "user", content: "Mình muốn làm ở Đà Nẵng" },
    ]);

    expect(result.normalizedRequirement?.locationSlugs).not.toContain("totally-made-up-slug");
    expect(result.normalizedRequirement?.locationSlugs).toContain("da-nang");
  });

  it("keeps the existing requirement unchanged when classifier JSON is invalid", async () => {
    mockGenerate.mockResolvedValue({
      text: "This is not valid JSON",
      model: "tencent/hy3:free",
    });

    const existing = { role: "backend engineer", yearsOfExperience: 5 };
    const result = await classifyIntent(
      [{ role: "user", content: "Chào" }],
      "tencent/hy3:free",
      undefined,
      existing,
    );

    expect(result.normalizedRequirement).toEqual(existing);
  });
```

Note: `"da-nang"` is the real slug for Đà Nẵng — verify against `packages/shared/src/locations.ts` if this fails; the slug is defined there as `slug: "da-nang"` with `vietnameseName: "Đà Nẵng"` and alias `"đà nẵng"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/agent/src/core/router.test.ts`
Expected: FAIL — `result.normalizedRequirement` is `undefined` in all four new tests, since `classifyIntent` doesn't produce or accept it yet.

- [ ] **Step 3: Implement the extension**

Replace the full contents of `packages/agent/src/core/router.ts` with:

```typescript
import { OpenRouterAiClient } from "@platform/ai-client";
import type { CandidateRequirement } from "../types.js";
import { extractLocationSlugs } from "./location-normalizer.js";
import {
  ROLE_VALUES,
  SKILL_VALUES,
  AVAILABILITY_VALUES,
  LANGUAGE_VALUES,
  isRoleValue,
  isAvailabilityValue,
  isLanguageValue,
} from "./requirement-taxonomy.js";

export type RouterMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClassificationResult = {
  category: "CHITCHAT" | "HR_SPECIALIST";
  reason: string;
  normalizedRequirement?: CandidateRequirement;
};

const CLASSIFIER_SYSTEM_PROMPT = `You are a frontline classification and routing assistant for an autonomous recruiting system.
Your goal is to classify the candidate's latest message and short conversation history into one of the following two categories:

1. "CHITCHAT":
- Casual greetings or standard icebreakers (e.g., "Hi", "Hello", "Chào bạn", "Xin chào", "Hi bot").
- Polite phrases, farewells, or simple acknowledgments (e.g., "Cảm ơn", "Tạm biệt", "Dạ vâng", "Ok b").
- Basic FAQs or general chitchat not containing any specific job requirements or candidate profile facts (e.g., "Bạn là ai?", "Bạn làm được gì?", "Có ai ở đó không?").

2. "HR_SPECIALIST":
- The user expresses a clear, explicit intent to find a job or view job listings (e.g., "Mình muốn tìm việc", "Tìm việc giúp mình").
- The user provides specific candidate criteria/requirements such as target role, location, preferred salary, work mode, or years of experience.
- The user uploads or mentions sending/extracting a CV/resume.
- The user asks about their application status, interview schedules, or feedback.
- The user lists their specific skills or background (e.g., "Mình biết làm React", "I am a backend developer").

You must ALSO extract and normalize any candidate job-search requirement information present in the conversation (from the current message or earlier ones), merged with any "Current Requirement" context provided in the prompt. Return it as "normalizedRequirement" with these optional fields:
- role: MUST be exactly one of: ${ROLE_VALUES.join(", ")}. Omit if none match.
- skills: array of lowercase skill names. Prefer these canonical spellings when they match: ${SKILL_VALUES.join(", ")}. If a mentioned skill isn't in this list, still include it in lowercase.
- locationSlugs: array of city names mentioned (free text is fine, it gets re-derived internally).
- workMode: one of "remote", "hybrid", "onsite".
- salaryMinVnd: expected minimum salary in Vietnamese Dong (VND). IMPORTANT: if the candidate gives a salary in USD (e.g. "$2000", "2k usd", "2k đô"), convert it to VND by multiplying by 25,000 (e.g. 2000 USD -> 50000000 VND). Never return a raw USD number in this field.
- yearsOfExperience: number of years of experience mentioned.
- availability: MUST be exactly one of: ${AVAILABILITY_VALUES.join(", ")}. Omit if not mentioned.
- language: MUST be exactly one of: ${LANGUAGE_VALUES.join(", ")}. Omit if not mentioned.
Return the FULL merged requirement (existing + anything new from this message), not just what's new. Omit any field with no information at all (don't guess).

You must respond ONLY with a JSON object containing the fields:
{
  "category": "CHITCHAT" | "HR_SPECIALIST",
  "reason": "Brief justification for the classification",
  "normalizedRequirement": { ... as described above, or {} if nothing to report ... }
}
Do not include any other text, markdown formatting (like \`\`\`json), or explanations outside of the JSON.`;

const CHITCHAT_SYSTEM_PROMPT = `You are a friendly, helpful HR recruiter chat agent for Zalo.
You handle initial greetings, casual chitchat, and general inquiries.
Keep your responses extremely short, warm, and natural (1-2 sentences maximum).
Reply in Vietnamese unless the candidate writes in English.
Add appropriate friendly emojis (e.g., 😊, 👍, ✨).
Do not try to match or recommend jobs, and do not look up CRM records.
If the user asks to find a job or shares their skills/experience, politely transition to finding them a job (but keep it brief).
CRITICAL: If a "Known Facts" block is provided, look at it. If the candidate's target role, location, or other requirements are already known/filled, do NOT ask for those details again. Acknowledge what is already known if relevant, or simply reply warmly without re-asking any known field.
Examples:
- Candidate: "Chào bạn" -> Response: "Chào bạn! Mình có thể giúp gì cho bạn hôm nay? 😊"
- Candidate: "Bạn là ai vậy?" -> Response: "Mình là trợ lý tuyển dụng tự động. Rất vui được làm quen với bạn! Rất vui được hỗ trợ bạn nhé! 😊"
- Candidate: "Cảm ơn nha" -> Response: "Dạ không có gì ạ! Chúc bạn một ngày vui vẻ nhé! 👍"`;

export async function classifyIntent(
  messages: RouterMessage[],
  model: string = "tencent/hy3:free",
  knownFacts?: string,
  currentRequirement?: CandidateRequirement,
): Promise<ClassificationResult> {
  const client = new OpenRouterAiClient();
  const historyText = formatHistory(messages);
  const latestMessageText = messages[messages.length - 1]?.content ?? "";

  let prompt = `Classify the following conversation:\n\n${historyText}\n\nLatest message: ${latestMessageText}`;
  if (currentRequirement && Object.keys(currentRequirement).length > 0) {
    prompt = `Current Requirement (merge new information into this, don't discard existing fields unless contradicted): ${JSON.stringify(currentRequirement)}\n\n${prompt}`;
  }
  if (knownFacts) {
    prompt = `Context:\n${knownFacts}\n\n${prompt}`;
  }

  const response = await client.generate({
    model,
    system: CLASSIFIER_SYSTEM_PROMPT,
    prompt,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
  });

  try {
    const parsed = parseJsonLike(response.text);
    if (parsed && typeof parsed === "object" && "category" in parsed) {
      const category = (parsed as { category: string }).category;
      if (category === "CHITCHAT" || category === "HR_SPECIALIST") {
        const normalizedRequirement = sanitizeNormalizedRequirement(
          (parsed as { normalizedRequirement?: unknown }).normalizedRequirement,
          currentRequirement,
          latestMessageText,
        );
        return {
          category,
          reason: (parsed as { reason?: string }).reason ?? "",
          normalizedRequirement,
        };
      }
    }
  } catch (err) {
    console.error(
      "[router] Failed to parse classification JSON:",
      err,
      "Raw text:",
      response.text,
    );
  }

  // Fallback default
  return {
    category: "HR_SPECIALIST",
    reason: "Fallback due to JSON parsing error.",
    normalizedRequirement: currentRequirement,
  };
}

function sanitizeNormalizedRequirement(
  raw: unknown,
  currentRequirement: CandidateRequirement | undefined,
  latestMessageText: string,
): CandidateRequirement | undefined {
  if (!raw || typeof raw !== "object") {
    return currentRequirement;
  }
  const input = raw as Record<string, unknown>;
  const result: CandidateRequirement = { ...currentRequirement };

  if (typeof input.role === "string" && isRoleValue(input.role)) {
    result.role = input.role;
  }

  if (Array.isArray(input.skills)) {
    const skills = input.skills
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.toLowerCase());
    if (skills.length > 0) result.skills = Array.from(new Set(skills));
  }

  // Never trust the LLM's location slugs literally — re-derive from raw
  // text, same defensive pattern as parse-jobs-to-sql.ts.
  const derivedSlugs = extractLocationSlugs(latestMessageText);
  if (derivedSlugs.length > 0) {
    result.locationSlugs = Array.from(
      new Set([...(currentRequirement?.locationSlugs ?? []), ...derivedSlugs]),
    );
  }

  if (input.workMode === "remote" || input.workMode === "hybrid" || input.workMode === "onsite") {
    result.workMode = input.workMode;
  }

  if (typeof input.salaryMinVnd === "number" && input.salaryMinVnd > 0) {
    result.salaryMinVnd = input.salaryMinVnd;
  }

  if (typeof input.yearsOfExperience === "number" && input.yearsOfExperience >= 0) {
    result.yearsOfExperience = input.yearsOfExperience;
  }

  if (typeof input.availability === "string" && isAvailabilityValue(input.availability)) {
    result.availability = input.availability;
  }

  if (typeof input.language === "string" && isLanguageValue(input.language)) {
    result.language = input.language;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export async function generateChitchatReply(
  messages: RouterMessage[],
  model: string = "tencent/hy3:free",
  knownFacts?: string,
): Promise<string> {
  const client = new OpenRouterAiClient();
  const historyText = formatHistory(messages);

  let prompt = `Generate the next friendly recruiter reply for this conversation:\n\n${historyText}`;
  if (knownFacts) {
    prompt = `Context:\n${knownFacts}\n\n${prompt}`;
  }

  const response = await client.generate({
    model,
    system: CHITCHAT_SYSTEM_PROMPT,
    prompt,
    temperature: 0.7,
  });

  return response.text;
}

function formatHistory(messages: RouterMessage[]): string {
  const recent = messages.slice(-15); // Use last 15 messages for quick context
  return recent.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n");
}

function parseJsonLike(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
```

Note: `CHITCHAT_SYSTEM_PROMPT` in the current codebase already contains the persona-examples wiring from an earlier change (`import { PERSONA_EXAMPLES } from "../prompt/core-instructions.js";` and an interpolated `${PERSONA_EXAMPLES}` at the end of the template literal) — the block shown above is the pre-persona-examples baseline for clarity; when editing the real file, only change the parts described in this task (imports, types, `CLASSIFIER_SYSTEM_PROMPT`, `classifyIntent`, and the new `sanitizeNormalizedRequirement` function) and leave the existing `CHITCHAT_SYSTEM_PROMPT`/`PERSONA_EXAMPLES` wiring untouched exactly as it is in the current file.

- [ ] **Step 4: Export CandidateRequirement from the package's public entrypoint**

In `packages/agent/src/index.ts`, change:
```typescript
export type { MockZaloPayload, HrSkillMode, SkillDefinition, SkillCacheResult } from "./types.js";
```
to:
```typescript
export type { MockZaloPayload, HrSkillMode, SkillDefinition, SkillCacheResult, CandidateRequirement } from "./types.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/agent/src/core/router.test.ts`
Expected: PASS, 8/8 tests (4 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/core/router.ts packages/agent/src/core/router.test.ts packages/agent/src/index.ts
git commit -m "feat: extend classifyIntent with LLM-based requirement normalization"
```

---

## Task 3: Refactor known-facts.ts to return structured requirement + support requirement_normalizer

**Files:**
- Modify: `packages/core/src/known-facts.ts`
- Modify: `packages/core/src/known-facts.test.ts`

**Interfaces:**
- Consumes: `CandidateRequirement` from `@platform/agent` (Task 2's export).
- Produces: `buildKnownFacts(repos, conversationId): Promise<KnownFacts | undefined>` where `KnownFacts = { text: string; requirement: CandidateRequirement }` — consumed by Task 4 (`reply.ts`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `packages/core/src/known-facts.test.ts` with:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildKnownFacts } from "./known-facts.js";

describe("buildKnownFacts", () => {
  it("returns undefined when there are no audits", async () => {
    const mockRepos = {
      audits: {
        listByConversation: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await buildKnownFacts(mockRepos, "conv-1");
    expect(result).toBeUndefined();
  });

  it("extracts and formats requirement, intent, profile facts, and jobs shown from successful audits", async () => {
    const mockAudits = [
      {
        tool_name: "crm_getCandidateProfile",
        status: "ok",
        output: JSON.stringify({
          displayName: "Alex",
          phone: "+8499999999",
          location: "Hanoi",
        }),
      },
      {
        tool_name: "hr_gatherRequirement",
        status: "ok",
        output: JSON.stringify({
          requirement: {
            role: "Backend Engineer",
            workMode: "remote",
          },
        }),
      },
      {
        tool_name: "jobs_search",
        status: "ok",
        output: JSON.stringify({
          jobs: [
            { id: "job-1", title: "Senior Node.js Developer", company: "Acme Corp" },
            { id: "job-2", title: "Backend Engineer", company: "Globex" },
          ],
        }),
      },
      {
        tool_name: "memory_saveInteractionIntent",
        status: "ok",
        output: JSON.stringify({
          intent: "seeking_jobs",
          requirement: {
            salaryMinVnd: 30000000,
          },
        }),
      },
      {
        tool_name: "hr_gatherRequirement",
        status: "error",
        output: JSON.stringify({
          requirement: {
            role: "Frontend Engineer",
          },
        }),
      },
    ];

    const mockRepos = {
      audits: {
        listByConversation: vi.fn().mockResolvedValue(mockAudits),
      },
    } as any;

    const result = await buildKnownFacts(mockRepos, "conv-1");

    expect(result).toBeDefined();
    expect(result?.text).toContain("# Known Facts So Far");
    expect(result?.text).toContain("- Intent: seeking_jobs");
    expect(result?.text).toContain("- Requirement: role=Backend Engineer, workMode=remote, salaryMinVnd=30000000");
    expect(result?.text).toContain("- CRM Profile Facts: displayName: Alex, phone: +8499999999, location: Hanoi");
    expect(result?.text).toContain("- Jobs already shown: [job-1] Senior Node.js Developer @ Acme Corp, [job-2] Backend Engineer @ Globex");
    expect(result?.requirement).toEqual({
      role: "Backend Engineer",
      workMode: "remote",
      salaryMinVnd: 30000000,
    });
  });

  it("picks up requirement_normalizer audits the same way as hr_gatherRequirement", async () => {
    const mockAudits = [
      {
        tool_name: "requirement_normalizer",
        status: "ok",
        output: JSON.stringify({
          requirement: {
            role: "frontend engineer",
            workMode: "hybrid",
          },
        }),
      },
    ];

    const mockRepos = {
      audits: {
        listByConversation: vi.fn().mockResolvedValue(mockAudits),
      },
    } as any;

    const result = await buildKnownFacts(mockRepos, "conv-1");

    expect(result?.text).toContain("- Requirement: role=frontend engineer, workMode=hybrid");
    expect(result?.requirement).toEqual({ role: "frontend engineer", workMode: "hybrid" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/known-facts.test.ts`
Expected: FAIL — `result` is currently a plain string (or undefined), so `result?.text` and `result?.requirement` are undefined; the third test's `requirement_normalizer` tool name isn't recognized yet either.

- [ ] **Step 3: Implement the refactor**

Replace the full contents of `packages/core/src/known-facts.ts` with:

```typescript
import type { createRepositorySet } from "@platform/database";
import type { CandidateRequirement } from "@platform/agent";

type Repos = ReturnType<typeof createRepositorySet>;

export type KnownFacts = {
  text: string;
  requirement: CandidateRequirement;
};

export async function buildKnownFacts(
  repos: Repos,
  conversationId: string,
): Promise<KnownFacts | undefined> {
  const audits = await repos.audits.listByConversation(conversationId);
  if (!audits || audits.length === 0) {
    return undefined;
  }

  let latestGather: any = null;
  let latestSaveIntent: any = null;
  let latestProfile: any = null;
  const jobsSearched = new Set<string>();

  for (const audit of audits) {
    if (audit.status !== "ok") continue;

    const toolName = audit.tool_name;
    let outputObj: any = null;
    if (typeof audit.output === "string") {
      try {
        outputObj = JSON.parse(audit.output);
      } catch {
        continue;
      }
    } else {
      outputObj = audit.output;
    }

    if (!outputObj) continue;

    if (toolName === "hr_gatherRequirement" || toolName === "requirement_normalizer") {
      latestGather = outputObj;
    } else if (toolName === "memory_saveInteractionIntent") {
      latestSaveIntent = outputObj;
    } else if (toolName === "crm_getCandidateProfile" || toolName === "twenty_getCandidateProfile") {
      latestProfile = outputObj;
    } else if (toolName === "jobs_search" || toolName === "twenty_searchJobs") {
      if (Array.isArray(outputObj.jobs)) {
        for (const job of outputObj.jobs) {
          const id = job.id || job.external_id;
          const title = job.title;
          const company = job.company;
          if (id) {
            jobsSearched.add(`[${id}] ${title}${company ? ` @ ${company}` : ""}`);
          }
        }
      }
    }
  }

  const lines: string[] = [];
  let requirement: Record<string, any> = {};
  let intent: string | null = null;

  if (latestGather?.requirement) {
    requirement = { ...requirement, ...latestGather.requirement };
  }
  if (latestSaveIntent?.requirement) {
    requirement = { ...requirement, ...latestSaveIntent.requirement };
  }
  if (latestSaveIntent?.intent) {
    intent = latestSaveIntent.intent;
  }

  const profileFacts: string[] = [];
  if (latestProfile) {
    const keys = ["displayName", "phone", "email", "location", "yearsOfExperience", "skills", "preferredRoles"];
    for (const key of keys) {
      const val = latestProfile[key];
      if (val !== undefined && val !== null && val !== "" && (!Array.isArray(val) || val.length > 0)) {
        profileFacts.push(`${key}: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
  }

  const reqLines: string[] = [];
  for (const [k, v] of Object.entries(requirement)) {
    if (v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)) {
      reqLines.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
  }

  if (intent) {
    lines.push(`- Intent: ${intent}`);
  }
  if (reqLines.length > 0) {
    lines.push(`- Requirement: ${reqLines.join(", ")}`);
  }
  if (profileFacts.length > 0) {
    lines.push(`- CRM Profile Facts: ${profileFacts.join(", ")}`);
  }
  if (jobsSearched.size > 0) {
    lines.push(`- Jobs already shown: ${Array.from(jobsSearched).join(", ")}`);
  }

  if (lines.length === 0) {
    return undefined;
  }

  return {
    text: [
      "# Known Facts So Far (from earlier tool results - do not re-ask these)",
      ...lines,
    ].join("\n"),
    requirement: requirement as CandidateRequirement,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/known-facts.test.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/known-facts.ts packages/core/src/known-facts.test.ts
git commit -m "feat: return structured requirement from buildKnownFacts, support requirement_normalizer audits"
```

---

## Task 4: Wire reply.ts to the extended classifyIntent and known-facts

**Files:**
- Modify: `packages/core/src/reply.ts`
- Modify: `packages/core/src/reply.test.ts`

**Interfaces:**
- Consumes: `KnownFacts` shape (`{ text, requirement }`) from Task 3's `buildKnownFacts`; `classifyIntent`'s new `currentRequirement` parameter and `normalizedRequirement` return field from Task 2.
- Produces: no new exports — internal wiring only.

- [ ] **Step 1: Write the failing test**

In `packages/core/src/reply.test.ts`, change the import line (line 2-3) from:
```typescript
import { generateAndSaveReply } from "./reply.js";
import { runHrAgentScenario } from "@platform/agent";
```
to:
```typescript
import { generateAndSaveReply } from "./reply.js";
import { runHrAgentScenario, classifyIntent } from "@platform/agent";
```

Then add this test at the end of the `describe("generateAndSaveReply - USE_DB_PROMPT toggle", ...)` block (after the `"fetches prompt from DB when USE_DB_PROMPT is true"` test, before the closing `});`):

```typescript
  it("writes a requirement_normalizer audit entry when classifyIntent returns a normalizedRequirement", async () => {
    vi.mocked(classifyIntent).mockResolvedValueOnce({
      category: "AGENT" as any,
      reason: "test",
      normalizedRequirement: { role: "backend engineer", workMode: "remote" },
    });

    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.audits.append).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conv-1",
        toolName: "requirement_normalizer",
        outputPayload: { requirement: { role: "backend engineer", workMode: "remote" } },
        status: "ok",
      }),
    );
  });

  it("does not write a requirement_normalizer audit entry when normalizedRequirement is absent", async () => {
    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.audits.append).not.toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "requirement_normalizer" }),
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/reply.test.ts`
Expected: FAIL on the first new test — `mockRepos.audits.append` is never called with `toolName: "requirement_normalizer"` since `reply.ts` doesn't write that audit entry yet. The second new test passes trivially already (nothing is wired yet), which is fine — it will keep passing after the real implementation too, since it asserts the negative case.

- [ ] **Step 3: Implement the wiring**

In `packages/core/src/reply.ts`, replace this block (around line 62-71):
```typescript
  const knownFacts = await buildKnownFacts(repos, input.conversationId);

  const classification = await classifyIntent(
    routerMessages,
    classifierModel,
    knownFacts,
  );
  console.log(
    `[core:reply] classification result for conversation ${input.conversationId}: ${classification.category} (reason: ${classification.reason})`,
  );
```
with:
```typescript
  const knownFactsResult = await buildKnownFacts(repos, input.conversationId);

  const classification = await classifyIntent(
    routerMessages,
    classifierModel,
    knownFactsResult?.text,
    knownFactsResult?.requirement,
  );
  console.log(
    `[core:reply] classification result for conversation ${input.conversationId}: ${classification.category} (reason: ${classification.reason})`,
  );

  if (classification.normalizedRequirement && Object.keys(classification.normalizedRequirement).length > 0) {
    await repos.audits.append({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      toolName: "requirement_normalizer",
      outputPayload: { requirement: classification.normalizedRequirement },
      status: "ok",
    });
  }
```

Then replace this block (the chitchat branch, around line 73-78):
```typescript
  if (classification.category === "CHITCHAT") {
    const chitchatText = await generateChitchatReply(
      routerMessages,
      classifierModel,
      knownFacts,
    );
```
with:
```typescript
  if (classification.category === "CHITCHAT") {
    const chitchatText = await generateChitchatReply(
      routerMessages,
      classifierModel,
      knownFactsResult?.text,
    );
```

Then find the `runHrAgentScenario` call (around line 169-196) and change the line:
```typescript
    knownFacts,
```
(the one passed as an option to `runHrAgentScenario`, immediately after `systemPromptOverride,`) to:
```typescript
    knownFacts: knownFactsResult?.text,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/reply.test.ts`
Expected: PASS, 5/5 tests (3 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/reply.ts packages/core/src/reply.test.ts
git commit -m "feat: wire reply.ts to pass currentRequirement and persist requirement_normalizer audits"
```

---

## Task 5: Remove hr_gatherRequirement

**Files:**
- Delete: `packages/agent/src/skills/gather-requirement/handler.ts`
- Delete: `packages/agent/src/skills/gather-requirement/SKILL.md`
- Modify: `packages/agent/src/skills/registry.ts`
- Modify: `packages/agent/src/skills/twenty/registry.ts`
- Modify: `packages/agent/src/skills/twenty/registry.test.ts`
- Modify: `packages/agent/src/prompt/core-instructions.md`
- Regenerate (not hand-edited): `packages/agent/src/prompt/core-instructions.ts`
- Regenerate (not hand-edited): `packages/agent/src/skills-content.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task is pure removal/regeneration.

- [ ] **Step 1: Delete the tool's files**

```bash
rm packages/agent/src/skills/gather-requirement/handler.ts
rm packages/agent/src/skills/gather-requirement/SKILL.md
rmdir packages/agent/src/skills/gather-requirement
```

- [ ] **Step 2: Remove from the default registry**

In `packages/agent/src/skills/registry.ts`, remove this import line:
```typescript
import { createGatherRequirementTool } from "./gather-requirement/handler.js";
```
and remove this line from the returned object in `createAgentTools`:
```typescript
    hr_gatherRequirement: createGatherRequirementTool(),
```

- [ ] **Step 3: Remove from the Twenty registry**

In `packages/agent/src/skills/twenty/registry.ts`, remove this import line:
```typescript
import { createGatherRequirementTool } from "../gather-requirement/handler.js";
```
and remove this line from the returned object in `createTwentyAgentTools`:
```typescript
    hr_gatherRequirement: createGatherRequirementTool(),
```

- [ ] **Step 4: Update the Twenty registry test**

In `packages/agent/src/skills/twenty/registry.test.ts`, remove `"hr_gatherRequirement",` from the expected array, so it reads:
```typescript
    expect(Object.keys(tools).sort()).toEqual(
      [
        "memory_saveInteractionIntent",
        "skills_load",
        "skills_search",
        "twenty_computeJobMatches",
        "twenty_getCandidateProfile",
        "twenty_getRecruitingStatus",
        "twenty_listInProgressApplications",
        "twenty_searchJobs",
        "twenty_updateCandidateProfile",
      ].sort(),
    );
```

- [ ] **Step 5: Update core-instructions.md's Requirement Skills section**

In `packages/agent/src/prompt/core-instructions.md`, find:
```markdown
Use Requirement Skills for temporary preferences:

* Expected salary
* Preferred location
* Remote / Hybrid / Onsite
* Preferred tech stack
* Preferred company type
* Employment type
* Current job search intention

Temporary preferences should NOT overwrite CRM profile.
```
Replace with:
```markdown
Candidate requirement extraction is automatic:

* Expected salary
* Preferred location
* Remote / Hybrid / Onsite
* Preferred tech stack
* Preferred company type
* Employment type
* Current job search intention

These temporary preferences are normalized and merged into the Conversation State Context's requirement block automatically before your turn starts — you do not need to call any tool for this. Never re-ask for information already present there. Temporary preferences should NOT overwrite CRM profile.
```

- [ ] **Step 6: Regenerate the generated files**

Run: `npx tsx scripts/generate-skills-content.ts`

Expected output:
```
Generating skills content...
Generated static skills content successfully at: /Users/phuc.dang/repos/twenty/packages/agent/src/skills-content.ts
Generated static core instructions successfully at: /Users/phuc.dang/repos/twenty/packages/agent/src/prompt/core-instructions.ts
```

- [ ] **Step 7: Verify the regenerated files reflect the removal**

Run: `grep -c "gather-requirement" packages/agent/src/skills-content.ts`
Expected: `0`

Run: `grep -c "Candidate requirement extraction is automatic" packages/agent/src/prompt/core-instructions.ts`
Expected: `1`

- [ ] **Step 8: Run the full agent + core test suites**

Run: `npx vitest run packages/agent/src packages/core/src`
Expected: PASS, all tests green, with the Twenty registry test now expecting 9 tools instead of 10.

- [ ] **Step 9: Commit**

```bash
git add -A packages/agent/src/skills/gather-requirement packages/agent/src/skills/registry.ts packages/agent/src/skills/twenty/registry.ts packages/agent/src/skills/twenty/registry.test.ts packages/agent/src/prompt/core-instructions.md packages/agent/src/prompt/core-instructions.ts packages/agent/src/skills-content.ts
git commit -m "feat: remove hr_gatherRequirement now that normalization runs automatically"
```

---

## Task 6: Full regression and manual normalization smoke test

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Run the full monorepo test suite**

Run: `npx vitest run`
Expected: PASS, every test file green (this includes all tests touched or added in Tasks 1-5, plus everything else untouched).

- [ ] **Step 2: Type-check the touched packages**

Run: `cd packages/agent && npx tsc --noEmit && cd ../core && npx tsc --noEmit && cd ../..`
Expected: no type errors. If `packages/agent` or `packages/core` don't have a local `tsconfig.json`/`tsc` set up this way, use whatever the repo's existing typecheck command is (`pnpm typecheck` from root, per `package.json`'s `"typecheck": "turbo run typecheck"` script) instead: `pnpm typecheck`.

- [ ] **Step 3: Check for the OPENROUTER_API_KEY**

Run: `grep -c "OPENROUTER_API_KEY" .env.local 2>/dev/null || echo "not set"`

If "not set": ask the user for an `OPENROUTER_API_KEY` before proceeding — Step 4 makes a real LLM call and cannot run without it.

If it exists in `.env.local` but the check in Step 4 below still reports it as missing, export it manually for the shell session (there is a known unrelated bug in `packages/agent/src/cli/hr-chat.ts`'s own env loader that does not apply to this script, since this script loads env independently — see Step 4's command):
```bash
export OPENROUTER_API_KEY=$(grep "^OPENROUTER_API_KEY=" .env.local | cut -d= -f2-)
```

- [ ] **Step 4: Manually verify live normalization behavior**

Create a temporary script (not committed) at `scripts/tmp-verify-normalization.ts`:

```typescript
import { classifyIntent } from "@platform/agent";

async function main() {
  const result1 = await classifyIntent(
    [{ role: "user", content: "Mình biết ReactJS, muốn làm backend, lương mong muốn 2k đô ở Đà Nẵng" }],
    "tencent/hy3:free",
  );
  console.log("Result 1 (skills/role/salary/location in one message):");
  console.log(JSON.stringify(result1, null, 2));

  const result2 = await classifyIntent(
    [{ role: "user", content: "Mình có thể onsite hoặc hybrid đều được, sẵn sàng đi làm ngay" }],
    "tencent/hy3:free",
    undefined,
    result1.normalizedRequirement,
  );
  console.log("\nResult 2 (workMode/availability merged with prior turn's requirement):");
  console.log(JSON.stringify(result2, null, 2));
}

main();
```

Run:
```bash
npx tsx scripts/tmp-verify-normalization.ts
```

Expected: `result1.normalizedRequirement` includes `role: "backend engineer"`, `skills` containing `"react"`, `salaryMinVnd: 50000000` (2000 USD × 25,000), and `locationSlugs` containing `"da-nang"`. `result2.normalizedRequirement` should contain everything from `result1.normalizedRequirement` **plus** `workMode` and `availability` (proving the merge-with-currentRequirement behavior works end-to-end against a live model, not just the mocked unit tests).

If any of these don't come through correctly, do not treat it as a bug in the deterministic validation/fallback code (which Tasks 1-4's unit tests already cover) — it means the classifier prompt's wording needs adjusting. Report the actual output and stop for guidance rather than iterating on the prompt unsupervised.

- [ ] **Step 5: Remove the temporary script**

```bash
rm scripts/tmp-verify-normalization.ts
```

(No commit for this task — verification only, and the temporary script is removed, not committed.)

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers design spec §1 (taxonomy). Task 2 covers §2 (classifyIntent extension) and §3 (validation/fallback). Task 3 and Task 4 together cover §5 (known-facts.ts fix + reply.ts wiring). Task 5 covers §4 (removal). Task 6 covers §6 (testing — both the deterministic unit tests already added in Tasks 1-4, and the manual live-model smoke test).
- **Placeholder scan:** no TBD/TODO; all code steps show complete, exact code including the full replacement file contents for `router.ts` and `known-facts.ts` (small files, replaced wholesale for clarity rather than diffed, since both are short enough to show in full).
- **Type consistency:** `CandidateRequirement` is imported from `../types.js` in `router.ts` (Task 2) and from `@platform/agent` in `known-facts.ts` (Task 3) and used identically in `reply.ts` (Task 4) via the `KnownFacts` shape Task 3 defines. `normalizedRequirement?: CandidateRequirement` on `ClassificationResult` (Task 2) is the same type consumed by Task 4's `classification.normalizedRequirement` checks. The `requirement_normalizer` tool name string is used identically in Task 3 (`known-facts.ts`'s tool-name check) and Task 4 (`reply.ts`'s `repos.audits.append` call).
