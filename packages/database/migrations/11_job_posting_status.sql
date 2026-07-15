-- Migration: Add status and source_document_id to job_postings, drop is_active

alter table public.job_postings
  add column if not exists status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  add column if not exists source_document_id uuid references public.documents(id) on delete set null;

update public.job_postings set status = 'archived' where is_active = false;

drop index if exists job_postings_tenant_idx;
create index if not exists job_postings_tenant_status_idx
  on public.job_postings (tenant_id, status, created_at desc);

alter table public.job_postings drop column if exists is_active;
