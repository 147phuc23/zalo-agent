-- Migration: Create documents table and array_to_string helper function

-- Immutable wrapper: array_to_string is STABLE, unusable in generated columns.
-- Defined here because migrations 10 and 15 both need it.
create or replace function public.f_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe
as $$ select array_to_string(arr, sep) $$;

-- Uploaded source documents (CVs, JDs); bytes live in storage, extracted text cached here.
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  kind           text not null check (kind in ('cv', 'jd')),
  storage_key    text not null,                 -- e.g. {tenant_id}/cv/{uuid}/{filename}
  file_name      text not null,
  mime_type      text not null default 'application/octet-stream',
  size_bytes     bigint,
  status         text not null default 'uploaded'
                 check (status in ('uploaded', 'processing', 'processed', 'failed')),
  parse_method   text,                          -- 'unpdf' | 'mammoth' | 'llm-vision' | 'plain-text'
  raw_text       text,
  error          text,
  -- provenance (nullable: JD has company_id; chat CV has contact/conversation; guest CV has guest_access_id)
  contact_id       uuid references public.contacts(id) on delete set null,
  guest_access_id  uuid references public.guest_access(id) on delete set null,
  conversation_id  uuid references public.conversations(id) on delete set null,
  company_id       uuid references public.companies(id) on delete set null,
  uploaded_by      text not null default 'admin' check (uploaded_by in ('admin', 'guest', 'zalo')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists documents_tenant_kind_idx
  on public.documents (tenant_id, kind, created_at desc);
create index if not exists documents_raw_text_fts_idx
  on public.documents using gin (to_tsvector('english', coalesce(raw_text, '')));
