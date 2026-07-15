# Candidate Requirement Normalization — Design

## Background

`hr_gatherRequirement` (`packages/agent/src/skills/gather-requirement/handler.ts`) is the tool that turns free-text chat messages into structured `CandidateRequirement` fields (role, location, salary, skills, work mode, availability, language). Today it's 100% regex/keyword matching:

- `role` is set by 4 hardcoded regex categories (frontend/backend/AI/recruiter), overwriting each other if a message matches more than one — no canonical taxonomy, no enum.
- `skills` is a fixed list of exactly 7 hardcoded keywords (`react`, `node`, `typescript`, `nestjs`, `python`, `sql`, `recruiting`), matched via `text.includes()`.
- `salary` extraction is a chain of increasingly fragile numeric regex heuristics, including a bare "any 3-4 digit number between 500-20000 is probably a raw USD salary" guess.
- `availability` and `language` each detect exactly one hardcoded phrase.
- `locationSlugs` and `workMode` are the two fields already done right: locations map through a canonical slug list (`packages/shared/src/locations.ts` + `core/location-normalizer.ts`), and `workMode` is already a strict `"remote" | "hybrid" | "onsite"` enum matched by equality.

Separately, `jobs_search`/`twenty_searchJobs` score candidates against jobs via `scoreJob()` (`core/location-normalizer.ts`), which matches `role` by substring/word-inclusion against the job title (not exact-enum) and `skills` by case-insensitive exact string equality against `job.requiredSkills`.

Confirmed out of scope for this design (from discussion): job-posting ingestion (`services/worker/scripts/twenty/parse-jobs-to-sql.ts`) already uses an LLM and is a separate pipeline — left for a follow-up spec.

**Prior art note:** an earlier document, `docs/prompting_system_upgrade_plan.md`, already designed the `tool_call_audits` → `known-facts.ts` durable-memory mechanism this spec builds on, and at the time explicitly decided to *keep* `hr_gatherRequirement` because "their audited outputs are precisely the durable memory we replay." This spec doesn't reverse that goal — §5 below preserves the exact same durable-memory property by having `reply.ts` write an equivalent audit entry directly from the classifier's output, so `known-facts.ts` keeps working unchanged in spirit. What changes is *how* the audited requirement gets produced (a folded-in LLM call instead of a regex-driven agent tool), not the memory architecture itself.

## Goals

- Replace the regex-only extraction with an LLM-based normalization pass that maps free text onto a canonical, lowercase taxonomy for `role`, `skills`, `availability`, and `language`.
- Run this pass automatically, once per turn, before the main HR_SPECIALIST tool-calling loop starts — not as an agent-invoked tool.
- Keep total LLM calls per turn at 2 (classify+normalize combined, then the main agent loop), not 3.
- Fix the two other real gaps found along the way: `hr_gatherRequirement`'s removal breaking `known-facts.ts`'s cross-turn requirement continuity, and the brittle USD/VND salary-guessing regex.

## Non-goals

- Job-posting ingestion normalization (`parse-jobs-to-sql.ts`) — separate follow-up spec.
- Changing `scoreJob()`'s matching algorithm. Canonical 2-3 word role values (e.g. `"fullstack engineer"`) still substring-match realistic job titles (`scoreRoleMatch` requires every word in the filter role to appear in the title — verified against real job titles like "Fullstack Software Engineer (Node.js, React)_Thoughtworks"), so no changes are needed there.
- A closed, reject-unknown enum for `skills`. Job-relevant technology terms change too often for a strict enum to stay usable — see Design §1.

## Design

### 1. Canonical taxonomy — new file `packages/agent/src/core/requirement-taxonomy.ts`

All values lowercase, mirroring the existing `packages/shared/src/locations.ts` pattern:

```ts
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

// Reference vocabulary, not a closed enum — see Non-goals. The LLM is
// instructed to normalize to one of these when there's a clear match, and
// to pass through its own lowercased term otherwise.
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
export const LANGUAGE_VALUES = ["english", "vietnamese"] as const;
```

`ROLE_VALUES` was derived from `packages/database/src/seed-jobs.ts`'s 10 role tracks plus `"support engineer"` (present in the real Thoughtworks postings in `jobs_insert.sql` but absent from the synthetic seed list) and `"recruiter"` (carried over from the current `hr_gatherRequirement`, since this is an HR-recruiting vertical where candidates can themselves be recruiters). `SKILL_VALUES` was derived from the union of `seed-jobs.ts`'s per-role skill lists and the actual `required_skills` arrays in `jobs_insert.sql`.

### 2. Extend `classifyIntent`'s response schema

