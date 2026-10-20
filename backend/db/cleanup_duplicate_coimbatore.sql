-- ============================================================
-- SwimFest — remove duplicate "Coimbatore District Swimming
-- Championship 2026" meets (one-off cleanup, run once in the
-- Supabase SQL editor).
--
-- KEEPS   fc5316b0-5682-457b-8e47-a5752aff63c8
--         PUBLISHED · 12–13 Nov 2026 · owner: organizer "vishnu"
--         (the first published copy with the correct dates)
--
-- DELETES the other five copies:
--   a7a2ea4b…  REJECTED_DRAFT · 12–13 Nov 2026
--   8469c7cf…  PUBLISHED      · 03–05 Sep 2026 (dates already past)
--   aeb1c7cd…  REJECTED_DRAFT · titled just "Coimbatore"
--   1a7eac64…  PUBLISHED      · 12–13 Nov 2026 (duplicate)
--   7e8ca5d0…  PUBLISHED      · 12–13 Nov 2026 (duplicate)
--
-- Deleting a meet also deletes its entries, heats, bookings and
-- reopen requests (on delete cascade). So this script stops
-- WITHOUT deleting anything if any of the five has such rows.
-- ============================================================

begin;

do $$
declare
  doomed uuid[] := array[
    'a7a2ea4b-0d6c-4c24-890f-57acb70226b9',
    '8469c7cf-94c6-4d08-b8d4-3d694da56659',
    'aeb1c7cd-0220-45f5-84b6-26c08e912244',
    '1a7eac64-8ff0-4657-b3d7-1e71bbdd824f',
    '7e8ca5d0-4da7-4a32-8f2b-61e1511d954d'
  ]::uuid[];
  n_entries  int;
  n_heats    int;
  n_bookings int;
  n_reopen   int;
  n_deleted  int;
begin
  -- The meet being kept must exist, so we never delete every copy
  if not exists (select 1 from public.tournaments
                 where tournament_id = 'fc5316b0-5682-457b-8e47-a5752aff63c8') then
    raise exception 'The meet to keep (fc5316b0…) was not found. Nothing deleted.';
  end if;

  select count(*) into n_entries  from public.event_entries   where tournament_id = any(doomed);
  select count(*) into n_heats    from public.heat_rows       where tournament_id = any(doomed);
  select count(*) into n_bookings from public.bookings        where tournament_id = any(doomed);
  select count(*) into n_reopen   from public.reopen_requests where tournament_id = any(doomed);

  if n_entries + n_heats + n_bookings + n_reopen > 0 then
    raise exception 'Stopped, nothing deleted: the copies still have % entries, % heat rows, % bookings, % reopen requests.',
      n_entries, n_heats, n_bookings, n_reopen;
  end if;

  delete from public.tournaments where tournament_id = any(doomed);
  get diagnostics n_deleted = row_count;
  raise notice 'Deleted % duplicate meets.', n_deleted;
end $$;

commit;

-- Check: should list exactly one Coimbatore meet
select tournament_id, title, status, start_date, end_date
from public.tournaments
where title ilike '%coimbatore%';
