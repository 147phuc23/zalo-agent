alter table public.candidate_profiles add column if not exists flagged_at timestamp with time zone;
alter table public.candidate_profiles add column if not exists risk_score integer default 0 not null;

create table if not exists public.candidate_profile_change_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  changed_fields jsonb not null, -- e.g. { "fullName": { "old": "A", "new": "B" } }
  changed_by varchar(100) not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  rule_name varchar(100) not null,
  details jsonb,
  severity varchar(20) not null check (severity in ('low', 'medium', 'high')),
  created_at timestamp with time zone default now() not null
);

create index if not exists candidate_profile_change_logs_profile_id_idx on public.candidate_profile_change_logs (candidate_profile_id);
create index if not exists risk_signals_profile_id_idx on public.risk_signals (candidate_profile_id);
