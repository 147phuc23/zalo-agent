create table if not exists public.applications (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  job_posting_id        uuid not null references public.job_postings(id) on delete cascade,
  contact_id            uuid references public.contacts(id) on delete cascade,
  guest_access_id       uuid references public.guest_access(id) on delete cascade,
  candidate_profile_id  uuid references public.candidate_profiles(id) on delete set null,
  stage                 text not null default 'submitted'
                        check (stage in ('submitted', 'screening', 'interviewing', 'offer')),
  status                text not null default 'active'
                        check (status in ('active', 'hired', 'rejected', 'withdrawn')),
  applied_via           text not null default 'chat' check (applied_via in ('chat', 'admin')),
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint applications_owner_check
    check (contact_id is not null or guest_access_id is not null)
);

-- idempotent submits: one application per owner per job
create unique index if not exists applications_tenant_job_contact_key
  on public.applications (tenant_id, job_posting_id, contact_id) where contact_id is not null;
create unique index if not exists applications_tenant_job_guest_key
  on public.applications (tenant_id, job_posting_id, guest_access_id) where guest_access_id is not null;
create index if not exists applications_tenant_contact_idx
  on public.applications (tenant_id, contact_id, created_at desc);
create index if not exists applications_tenant_stage_idx
  on public.applications (tenant_id, status, stage, updated_at desc);

create table if not exists public.application_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  from_stage      text,
  to_stage        text not null,
  from_status     text,
  to_status       text not null,
  actor_type      text not null check (actor_type in ('agent', 'admin', 'candidate', 'system')),
  actor_id        text,          -- admin user id / 'hr-agent' / external user id
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists application_events_application_idx
  on public.application_events (application_id, created_at asc);
