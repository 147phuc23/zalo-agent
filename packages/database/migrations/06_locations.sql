-- Migration: canonical locations lookup + job_postings location as a slug list.
create table if not exists public.locations (
  slug            text primary key,
  english_name    text not null,
  vietnamese_name text not null,
  aliases         text[] not null default '{}'
);

insert into public.locations (slug, english_name, vietnamese_name, aliases) values
  ('ho-chi-minh-city', 'Ho Chi Minh City', 'Hồ Chí Minh', '{"hcm","hcmc","ho chi minh","hồ chí minh","saigon","sai gon","tp hcm","tphcm"}'),
  ('ha-noi', 'Ha Noi', 'Hà Nội', '{"hanoi","ha noi","hà nội","hn"}'),
  ('da-nang', 'Da Nang', 'Đà Nẵng', '{"danang","da nang","đà nẵng","dn"}'),
  ('remote', 'Remote', 'Từ xa', '{"remote","wfh","work from home"}')
on conflict (slug) do nothing;

alter table public.job_postings add column if not exists location_slugs text[] not null default '{}';
alter table public.job_postings alter column location drop not null;
