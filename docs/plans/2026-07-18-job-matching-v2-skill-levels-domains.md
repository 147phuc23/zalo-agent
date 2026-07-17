# Job Matching v2 — skill levels, priority weighting, domains, referral bonus

Upgrades Feature 4 ([04-job-matching.md](2026-07-16-missing-features/04-job-matching.md)). Depends on: migrations through `17_company_interview_process.sql`; the unified `documents` → `document.process` pipeline (`packages/agent/src/core/document-processor.ts`), which is the **live** CV/JD extraction path — `cv-extractor.ts` / `cv.uploaded` queue is the retired stub and is **not** touched by this plan.

## Goal

Today's matching is purely lexical: flat `required_skills text[]` / `skills text[]`, additive rule scoring (`scoreJob` in `location-normalizer.ts`), Postgres `ts_rank` FTS, and a hybrid `0.4·ftsRank + 0.6·Jaccard` in `match-candidate/handler.ts`. This plan adds:

1. **Skill levels** (Basic/Intermediate/Advanced/Expert) on both JD-required and candidate-held skills.
2. **JD skill priority ordering** (most→least required) + **mandatory flag** + **min years**.
3. **Candidate domain tagging** (banking, ecommerce, gaming, fintech, …) matched against **JD domain**.
4. **Referral bonus** as a ranking input, but only in a new **headhunter view** — never shown or used to rank in the candidate-facing Zalo view.
5. A single scoring engine reused by both views (no divergent logic).
6. **Semantic rerank + RAG-domain** (pgvector cosine over composed job/candidate text) built **in this phase behind a kill-switch** — the fuzzy-recall / "RAG for domain" half of the ask.
7. **Faithful job-listing import** — a mapping of the real external listing DTO (your pasted Recruitery payload) into the schema, lossless via `external_raw`.

## Locked decisions (user-confirmed)

- **Ranking engine**: extend structured scoring + Postgres FTS (`ts_rank`) **+ pgvector semantic rerank (now, behind a flag)**. `ts_rank` remains the BM25 approximation; a true external BM25 engine (Typesense/Meilisearch/ParadeDB `pg_search`) stays out — Neon can't host the extension and it's a new always-on service (see Non-goals; flag to reverse if you accept the infra).
- **Semantic rerank + RAG-domain: built in this phase**, gated by `JOB_MATCHING_SEMANTIC` (`auto`|`on`|`off`, default `auto` = on iff an embeddings key is present). `vector(1536)` columns get `hnsw` indexes and are populated from an embeddings API (OpenAI `text-embedding-3-small` or Gemini — OpenRouter has no embeddings endpoint). When the flag is `off` or no key is set, matching degrades gracefully to structured + FTS only, with identical result shape. (User override: originally "RAG later"; now pulled forward with a kill-switch.)
- **Domain matching**: LLM classifies into a **fixed taxonomy** at extraction time (`domains text[]` on both tables) → set overlap (always on), **plus** embedding cosine similarity over the composed domain/profile text (the "RAG" layer) when the semantic flag is on.
- **Skill scale**: one 4-level scale used on both JD (`requiredLevel`) and CV (`level`): **1 Basic / 2 Intermediate / 3 Advanced / 4 Expert**. When a level isn't stated in source text, derive it from years (table below).
- **Audience**: both. One engine, two views — bonus is a candidate/headhunter *view* concern, not a separate matching algorithm.
- **Assumptions carried forward from the design conversation (flag if wrong before Step 1):**
  - (a) Skills stored as `jsonb` on the existing row (`skills_detail`), not a child table — matches existing `work_history`/`education` jsonb pattern and avoids joins in the in-memory scorer.
  - (b) Referral bonus is a **bounded boost within similar-fit bands**, not a hard sort key — a high bonus can never float a badly-fitting job above a well-fitting one.
  - (c) Missing mandatory skill is a **soft gate** (heavy penalty, still returned, ranked low) — not a hard exclude — so the headhunter/candidate can still see "close but missing X" instead of the job vanishing.

## Skill level scale

| Level | Name | Meaning | Years (derivation fallback) |
|---|---|---|---|
| 1 | Basic | Aware of it / used under guidance | < 1y |
| 2 | Intermediate | Productive independently | 1–3y |
| 3 | Advanced | Strong, drives design/features | 3–5y |
| 4 | Expert | Mentors others / architecture-level | 5y+ |

