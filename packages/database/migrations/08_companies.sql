-- Migration: create companies table and update job_postings to reference companies

-- 1. Create public.companies table
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  introduction text not null default '',
  benefits text not null default '',
  work_style text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_tenant_name_key unique (tenant_id, name)
);

-- Create index for quick lookup by name/tenant
create index if not exists companies_tenant_name_idx on public.companies (tenant_id, name);

-- 2. Populate public.companies table using distinct companies from existing job_postings
insert into public.companies (tenant_id, name, introduction, benefits, work_style)
select distinct 
  tenant_id, 
  company, 
  'Introduction to ' || company, 
  'Benefits at ' || company, 
  'Work style at ' || company
from public.job_postings
on conflict (tenant_id, name) do nothing;

-- 3. Add company_id column to job_postings
alter table public.job_postings add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- 4. Map the company names in job_postings to company_ids
update public.job_postings jp
set company_id = c.id
from public.companies c
where jp.company = c.name and jp.tenant_id = c.tenant_id;

-- 5. Alter company_id to be NOT NULL
alter table public.job_postings alter column company_id set not null;

-- 6. Drop the old company text column
alter table public.job_postings drop column if exists company;
