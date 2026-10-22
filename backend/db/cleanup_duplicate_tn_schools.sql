-- ============================================================
-- SwimFest — remove the duplicate "Tamil Nadu District Schools
-- Championship 2026" meet (one-off cleanup, run once in the
-- Supabase SQL editor).
--
-- The two copies are identical apart from their id and creation
-- time (created 28 minutes apart on 2026-09-03).
--
-- KEEPS   51604955-27ec-489f-92e8-13d98202b9f6  (the first copy)
-- DELETES c7390ae0-2c53-4304-8d10-47205edf5ade  (the later copy)
--
-- Deleting a meet also deletes its entries, heats, bookings and
-- reopen requests (on delete cascade), so this stops WITHOUT
-- deleting anything if the copy has any of those.
-- ============================================================

begin;

do $$
declare
  doomed constant uuid := 'c7390ae0-2c53-4304-8d10-47205edf5ade';
  linked int;
begin
  if not exists (select 1 from public.tournaments
                 where tournament_id = '51604955-27ec-489f-92e8-13d98202b9f6') then
    raise exception 'The copy to keep (51604955…) was not found. Nothing deleted.';
  end if;

  select (select count(*) from public.event_entries   where tournament_id = doomed)
       + (select count(*) from public.heat_rows       where tournament_id = doomed)
       + (select count(*) from public.bookings        where tournament_id = doomed)
       + (select count(*) from public.reopen_requests where tournament_id = doomed)
    into linked;
  if linked > 0 then
    raise exception 'Stopped, nothing deleted: the copy has % linked entries, heats, bookings or reopen requests.', linked;
  end if;

  delete from public.tournaments where tournament_id = doomed;
  raise notice 'Deleted the duplicate meet.';
end $$;

commit;

-- Check: should list exactly one
select tournament_id, title, status, start_date
from public.tournaments
where title = 'Tamil Nadu District Schools Championship 2026';
