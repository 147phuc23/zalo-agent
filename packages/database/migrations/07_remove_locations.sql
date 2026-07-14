-- Migration: remove location column from job_postings (keeping location_slugs and locations table)

ALTER TABLE public.job_postings 
  DROP COLUMN IF EXISTS location;
