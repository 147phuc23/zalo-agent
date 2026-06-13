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
