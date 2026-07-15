alter table public.companies add column if not exists website text;
alter table public.companies add column if not exists leadership jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists products jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists materials jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists research jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists researched_at timestamptz;

create table if not exists public.company_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  kind text not null default 'other'
    check (kind in ('homepage','about','leadership','products','blog','careers','search_result','other')),
  title text,
  content_excerpt text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  constraint company_sources_company_url_key unique (company_id, url)
);

create index if not exists company_sources_tenant_company_idx
  on public.company_sources (tenant_id, company_id);
