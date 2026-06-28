-- Job postings for the recruiting agent's load-jobs / jobs_search skill.
-- Tenant-scoped; the agent queries these instead of the in-code mock list.
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text,
  title text not null,
  company text not null,
  location text not null,
  work_mode text not null check (work_mode in ('remote', 'hybrid', 'onsite')),
  salary_min_vnd bigint not null default 0,
  salary_max_vnd bigint not null default 0,
  seniority text not null default '',
  required_skills text[] not null default '{}',
  description text not null default '',
  job_type text,
  experience_required_years int,
  benefits text,
  education_required text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists job_postings_tenant_idx on public.job_postings (tenant_id) where is_active;
create unique index if not exists job_postings_tenant_external_idx
  on public.job_postings (tenant_id, external_id) where external_id is not null;
