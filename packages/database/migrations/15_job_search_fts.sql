create extension if not exists vector;

alter table public.job_postings add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(public.f_array_to_string(required_skills, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(seniority, '') || ' ' || coalesce(job_type, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) stored;

create index if not exists job_postings_search_tsv_idx
  on public.job_postings using gin (search_tsv);

-- pgvector-ready (locked decision): nullable, NO index until an embeddings key is chosen.
alter table public.job_postings add column if not exists embedding vector(1536);
