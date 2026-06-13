# Zalo Frontend Isolation Simulator Implementation Plan (Postgres Migration)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a premium Next.js frontend chat simulator that bypasses the Zalo network for testing, supports AI model switching, logs tool calls in an inspector, tracks message read/unread status, and offers active prompt template management with versioning. Migrate the database completely away from Supabase to a standard PostgreSQL container and `pg` (node-postgres) client.

**Architecture:** 
1. Spin up a separate, lightweight PostgreSQL container `platform-db` on port `7432` in `docker-compose.yml`.
2. Replace `@supabase/supabase-js` with `pg` (node-postgres) in `packages/database`.
3. Rewrite `packages/database/src/repositories.ts` to use standard SQL statements instead of Supabase client methods.
4. Replace direct Supabase `.from()` queries in the API and Worker services with Repository method calls to preserve clean abstraction boundaries.
5. Create a migration runner script to execute migrations in sequence on database start.

**Tech Stack:** NestJS, Next.js (App Router, Tailwind CSS, lucide-react), PostgreSQL (`pg` pool client), Redis (BullMQ), Vitest.

---

### Task 1: Docker Compose & Environment Config (Remove Supabase)

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.local`
- Modify: `.env.local.example`

**Step 1: Update `docker-compose.yml`**
Add the `platform-db` PostgreSQL service on port `7432`:
```yaml
  platform-db:
    image: pgvector/pgvector:pg16
    ports:
      - "7432:5432"
    environment:
      POSTGRES_DB: platform
      POSTGRES_PASSWORD: platform_secure_pass
      POSTGRES_USER: platform_user
    volumes:
      - platform-db-data:/var/lib/postgresql/data
    restart: always
```
Ensure `platform-db-data` is added to `volumes`.

**Step 2: Update `.env.local`**
Replace Supabase env keys:
```env
# Remove
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Add
PLATFORM_DB_URL=postgres://platform_user:platform_secure_pass@localhost:7432/platform
```

**Step 3: Commit**
```bash
git add docker-compose.yml .env.local
git commit -m "infra: add platform-db container to docker-compose and update environment vars"
```

---

### Task 2: Database Migration Script & Schemas

**Files:**
- Create: `packages/database/migrations/01_init.sql`
- Create: `packages/database/migrations/02_frontend_isolation.sql`
- Create: `packages/database/src/migrator.ts`

**Step 1: Write SQL Migrations**
Recreate the database tables inside standard Postgres:
- Copy the original schema from `supabase/migrations/20260505000100_init.sql` to `packages/database/migrations/01_init.sql` (replacing uuid and vector extensions if needed, or keeping `create extension if not exists "uuid-ossp"; create extension if not exists "vector";`).
- Add prompt template versioning, message read indicators, and model overrides to `packages/database/migrations/02_frontend_isolation.sql`:
```sql
create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  content text not null,
  version int not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(tenant_id, key, version)
);

create index if not exists prompt_templates_key_idx on public.prompt_templates (tenant_id, key);

alter table public.conversations 
  add column if not exists override_model text;

alter table public.messages 
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz;
```

**Step 2: Create Migration Runner**
Write a migration runner in `packages/database/src/migrator.ts` that reads all `.sql` files in sequence and executes them using `pg` connection client on application boot.

**Step 3: Commit**
```bash
git add packages/database/migrations/ packages/database/src/migrator.ts
git commit -m "db: add sql migrations and migration runner script for postgres"
```

---

### Task 3: Replace Supabase Client with `pg`

**Files:**
- Modify: `packages/database/package.json`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/database/src/repositories.ts`

**Step 1: Update dependencies**
Uninstall `@supabase/supabase-js`, install `pg` and `@types/pg`.

**Step 2: Rewrite database client initializer**
In `packages/database/src/index.ts`:
```typescript
import pg from "pg";

export type DatabaseClient = pg.Pool;

export function createDatabaseClient(input: { PLATFORM_DB_URL: string }) {
  return new pg.Pool({
    connectionString: input.PLATFORM_DB_URL,
  });
}
```