`packages/agent/src/core/router.ts`'s `CLASSIFIER_SYSTEM_PROMPT` gains:
- The `ROLE_VALUES`/`AVAILABILITY_VALUES`/`LANGUAGE_VALUES` lists spelled out, with an instruction to pick the closest match or omit the field.
- `SKILL_VALUES` spelled out as a reference vocabulary, with an instruction to normalize to it when there's a clear match and otherwise return its own best lowercase term.
- The existing USD→VND salary conversion instruction (currently duplicated ad hoc in `jobs_search`'s tool description: "multiply by 25,000") moved here as the authoritative extraction point.
- An instruction that returned `locationSlugs` are advisory only — the caller re-derives them from raw text (see §3).

`classifyIntent(messages, model, knownFacts)` gains a new parameter, `currentRequirement?: CandidateRequirement`, passed as context the same way `knownFacts` already is, so the model can merge new information with what's already known rather than just extracting from the latest message in isolation.

Response JSON shape:
```ts
{
  category: "CHITCHAT" | "HR_SPECIALIST",
  reason: string,
  normalizedRequirement?: {
    role?: string,            // must be one of ROLE_VALUES or omitted
    skills?: string[],        // lowercase; normalized to SKILL_VALUES where possible
    locationSlugs?: string[], // advisory, re-derived by the caller — see §3
    workMode?: "remote" | "hybrid" | "onsite",
    salaryMinVnd?: number,
    yearsOfExperience?: number,
    availability?: string,    // must be one of AVAILABILITY_VALUES or omitted
    language?: string,        // must be one of LANGUAGE_VALUES or omitted
  },
}
```

`normalizedRequirement` represents the full merged requirement (existing + new), not a delta — the same contract `hr_gatherRequirement` had via its `existingRequirement` parameter.

### 3. Validation and fallback (`router.ts`)

After `JSON.parse`, before accepting `normalizedRequirement`:
- `role`: if present and not in `ROLE_VALUES`, drop the field (keep prior value from `currentRequirement`, don't accept the garbage value).
- `availability` / `language`: same drop-if-invalid rule.
- `skills`: lowercase every entry; no rejection (see Non-goals).
- `locationSlugs`: **ignore the LLM's proposed value entirely** and instead call the existing `extractLocationSlugs()` (`core/location-normalizer.ts`) against the raw latest message text, merged with `currentRequirement.locationSlugs` — same defensive "never trust the LLM's slugs literally" pattern already used in `services/worker/scripts/twenty/parse-jobs-to-sql.ts`.
- If the whole `normalizedRequirement` is missing or `JSON.parse` fails: leave `currentRequirement` completely unchanged for this turn. Never crash, never partially apply a malformed object — same fail-safe posture `classifyIntent` already has for `category` (falls back to `HR_SPECIALIST`).

### 4. Remove `hr_gatherRequirement`

Confirmed via full-repo grep, every touch point:
- Delete `packages/agent/src/skills/gather-requirement/` (both `handler.ts` and `SKILL.md`).
- Remove the import and registration from `packages/agent/src/skills/registry.ts` and `packages/agent/src/skills/twenty/registry.ts`.
- Update `packages/agent/src/prompt/core-instructions.md`'s "Requirement Skills" section, which currently instructs the agent to call `hr_gatherRequirement` — replace with language reflecting that requirement extraction now happens automatically, and the agent should simply trust `state.requirement`/the Conversation State Context block.
- `scripts/generate-skills-content.ts` naturally stops emitting an entry for the deleted skill directory on its next run — no generator changes needed.

### 5. Fix `known-facts.ts`'s cross-turn continuity gap

`packages/core/src/known-facts.ts:36` currently reconstructs requirement continuity by scanning `tool_call_audits` for the latest `hr_gatherRequirement` output. Deleting that tool with no replacement would silently stop requirement info from ever appearing in "known facts" for any conversation going forward (old audit rows would still be found for a while, then go stale).

Fix: `packages/core/src/reply.ts`, immediately after the extended `classifyIntent` call, writes an audit entry via `repos.audits.append(...)` with `tool_name: "requirement_normalizer"` and `output: { requirement: normalizedRequirement }` — same shape `hr_gatherRequirement`'s audit entries already have. `known-facts.ts:36` changes from:
```ts
if (toolName === "hr_gatherRequirement") {
```
to:
```ts
if (toolName === "hr_gatherRequirement" || toolName === "requirement_normalizer") {
```
This is backward-compatible with historical audit data (old `hr_gatherRequirement` entries are still picked up) and requires no other changes to `known-facts.ts`'s merge logic, since both tool names produce the same `{ requirement: {...} }` output shape.

### 6. Testing

- `router.test.ts`: extend with cases for — a mocked response containing a valid `normalizedRequirement` merges correctly into state; an invalid `role` value (not in `ROLE_VALUES`) is dropped rather than accepted; malformed/missing `normalizedRequirement` leaves the existing requirement untouched; `locationSlugs` in the mocked response are ignored in favor of `extractLocationSlugs()`'s own output from the raw message text.
- `known-facts.test.ts`: extend with a case asserting a `requirement_normalizer` audit entry is picked up the same way `hr_gatherRequirement` entries are.
- Manual smoke test (same CLI-driven approach used for the persona-examples work): verify a live model correctly maps free text like "mình biết ReactJS" → `skills: ["react"]` and "2k đô" → the correct VND `salaryMinVnd`. This is inherently a live-model behavior check, not a deterministic unit test — the unit tests above cover the deterministic validation/fallback/merge logic around it.
