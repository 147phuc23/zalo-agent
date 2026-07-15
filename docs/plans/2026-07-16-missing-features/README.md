# Missing Features — Detailed Specs

Master plan (context, decisions, migration order, parallel-subagent tracks): [../2026-07-16-missing-features-master-plan.md](../2026-07-16-missing-features-master-plan.md)

Per-feature specs, each with full DB DDL, repository signatures, diagrams, file-by-file change lists, numbered steps with verification, and risks:

| Spec | Feature | Migrations | Depends on |
|---|---|---|---|
| [00-foundation](00-foundation.md) | documents table, `packages/storage` (local-fs dev / R2 deployed), `document.process` queue | 09 | — |
| [01-cv-to-profile](01-cv-to-profile.md) | CV upload → parsed text → structured `candidate_profiles` + FTS; rewire `crm_*` skills to DB | 10 | 00 |
| [02-jd-to-job-drafts](02-jd-to-job-drafts.md) | JD upload → LLM breakdown → draft `job_postings` → admin review/activate | 11 | 00, 01 (parse step) |
| [06-application-tracking](06-application-tracking.md) | `applications` + `application_events`, submit/status agent skills, admin pipeline UI | 12 | 10, 11 |
| [03-company-research](03-company-research.md) | research CLI (`packages/company-research`) + `knowledge_gaps` capture skill | 13, 14 | — |
| [04-job-matching](04-job-matching.md) | hybrid FTS (`english` config) + structured scoring, `jobs_matchCandidate`, proactive suggestions | 15 | 11; proactive part: 01 |
| [05-fraud-detection](05-fraud-detection.md) | risk scoring in worker, `profile_change_log`, review tasks, chat disable | 16 | 01 (change-log hooks) |

Recommended build order: 00 → 01 → 02 → 06 → 04 → 03 → 05 (see master plan phases; parallelization map is in the master plan's "Parallel execution with subagents" section).
