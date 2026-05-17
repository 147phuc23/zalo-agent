# Worker Placeholder

This service will run asynchronous workflow, agent orchestration, and CRM sync jobs.

## Twenty-backed HR agent skills

1. Run Twenty (`pnpm twenty:up` from repo root) and create an API key with **Settings → Data model** permission for schema scripts.
2. Add `TWENTY_BASE_URL` and `TWENTY_API_KEY` to `.env.local`.
3. Apply recruiting metadata and optional demo records:

```bash
pnpm --filter @platform/worker twenty:schema
pnpm --filter @platform/worker twenty:seed
```

4. Run the HR CLI against Twenty tools:

```bash
HR_SKILL_MODE=twenty pnpm --filter @platform/worker agent:hr:chat
# or
pnpm --filter @platform/worker agent:hr:chat --skill-mode twenty
```
