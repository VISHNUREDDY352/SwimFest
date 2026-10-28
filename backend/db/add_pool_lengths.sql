-- ============================================================
-- A meet can use more than one pool (e.g. a 50 m competition pool
-- and a 25 m warm-up / junior pool at the same complex)
--
-- pool_lengths holds every pool length ticked on Create meet,
-- e.g. {50m,25m}. pool_length stays as the main competition pool,
-- so everything that already reads it keeps working.
-- Safe to run more than once.
-- ============================================================

alter table public.tournaments add column if not exists pool_lengths text[];

-- Existing meets: their one pool
update public.tournaments
   set pool_lengths = array[pool_length::text]
 where pool_lengths is null and pool_length is not null;

-- Only real pool lengths, and at least one
alter table public.tournaments drop constraint if exists tournaments_pool_lengths_valid;
alter table public.tournaments add constraint tournaments_pool_lengths_valid
  check (pool_lengths is null or (cardinality(pool_lengths) between 1 and 2 and pool_lengths <@ array['50m', '25m']::text[]));
