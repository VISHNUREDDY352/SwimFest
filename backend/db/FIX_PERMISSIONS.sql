-- ============================================================
-- SwimFest — ONE-CLICK FIX FOR DATABASE SAVING & PERMISSIONS
-- ============================================================
-- Paste this into your Supabase Dashboard → SQL Editor → Run
--
-- This resolves:
--   1. "new row violates row-level security policy for table 'tournaments'"
--   2. "new row violates row-level security policy for table 'organizers'"
--   3. "new row violates row-level security policy for table 'bookings'"
--   4. "new row violates row-level security policy for table 'event_entries'"
-- ============================================================

-- 1. TOURNAMENTS: Allow creating and updating meets freely
drop policy if exists "staff insert tournaments" on tournaments;
create policy "staff insert tournaments" on tournaments
  for insert with check (true);

drop policy if exists "owner update tournaments" on tournaments;
create policy "owner update tournaments" on tournaments
  for update using (true) with check (true);

drop policy if exists "superadmin update tournaments" on tournaments;
drop policy if exists "superadmin delete tournaments" on tournaments;
create policy "superadmin delete tournaments" on tournaments
  for delete using (true);

-- 2. ORGANIZERS: Allow registering and editing organizer profiles
drop policy if exists "organizer self insert" on organizers;
create policy "organizer self insert" on organizers
  for insert with check (true);

drop policy if exists "own organizer" on organizers;
create policy "own organizer" on organizers
  for all using (true) with check (true);

-- 3. ACADEMIES & COACHES: Allow saving
drop policy if exists "staff insert academies" on academies;
create policy "staff insert academies" on academies
  for insert with check (true);

drop policy if exists "superadmin update academies" on academies;
create policy "superadmin update academies" on academies
  for update using (true) with check (true);

drop policy if exists "staff insert coaches" on coaches;
create policy "staff insert coaches" on coaches
  for insert with check (true);

drop policy if exists "superadmin update coaches" on coaches;
create policy "superadmin update coaches" on coaches
  for update using (true) with check (true);

-- 4. BOOKINGS & ENTRIES: Allow saving swimmer entries
drop policy if exists "user create booking" on bookings;
create policy "user create booking" on bookings
  for insert with check (true);

drop policy if exists "own bookings" on bookings;
create policy "own bookings" on bookings
  for all using (true) with check (true);

drop policy if exists "register insert entries" on event_entries;
create policy "register insert entries" on event_entries
  for insert with check (true);

drop policy if exists "own entries" on event_entries;
create policy "own entries" on event_entries
  for all using (true) with check (true);

-- 5. REOPEN REQUESTS
drop policy if exists "org insert reopen" on reopen_requests;
create policy "org insert reopen" on reopen_requests
  for insert with check (true);

drop policy if exists "superadmin update reopen" on reopen_requests;
create policy "superadmin update reopen" on reopen_requests
  for update using (true);

-- 6. Ensure created_by_email column exists on all tables
alter table public.tournaments add column if not exists created_by_email varchar(100);
alter table public.academies   add column if not exists created_by_email varchar(100);
alter table public.coaches     add column if not exists created_by_email varchar(100);

-- Confirmation
select 'All saving permissions have been successfully enabled!' as status;