**Step 3: Rewrite Repositories using SQL Queries**
Update all repository methods inside `packages/database/src/repositories.ts` to use SQL parameter bindings:
```typescript
// Example: createPromptTemplateRepository using SQL
export function createPromptTemplateRepository(client: DatabaseClient) {
  return {
    async findActive(input: { tenantId: string; key: string }) {
      const query = `
        SELECT id, tenant_id, key, content, version, is_active, created_at 
        FROM prompt_templates 
        WHERE tenant_id = $1 AND key = $2 AND is_active = true 
        LIMIT 1
      `;
      const res = await client.query(query, [input.tenantId, input.key]);
      return res.rows[0] || null;
    },
    async create(input: { tenantId: string; key: string; content: string; version: number }) {
      await client.query(
        "UPDATE prompt_templates SET is_active = false WHERE tenant_id = $1 AND key = $2",
        [input.tenantId, input.key]
      );
      const query = `
        INSERT INTO prompt_templates (tenant_id, key, content, version, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, tenant_id, key, content, version, is_active, created_at
      `;
      const res = await client.query(query, [input.tenantId, input.key, input.content, input.version]);
      return res.rows[0];
    }
  };
}
```

**Step 4: Commit**
```bash
git add packages/database/package.json packages/database/src/index.ts packages/database/src/repositories.ts
git commit -m "feat: migrate repositories to pg client using standard SQL queries"
```

---

### Task 4: API and Worker Service Adaptations

**Files:**
- Modify: `services/api/src/services/supabase.service.ts` (rename to `postgres.service.ts`)
- Modify: `services/api/src/services/ingest.service.ts`
- Modify: `services/api/src/services/inbox-query.service.ts`
- Modify: `services/worker/src/main.ts`

**Step 1: Rename/Refactor database service in API Gateway**
Rename `SupabaseService` to `PostgresService` and use `@platform/database` standard pg pool client.

**Step 2: Clean up direct Supabase calls**
Convert any direct `db.from()` queries inside `ingest.service.ts` and `inbox-query.service.ts` into Repository wrapper operations, ensuring NestJS and worker scripts don't make direct database query calls.

**Step 3: Update Worker Dynamic Prompt Compiler & Override Model**
Update the AI execution flow to read prompts from the new PostgreSQL table, parse variables, and accept chatbox overrides.

**Step 4: Commit**
```bash
git add services/api/src/ services/worker/src/main.ts
git commit -m "feat: update api and worker services to consume postgres db client"
```

---

### Task 5: Admin UI Redesign (Split-Screen Simulator, Debugger, Prompt Editor)

**Files:**
- Modify: `apps/admin/src/app/conversation/[conversationId]/page.tsx`
- Modify: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/api/prompts/route.ts`

**Step 1: Update UI Proxy Endpoints**
Configure UI route handlers to fetch from the updated API gateway, supporting active prompt management, unread badges, and model selection.

**Step 2: Build the split-pane Zalo Simulator**
- Left Pane: Active thread selection list with unread markers and simulator config buttons.
- Center Pane: Bubble layout for chat simulator, model picker dropdown, and read markers.
- Right Pane: Inspector panel displaying tool-call audits (inputs/outputs) and generation costs. Includes full session export.

**Step 3: Commit**
```bash
git add apps/admin/
git commit -m "feat: complete split-pane simulation UI and prompt configuration modal"
```

---

## Verification Plan

### Automated Tests
- Run database repository test suites using pg client: `pnpm test`

### Manual Verification
1. Start services: `pnpm dev:up` (verify that `platform-db` is running on port `7432` and migrations apply).
2. Open the Admin panel at `http://localhost:4000`.
3. Select "New Chat", choose candidate scenario, type a greeting, and verify database write and tool-call audits appear in the debugger.
4. Edit the active prompt, save a new version, and verify the model response guidelines update instantly.
