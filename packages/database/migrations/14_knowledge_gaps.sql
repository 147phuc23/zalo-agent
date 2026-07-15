create table if not exists public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  question text not null,
  topic text not null default 'other'
    check (topic in ('company','job','process','benefits','other')),
  status text not null default 'open'
    check (status in ('open','researching','answered','dismissed')),
  answer text,
  ask_count int not null default 1,
  last_asked_at timestamptz not null default now(),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_gaps_tenant_status_idx
  on public.knowledge_gaps (tenant_id, status, last_asked_at desc);
create index if not exists knowledge_gaps_company_idx
  on public.knowledge_gaps (company_id) where company_id is not null;
