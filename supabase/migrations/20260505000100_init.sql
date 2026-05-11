create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists public.tenants (
  id uuid primary key,
  name text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  locale text not null default 'vi-VN',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('admin','agent','viewer')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.channel_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  external_account_id text,
  status text not null default 'active',
  encrypted_session_blob text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  external_user_id text not null,
  display_name text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, channel, external_user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  external_thread_id text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'open',
  assignee_user_id uuid references public.users(id) on delete set null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, channel, external_thread_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null,
  text text,
  external_message_id text,
  idempotency_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);

create index if not exists conversations_tenant_last_activity_idx
  on public.conversations (tenant_id, last_activity_at desc);

create table if not exists public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  attempt int not null default 1,
  status text not null,
  error_code text,
  error_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mode text not null check (mode in ('auto','approval','manual','blocked')),
  default_model text,
  classifier_model text,
  embedding_model text,
  max_tool_turns int not null default 6,
  temperature numeric not null default 0.2,
  prompt_settings jsonb not null default '{}'::jsonb,
  crm_mapping jsonb not null default '{}'::jsonb,
  blocked_topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tool_call_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  run_id text,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);

create table if not exists public.human_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  type text not null check (type in ('approval','handoff')),
  status text not null default 'open',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_type text not null,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.external_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system text not null,
  local_id uuid,
  remote_id text not null,
  remote_type text not null,
  unique_key_hash text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, system, unique_key_hash)
);
