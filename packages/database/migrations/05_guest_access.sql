-- Migration: Guest Access table
create table if not exists public.guest_access (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  invite_code        text not null unique,
  status             text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  password_hash      text,
  display_name       text,
  profile            jsonb not null default '{}',
  contact_id         uuid references public.contacts(id) on delete set null,
  conversation_id    uuid references public.conversations(id) on delete set null,
  session_token_hash text,
  created_at         timestamptz not null default now(),
  claimed_at         timestamptz,
  last_seen_at       timestamptz
);

create index if not exists guest_access_tenant_idx on public.guest_access (tenant_id, created_at desc);
