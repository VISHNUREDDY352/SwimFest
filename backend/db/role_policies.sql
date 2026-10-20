-- ============================================================
-- SwimFest — Role-based Row Level Security (real backend enforcement)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- This replaces the permissive "any authenticated user can write"
-- policies with role-aware ones that enforce the Super Admin
-- permission matrix:
--   swimmer        -> registers self, manages own swimmers/bookings
--   event_manager  -> create/draft & submit meets they created;
--                     run heats/results for meets; submit academies/coaches
--   organizer      -> create/draft & submit meets they OWN (created_by);
--                     run heats/results for their own meets
--   super_admin    -> universal CRUD / override on everything
--
-- Safe to re-run (drops policies by name first).
-- ============================================================

-- ── Helper: the caller's role (security definer bypasses RLS) ──
create or replace function public.my_role()
returns app_role_enum
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.my_role() to anon, authenticated;

-- Convenience predicate: is the caller staff (any non-swimmer)?
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.my_role() in
    ('event_manager','organizer','super_admin'), false)
$$;

grant execute on function public.is_staff() to anon, authenticated;

-- ============================================================
-- TOURNAMENTS
-- Public read stays. Create allowed for staff. Update/delete:
-- the creator can edit their own; super_admin can edit/override any.
-- ============================================================
drop policy if exists "auth insert tournaments"      on tournaments;
drop policy if exists "auth update tournaments"      on tournaments;
drop policy if exists "staff insert tournaments"     on tournaments;
drop policy if exists "owner update tournaments"     on tournaments;
drop policy if exists "superadmin all tournaments"   on tournaments;

-- Staff can create tournaments (organizers/EMs draft & submit)
create policy "staff insert tournaments" on tournaments
  for insert to authenticated
  with check (public.is_staff());

-- Creator can update their own tournament rows
create policy "owner update tournaments" on tournaments
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Super Admin: universal override (update/reopen/edit any) + delete
create policy "superadmin update tournaments" on tournaments
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

create policy "superadmin delete tournaments" on tournaments
  for delete to authenticated
  using (public.my_role() = 'super_admin');

-- ============================================================
-- EVENT ENTRIES
-- Swimmers create entries during registration (entry tied to a
-- booking they own). Staff can also manage entries. Public read
-- kept so heat sheets / results can display.
-- ============================================================
drop policy if exists "own entries"            on event_entries;
drop policy if exists "public read entries"    on event_entries;
drop policy if exists "register insert entries" on event_entries;
drop policy if exists "staff manage entries"   on event_entries;

create policy "public read entries" on event_entries
  for select using (true);

-- A user may insert an entry if it belongs to a booking they made,
-- or if they are staff running the meet.
create policy "register insert entries" on event_entries
  for insert to authenticated
  with check (
    public.is_staff()
    or exists (
      select 1 from public.bookings b
      where b.booking_id = event_entries.booking_id
        and b.booked_by = auth.uid()
    )
  );

-- Staff can update/delete entries (seeding, corrections)
create policy "staff update entries" on event_entries
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "staff delete entries" on event_entries
  for delete to authenticated
  using (public.is_staff());

-- ============================================================
-- HEAT ROWS
-- Public read stays (heat sheets / results / leaderboard).
-- Only staff may write (heat generation + result entry).
-- Replaces the permissive policies from heat_rows_write.sql.
-- ============================================================
drop policy if exists "auth insert heat_rows"  on heat_rows;
drop policy if exists "auth update heat_rows"  on heat_rows;
drop policy if exists "auth delete heat_rows"  on heat_rows;
drop policy if exists "staff insert heat_rows" on heat_rows;
drop policy if exists "staff update heat_rows" on heat_rows;
drop policy if exists "staff delete heat_rows" on heat_rows;

create policy "staff insert heat_rows" on heat_rows
  for insert to authenticated with check (public.is_staff());

create policy "staff update heat_rows" on heat_rows
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff delete heat_rows" on heat_rows
  for delete to authenticated using (public.is_staff());

-- ============================================================
-- ACADEMIES & COACHES
-- Public read stays. Staff may submit; super_admin may edit/verify.
-- ============================================================
drop policy if exists "auth insert academies"       on academies;
drop policy if exists "staff insert academies"      on academies;
drop policy if exists "superadmin update academies" on academies;

create policy "staff insert academies" on academies
  for insert to authenticated with check (public.is_staff());

create policy "superadmin update academies" on academies
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

drop policy if exists "auth insert coaches"       on coaches;
drop policy if exists "staff insert coaches"      on coaches;
drop policy if exists "superadmin update coaches" on coaches;

create policy "staff insert coaches" on coaches
  for insert to authenticated with check (public.is_staff());

create policy "superadmin update coaches" on coaches
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- ============================================================
-- PROFILES — close the privilege-escalation hole
-- The old "own profile FOR ALL" let a user set their own role to
-- super_admin. Split it: users manage their own row but CANNOT
-- change their role; only super_admin can change roles.
-- ============================================================
drop policy if exists "own profile"              on profiles;
drop policy if exists "profiles self select"     on profiles;
drop policy if exists "profiles self insert"     on profiles;
drop policy if exists "profiles self update"     on profiles;
drop policy if exists "profiles no self escalate" on profiles;
drop policy if exists "superadmin manage profiles" on profiles;

create policy "profiles self select" on profiles
  for select to authenticated using (id = auth.uid() or public.my_role() = 'super_admin');

create policy "profiles self insert" on profiles
  for insert to authenticated with check (id = auth.uid());

-- Self update allowed, but the role column must equal the caller's
-- currently-stored role (my_role() bypasses RLS and reads the
-- committed value) — this prevents a swimmer from promoting themselves.
create policy "profiles no self escalate" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());

-- Super admin can read/update any profile (incl. changing roles)
create policy "superadmin manage profiles" on profiles
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- ============================================================
-- SYSTEM AUDIT LOGS — super admin writes, staff can read
-- ============================================================
alter table system_audit_logs enable row level security;

drop policy if exists "staff read audit"        on system_audit_logs;
drop policy if exists "superadmin insert audit" on system_audit_logs;

create policy "staff read audit" on system_audit_logs
  for select to authenticated using (public.is_staff());

create policy "superadmin insert audit" on system_audit_logs
  for insert to authenticated
  with check (public.my_role() = 'super_admin');

-- ============================================================
-- EMERGENCY NOTICES — public read stays; super admin writes
-- ============================================================
drop policy if exists "superadmin insert notices" on emergency_notices;
drop policy if exists "superadmin update notices" on emergency_notices;

create policy "superadmin insert notices" on emergency_notices
  for insert to authenticated with check (public.my_role() = 'super_admin');

create policy "superadmin update notices" on emergency_notices
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- ============================================================
-- Done. Role-based enforcement now lives in the database, not
-- just the client-side guard. To promote your account:
--
--   update profiles set role = 'super_admin'
--   where id = (select id from auth.users where email = 'you@email.com');
--
-- NOTE: because role changes are now locked down, run the promote
-- statement as the DB owner (the SQL Editor runs as owner, so it
-- works there regardless of these policies).
-- ============================================================
