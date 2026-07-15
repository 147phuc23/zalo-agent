-- Migration: Create candidate_profiles table with FTS and vector support

create table if not exists public.candidate_profiles (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  contact_id             uuid references public.contacts(id) on delete cascade,
  guest_access_id        uuid references public.guest_access(id) on delete cascade,
  source_document_id     uuid references public.documents(id) on delete set null,
  full_name              text,
  email                  text,
  phone                  text,
  location               text,
  current_title          text,
  years_of_experience    numeric(4,1),
  skills                 text[] not null default '{}',
  preferred_roles        text[] not null default '{}',
  salary_expectation_vnd bigint,
  availability           text,
  work_history           jsonb not null default '[]',  -- [{company,title,from,to,description}]
  education              jsonb not null default '[]',  -- [{school,degree,field,from,to}]
  languages              text[] not null default '{}',
  summary                text not null default '',
  raw_extraction         jsonb not null default '{}',  -- full LLM output for audit/reprocess; notes[] lives here
  -- English-first FTS (user decision): stemmed 'english' config, generated directly over fields
  search tsvector generated always as (
    to_tsvector('english',
      coalesce(full_name, '') || ' ' ||
      coalesce(current_title, '') || ' ' ||
      coalesce(public.f_array_to_string(skills, ' '), '') || ' ' ||
      coalesce(public.f_array_to_string(preferred_roles, ' '), '') || ' ' ||
      coalesce(location, '') || ' ' || summary
    )
  ) stored,
  embedding              vector(1536),                 -- pgvector-ready; no index until embeddings key chosen
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint candidate_profiles_owner_check
    check (contact_id is not null or guest_access_id is not null)
);

create unique index if not exists candidate_profiles_tenant_contact_key
  on public.candidate_profiles (tenant_id, contact_id) where contact_id is not null;
create unique index if not exists candidate_profiles_tenant_guest_key
  on public.candidate_profiles (tenant_id, guest_access_id) where guest_access_id is not null;
create index if not exists candidate_profiles_search_idx
  on public.candidate_profiles using gin (search);
create index if not exists candidate_profiles_skills_idx
  on public.candidate_profiles using gin (skills);