Derivation only fires when the source text gives years but no explicit level word (e.g. JD says "Terraform, Ansible" with no adjective → level derived from `experienceYearFrom`/`minYearExperience` if present, else default `2` for a plainly-listed JD skill, default `1` for a CV skill mentioned once in passing vs. `3`+ if it appears as a headline/current-role skill — see extraction prompt below for the exact heuristic given to the LLM).

## Domain taxonomy (fixed vocabulary, v1)

`banking, fintech, insurance, ecommerce, gaming, healthcare, edtech, logistics, manufacturing, telecom, saas_b2b, crypto_web3, real_estate, government, media_adtech, travel_hospitality, agritech, energy_utilities, legaltech, other`

Stored as `text[]` of these slugs (validated app-side against this list; unknown LLM output maps to `other`). Extending the list later is additive (no migration needed — it's a plain `text[]`, not an enum).

## Data model

Two migrations: `18_job_matching_v2.sql` (core structured schema, always applied) and `19_semantic_matching.sql` (hnsw indexes for the semantic flag). Additive only. Existing `required_skills` / `skills` / `languages` arrays are **kept** (regenerated from the new detail columns) so `search_tsv`, `scoreJob`, and `scoreJobAgainstProfile` keep working unmodified — the single most important constraint: **nothing existing may break**.

### Payload → schema mapping

The pasted Recruitery job DTO drives the shape. Matching-relevant fields are promoted to real columns; the **entire raw DTO is stored losslessly in `external_raw jsonb`** (same pattern as `candidate_profiles.raw_extraction`) so nothing is dropped and re-mapping later needs no re-fetch. Pure-marketplace cruft (galleries, benefit icons, `shopLogo`, `timestamp`, view counts) lives only in `external_raw`.

| Source DTO field(s) | Our column | Notes |
|---|---|---|
| `jobSkillDTOs[]` `{skillId, skillName, minYearExperience, mandatory}` | `skills_detail jsonb` | **Source has no level** → `requiredLevel` derived from `minYearExperience` (table above); `priority` = array order (DTO lists most-required first); `externalId` = `skillId` |
| `jobIndustryDTOs[]` `{industryId, industryName, minYearExperience}` | `domains text[]` (+ min-years kept in `external_raw`) | industry → domain-taxonomy slug via a mapping constant; unmapped → `other` |
| `jobLanguageDTOs[]` `{languageName, proficiencyLevel}` | `languages_detail jsonb` (+ keep `languages text[]`) | `[{name, proficiency}]`, e.g. `{English, Fluent}` |
| `jobRoleDTOs[]` `{roleName}`, `roles` | `roles text[]` | augments title-only role matching |
| `bonusAmount`,`bonusAmountUSD` | `referral_bonus_vnd`,`referral_bonus_usd` | placement commission — headhunter view only |
| `bonusInterview`,`bonusCV`,`rewardAmount`,`warrantyDay` | `bonus_interview_vnd`,`bonus_cv_vnd`,`reward_amount_vnd`,`warranty_days` | referral economics |
| `isShowSalary`,`isDealSalary` | `is_show_salary`,`is_deal_salary` bool | **`isShowSalary=false` ⇒ redact salary even in headhunter view** — respect source intent |
| `salaryFrom/To`,`foreignCurrencyId` | existing `salary_min_vnd`/`salary_max_vnd` | convert to VND on import (USD×~25000, per existing JD prompt convention) |
| `numberRecruitment` | `number_recruitment int` | openings |
| `experienceYearFrom/To`,`isExperience` | `experience_year_from/to int` | experience gate |
| `degreeName`,`degreeId` | existing `education_required` | e.g. "Bachelor" |
| `employmentTypeName` | `employment_type text` | Full Time / Contract |
| `levelDifficultName` | `job_difficulty text` | "Easy Win" — headhunter signal |
| `note`,`notePrivate` | `headhunter_note text` | **internal**, headhunter view only, never candidate-facing |
| `priority` (nice-to-have text) | `priority_text text` | source for `mandatory=false` skills |
| `whyWokingHere` | `why_working_here text` | selling points |
| `interviewingProcess` | existing interview-process (mig. 17) | |
| `code`,`id`,`jobFrom` | existing `external_id` + `external_code text`,`external_source text` | dedup / provenance |
| everything else | `external_raw jsonb` | lossless |

### Migration `18_job_matching_v2.sql`

```sql
-- job_postings: structured skills + domains + languages + referral economics + import provenance
alter table public.job_postings add column if not exists skills_detail jsonb not null default '[]';
-- [{ externalId, slug, name, requiredLevel: 1-4, mandatory: bool, priority: 1..N, minYears: int }]
alter table public.job_postings add column if not exists domains text[] not null default '{}';
alter table public.job_postings add column if not exists roles text[] not null default '{}';
alter table public.job_postings add column if not exists languages_detail jsonb not null default '[]';
-- [{ name, proficiency }]

alter table public.job_postings add column if not exists referral_bonus_vnd bigint not null default 0;
alter table public.job_postings add column if not exists referral_bonus_usd numeric(12,2);
alter table public.job_postings add column if not exists bonus_interview_vnd bigint not null default 0;
alter table public.job_postings add column if not exists bonus_cv_vnd bigint not null default 0;
alter table public.job_postings add column if not exists reward_amount_vnd bigint not null default 0;
alter table public.job_postings add column if not exists warranty_days int;

alter table public.job_postings add column if not exists number_recruitment int;
alter table public.job_postings add column if not exists experience_year_from int;
alter table public.job_postings add column if not exists experience_year_to int;
alter table public.job_postings add column if not exists employment_type text;
alter table public.job_postings add column if not exists job_difficulty text;
alter table public.job_postings add column if not exists is_show_salary boolean not null default true;
alter table public.job_postings add column if not exists is_deal_salary boolean not null default false;

alter table public.job_postings add column if not exists headhunter_note text;   -- internal, never candidate-facing
alter table public.job_postings add column if not exists priority_text text;
alter table public.job_postings add column if not exists why_working_here text;
alter table public.job_postings add column if not exists external_code text;
alter table public.job_postings add column if not exists external_source text;
alter table public.job_postings add column if not exists external_raw jsonb not null default '{}';  -- full source DTO

create index if not exists job_postings_domains_idx on public.job_postings using gin (domains);
create index if not exists job_postings_skills_detail_idx on public.job_postings using gin (skills_detail);

-- candidate_profiles: rated skills + domain history + rated languages
alter table public.candidate_profiles add column if not exists skills_detail jsonb not null default '[]';
-- [{ slug, name, level: 1-4, years: number|null, evidence: text }]
alter table public.candidate_profiles add column if not exists domains text[] not null default '{}';
alter table public.candidate_profiles add column if not exists languages_detail jsonb not null default '[]';

create index if not exists candidate_profiles_domains_idx on public.candidate_profiles using gin (domains);
create index if not exists candidate_profiles_skills_detail_idx on public.candidate_profiles using gin (skills_detail);
```

### Migration `19_semantic_matching.sql` (gated feature — indexes are harmless when unused)

```sql
-- hnsw over the existing vector(1536) columns (added in 15_job_search_fts.sql / 10_candidate_profiles.sql).
-- Building on empty columns is instant; index fills as embeddings are generated.
create index if not exists job_postings_embedding_hnsw
  on public.job_postings using hnsw (embedding vector_cosine_ops);
create index if not exists candidate_profiles_embedding_hnsw
  on public.candidate_profiles using hnsw (embedding vector_cosine_ops);

-- track which model produced the vector, so a model change can trigger re-embedding
alter table public.job_postings      add column if not exists embedding_model text;
alter table public.candidate_profiles add column if not exists embedding_model text;
```

Backfill (in migration 18, idempotent): for existing rows populate `skills_detail` from `required_skills`/`skills` at `requiredLevel/level = 2`, `mandatory = false`, `priority` = index+1, `minYears = null`; `languages_detail` from `languages` with `proficiency = null`. Guarantees existing rows score under the new engine identically to a "no extra info" default, never zero.

**Must-have:** migration 18 is a no-op for reads touching only old columns; migration 19 is fully skippable (semantic flag `off`). **Validation:** apply both to a branch DB; `select required_skills, skills_detail, domains from job_postings limit 5` shows backfilled detail; existing `jobs.searchFts` + `candidateProfiles.search` integration tests pass unmodified; `\d job_postings` shows the hnsw index present but empty.

## Extraction changes (reuse `document-processor.ts` — no new pipeline)

Both `JD_EXTRACTOR_SYSTEM_PROMPT` and `CandidateProfileSchema`/CV prompt in `packages/agent/src/core/document-processor.ts` gain fields; same LLM call, same `OpenRouterAiClient`, same `json_object` mode — **no new model, no new infra**.

**JD extraction adds:**
```jsonc
"skillsDetail": [
  { "name": "Terraform", "requiredLevel": 3, "mandatory": true, "priority": 1, "minYears": 3 },
  { "name": "Kubernetes", "requiredLevel": 2, "mandatory": false, "priority": 6, "minYears": 0 }
],
"domains": ["banking"] // subset of the fixed taxonomy; [] if unclear — never invent outside the list
```
Prompt instructs: order `skillsDetail` **most-required → least-required** (mirrors the source `jobRequirement` vs `priority` field distinction in the pasted example job — "requirement" skills outrank "priority/nice-to-have" skills), infer `mandatory` from language ("must have", "required" → true; "a plus", "nice to have" → false), derive `requiredLevel` from adjectives or `minYearExperience`-style phrasing per the table above.

**CV extraction adds:**
```jsonc
"skillsDetail": [
  { "name": "React", "level": 3, "years": 4, "evidence": "3 of 4 listed roles use React as primary stack" }
],
"domains": ["ecommerce", "saas_b2b"]
```
Prompt instructs: derive `level` from recency/repetition/seniority of role in `workHistory`, not just mention count; `domains` from company/industry context in `workHistory`, capped to the fixed taxonomy.

Both extractions validate `skillsDetail[].name` against nothing (free text — matched fuzzily to `required_skills`/`skills` at write time via existing lowercase-trim comparison, same normalization `match-candidate/handler.ts` already does) and `domains` values against the fixed list app-side (drop/remap anything unrecognized to `other`, log a warning — LLM output is untrusted input).

**Must-have:** extraction failures must not break the existing pipeline — `skillsDetail`/`domains` default to `[]` on parse error, exactly like current `skills`/`preferredRoles` defaults. **Validation:** golden-fixture test — feed the pasted DevOps JD verbatim, assert `Terraform`/`Ansible`/`Python`/`Bash` land as `mandatory: true, priority ≤ 3` (from `jobRequirement`) and `Jenkins`/`Groovy`/OCI-cert land as `mandatory: false` (from `priority` nice-to-have field), `domains` includes `other` or a plausible tag (this JD has no strong domain signal — acceptable).

## Scoring engine — new pure module

New file `packages/agent/src/core/job-fit-scorer.ts`, sitting alongside (not replacing) `location-normalizer.ts`'s `scoreJob`/`scoreJobAgainstProfile` — those keep working for any caller not yet upgraded; the new module is additive and the two Step-4 wiring points switch to it.

```ts
export interface JdSkillReq { slug: string; name: string; requiredLevel: 1|2|3|4; mandatory: boolean; priority: number; minYears: number; }
export interface CandidateSkill { slug: string; name: string; level: 1|2|3|4; years: number | null; }

export function scoreSkillFit(jdSkills: JdSkillReq[], candidateSkills: CandidateSkill[]): {
  score: number;            // priority-weighted, level-aware
  mandatoryGatePenalty: number; // 0 if all mandatory met, else large
  matchedDetail: Array<{ skill: string; required: number; held: number | null; weight: number }>;
}

export function scoreDomainFit(jobDomains: string[], candidateDomains: string[]): { score: number; overlap: string[] };

export function computeJobFit(input: {
  base: ScoredJobResult;              // existing scoreJob()/scoreJobAgainstProfile() output — untouched signal
  skillFit: ReturnType<typeof scoreSkillFit>;
  domainFit: ReturnType<typeof scoreDomainFit>;
  ftsRank: number;                    // existing ts_rank, 0..1
  semantic?: number;                  // cosine similarity 0..1, undefined when semantic flag off → term drops out
}): { fit: number; reasons: string[] };

export function applyReferralBoost(rankedJobs: Array<{ fit: number; referralBonusVnd: number }>): typeof rankedJobs;
// bounded boost: only reorders within a fit-band (e.g. |fitA - fitB| < BAND_WIDTH); never promotes a low-fit
// job above a high-fit one purely on bonus size. BAND_WIDTH and boost weight are named constants, tunable.
```

**Weighting** (priority → weight): `priorityWeight(p) = 1 / p` (priority 1 gets weight 1.0, priority 2 gets 0.5, …) — simplest monotonic decay that needs no tuning data to start with; documented as the first thing to revisit once real match outcomes exist.

**Level match**: `candidateLevel ≥ requiredLevel → 1.0`, `candidateLevel = requiredLevel − 1 → 0.5`, else `0`. Missing skill entirely → `0` and, if `mandatory`, contributes to `mandatoryGatePenalty`.

`computeJobFit` combines: `fit = base + w1·skillFit + w2·domainFit + w3·ftsRank + w4·semantic − mandatoryGatePenalty`. When `semantic` is `undefined` (flag off / no embedding), `w4·semantic` drops out and the remaining weights are unchanged — so turning the flag off never re-scales the other signals.

**Must-have:** every function above is pure (no DB/IO) — fully unit-testable without a database or LLM (the caller supplies the precomputed cosine as a number). **Validation:** table-driven unit tests, one table per function, covering: all-mandatory-met, one-mandatory-missing (penalty applies but doesn't zero the score), priority-1-vs-priority-6 weighting difference, domain-overlap/no-overlap, bonus-boost-within-band vs bonus-boost-blocked-across-band, and `semantic` present vs `undefined` (identical ranking of the non-semantic signals). Run: `pnpm --filter @platform/agent test`.

## Semantic layer (RAG) — built now, flag-gated

The "RAG for domain" + fuzzy-recall half of your ask. Entirely behind `JOB_MATCHING_SEMANTIC` — when off/unkeyed the system is byte-for-byte the structured+FTS engine.

**Embeddings client (reuse `@platform/ai-client`):** add an `embed(texts: string[]): Promise<number[][]>` method next to the existing `OpenRouterAiClient.generate`. OpenRouter has no embeddings endpoint, so this calls the configured embeddings provider directly:
- Env: `EMBEDDINGS_PROVIDER` (`openai`|`gemini`), `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL` (default `text-embedding-3-small`, **1536 dims — matches the existing `vector(1536)` columns**). `workflow_configs.embedding_model` already exists for this.
- `JOB_MATCHING_SEMANTIC=auto` resolves to `on` iff `EMBEDDINGS_API_KEY` is set; `on` without a key is a hard startup error (fail loud, don't silently degrade a deliberately-on flag); `off` disables all embedding reads/writes.

**Composed embedding text** (what we vectorize — structured, not raw dump):
- Job: `title · roles · top-N skills by priority · domains · seniority · short description`.
- Candidate: `currentTitle · top skills by level · domains · preferredRoles · summary`.
Composing from structured fields (not the raw CV/JD blob) keeps vectors focused on match-relevant signal and cheap.

**Generation path (reuse the `knowledge.embed` queue + worker — no new queue):** after `document.process` upserts a job/profile, enqueue `knowledge.embed {kind: 'job_posting'|'candidate_profile', id}`. The worker composes text → `embed()` → `UPDATE ... SET embedding = $1, embedding_model = $2`. A one-off backfill script enqueues every existing active job + profile. Embeddings are regenerated when the composed fields change (re-enqueue on upsert) — cheap and keeps vectors fresh.

**Rerank path (two-stage — recall then semantic):** structured + FTS produce a top-K candidate set (K≈50, cheap); we then fetch the query embedding (candidate profile vector, or an on-the-fly `embed()` of the search requirement text) and compute `semantic = 1 - (embedding <=> queryEmbedding)` for those K via a single SQL pass (`order by embedding <=> $1`), feeding each into `computeJobFit`. We do **not** replace FTS with vector search — vector is a **rerank within the recalled set**, so a missing/NULL embedding just yields `semantic = undefined` for that row (graceful, per-row).

**Cost/latency:** one embedding per job/profile write (~$0.00002 each on `text-embedding-3-small`) + one query embedding per match request (skipped when the candidate already has a stored vector). hnsw ANN keeps the rerank sub-10ms at this scale. All avoidable by flag.

**Must-have:** flag `off` ⇒ zero embedding API calls, zero `embedding`-column reads, identical results to structured+FTS. **Validation:** run the match suite twice (flag on / off); assert flag-off path makes no network calls (mock asserts zero `embed` invocations) and returns the same ordering the pre-semantic engine did; flag-on path reranks a known fuzzy case (candidate "payments platform" experience surfaces a "fintech" job that shares no exact skill tokens).

## Job import adapter (the "job listing updated" goal)

The pasted DTO is an external listing payload — mapping it into our tables is its own unit. New `packages/agent/src/core/job-import.ts` (or a `packages/job-import` module): `mapExternalJob(dto) → CreateDraftInput` implementing the mapping table above, including USD→VND salary conversion, industry→domain-slug mapping, skill-order→priority, and `external_raw = dto`. Upsert keyed on `(tenant_id, external_source, external_id)` (extend the existing `jobs.bulkInsert`/`createDraft` unique-key handling). This is where `isShowSalary`/`mandatory`/`priority` get honored, so it's covered by golden-DTO tests using your pasted job verbatim.

## View split — one engine, two outputs

| | Candidate view (Zalo chat, `jobs_matchCandidate` / `jobs_search`) | Headhunter view (new) |
|---|---|---|
| Sort key | `fit` only | `applyReferralBoost(fit, bonus)` |
| Salary | redacted (existing behavior, `load-jobs/handler.ts` pattern) | shown |
| Referral bonus | **never shown, never used** | shown, drives bounded boost |
| Mandatory-gap jobs | shown lower, with reason | shown lower, with reason |

Wiring: `match-candidate/handler.ts` and `load-jobs/handler.ts` gain an optional `view: 'candidate' | 'headhunter'` param (default `'candidate'` — safe default, bonus never leaks by omission). Headhunter view is exposed via a new tool/endpoint only reachable from an authenticated headhunter context (not the guest/Zalo chat surface) — exact transport (admin UI page vs. new agent tool) is a Step 4 decision, deferred to keep this plan focused; flag to the user before Step 4 if it needs its own auth/design pass.

**Must-have:** candidate-facing code path must be provably incapable of returning bonus/salary fields — same pattern as the existing salary redaction (strip before return, not "don't render"). **Validation:** unit test asserts `Object.keys(candidateResult)` never contains `referralBonusVnd`/`salary*`.

## Step-by-step plan

Each step lists the **most important work** first, is **independently unit-testable**, and steps marked *(parallel)* have no dependency on each other — hand to separate agents/sessions if desired.

### Step 0 — Migrations 18 + 19 + backfill *(parallel: 18 and 19 are independent files)*
- **Most important work:** the backfill guarantee (old data scores the same as before under new engine).
- Files: `packages/database/migrations/18_job_matching_v2.sql`, `19_semantic_matching.sql`.
- **Must-have:** zero data loss, zero downtime (additive columns + indexes only; `if not exists` throughout per repo convention). Migration 19 is skippable when semantic is off.
- **Validation:** apply to branch DB; `jobs.searchFts` + `candidateProfiles.search` existing tests green unmodified; backfill spot-check query above; hnsw indexes present but empty.

### Step 1 — Extraction prompts + import adapter *(parallel: 1a, 1b, 1c independent)*
- **1a. JD extraction** — most important work: correct `mandatory`/`priority` inference (a wrong mandatory flag silently gates out good candidates).
- **1b. CV extraction** — most important work: `level` derivation from work-history recency, not naive mention-counting (a skill listed once in a 2019 role shouldn't outrank one used in the current role); `domains` + `languages_detail`.
- **1c. Import adapter** — most important work: honoring `isShowSalary`, `mandatory`, and skill-order→`priority` from the real DTO; USD→VND + industry→domain mapping. File: `packages/agent/src/core/job-import.ts`.
- Files: `packages/agent/src/core/document-processor.ts` (both prompts + `zod` schemas), domain-taxonomy + industry→domain map constant in `packages/shared/src` (single source of truth imported by prompts, validator, and import adapter — no drift).
- **Validation:** golden-fixture tests per extractor (pasted DevOps JD for 1a; 2 synthetic CVs for 1b) + **golden-DTO test for 1c feeding your pasted job JSON verbatim** and asserting `Terraform/Ansible/Python/Bash` → `mandatory=true, priority≤4` (from `jobRequirement`/`jobSkillDTOs`), `Jenkins/Groovy` → `mandatory=false` (from `priority`), `referral_bonus_vnd=40000000`, `is_show_salary=false`, `languages_detail=[{English,Fluent}]`. Run: `pnpm --filter @platform/agent test`.

### Step 2 — Scoring engine *(parallel: each scoring function is independently testable; can be split across agents)*
- **Most important work:** `scoreSkillFit`'s mandatory-gate + priority-weight math — this is the core "does this candidate even qualify" logic and the highest-risk-of-bugs piece (off-by-one in level comparison silently mis-ranks everyone).
- Files: new `packages/agent/src/core/job-fit-scorer.ts` + `job-fit-scorer.test.ts`.
- **Must-have:** pure functions, no DB/network calls — see table-driven test list above.
- **Validation:** `pnpm --filter @platform/agent test` — 100% branch coverage on `computeJobFit`'s gate logic specifically (the one place a bug silently drops a good match).

### Step 3 — Repository wiring
- **Most important work:** `jobs.searchFts` / `jobs.listActive` / `candidateProfiles.search` and `.upsert` must select+persist `skills_detail`/`domains`/`referral_bonus_vnd` without changing their existing return shape for old callers (additive fields only).
- Files: `packages/database/src/repositories.ts` (`createJobPostingRepository`, `createCandidateProfileRepository`), row-type additions.
- **Validation:** existing repository integration tests unmodified and green; new assertions that new columns round-trip through `upsert`/`createDraft`.

### Step 4 — Skill/tool wiring + view split
- **Most important work:** the candidate/headhunter redaction boundary (see Must-have above) — the one place a leak would be a real product/trust problem (bonus visible to a jobseeker looks like a bribe). Also honor `is_show_salary=false` even in headhunter view.
- Files: `match-candidate/handler.ts`, `load-jobs/handler.ts`, `registry.ts`, `runner.ts` wiring (mirror existing `matchJobs`/`listJobs` injection pattern — no new DI mechanism).
- **Validation:** end-to-end `hr-chat.ts` scenario — candidate asks "việc nào hợp với tôi" → no salary/bonus figures, includes mandatory-skill-gap reasoning; separate headhunter-view test asserts bonus present and boost bounded (`fit=9, bonus=0` outranks `fit=6, bonus=huge`).

### Step 5 — Semantic rerank + RAG-domain (in this phase, flag-gated)
- **Most important work:** the flag boundary — `JOB_MATCHING_SEMANTIC=off` must produce byte-identical results to the structured+FTS engine (zero embedding calls). This is the safety net that lets semantic ship in-phase.
- Files: `packages/ai-client` (`embed()` method + provider config), `packages/agent/src/core/embed-compose.ts` (composed text builders), the `knowledge.embed` worker consumer (`services/worker`), a backfill script, and the rerank hook in the match handlers (Step 4).
- **Must-have:** graceful per-row degradation (NULL embedding ⇒ `semantic=undefined`, row still ranked); `auto` resolves off without a key; `on` without a key fails loud at startup.
- **Validation:** dual-run suite (flag on/off) — off makes zero `embed` network calls and reproduces pre-semantic ordering; on reranks a known fuzzy case (payments-platform CV surfaces a fintech job with no shared skill tokens). Backfill script populates `embedding` on all active rows; `select count(*) where embedding is not null` = row count.

## Non-goals (this phase)

- **No external BM25 engine** (Typesense/Meilisearch/ParadeDB `pg_search`). Postgres `ts_rank` stays the lexical recall layer. Reason: Neon can't host the `pg_search` extension and an external engine is a new always-on service + sync pipeline you declined. **Reversible** — say so if you want to add it and accept the infra; it slots in alongside `ftsRank` as another recall source.
- No headhunter auth/UI design — flagged as a Step 4 dependency to scope separately if needed.
- Vietnamese-language FTS — unchanged from the existing English-first decision (semantic rerank partly compensates: multilingual embedding models match across VI/EN).

## Risks

- `priorityWeight(p) = 1/p` is a reasonable starting curve but untuned against real outcomes — revisit once there's usage data. Likewise the `w1..w4` blend weights, especially `w4` (semantic) vs the lexical/structured signals.
- LLM-derived `mandatory`/`priority`/`level` inference is noisy; the soft-gate design (penalize, don't hard-exclude) means a wrong mandatory flag degrades ranking, not correctness.
- Domain taxonomy + industry→domain map are fixed v1 lists — additive (`text[]`, not enum), so growth is a code change, not a migration.
- **Semantic feature adds an external embeddings dependency + cost + a second provider key.** The flag is the mitigation (ship off, enable when keyed); the `embedding_model` column lets a model swap trigger re-embedding without schema change.
- Embeddings on `text-embedding-3-small` are English-tuned; if VI-heavy CVs underperform, swap `EMBEDDINGS_MODEL` to a multilingual model (e.g. Gemini `text-embedding-004`) — dims must stay 1536 or the `vector(1536)` columns + hnsw indexes need a migration.
