-- ============================================================
-- Let staff (Admin, Super Admin, Organizer) add walk-in swimmers
--
-- The live "own swimmers" policy only allows a parent to add a
-- swimmer they own (owner_id = auth.uid()). A walk-in swimmer
-- added at the pool has no owner, so the insert was refused with
-- "new row violates row-level security policy for table swimmers".
--
-- These policies are added alongside the existing ones, so parents
-- keep working exactly as before. Safe to run more than once.
-- ============================================================

-- Self-contained role check (reads profiles.role as text, so it
-- doesn't depend on any other helper existing in this database)
create or replace function public.is_meet_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role::text from public.profiles where id = auth.uid())
      in ('event_manager', 'organizer', 'super_admin'),
    false)
$$;

grant execute on function public.is_meet_staff() to authenticated;

-- Add a swimmer (the walk-in form)
drop policy if exists "staff insert swimmers" on swimmers;
create policy "staff insert swimmers" on swimmers
  for insert to authenticated
  with check (public.is_meet_staff());

-- Read swimmers (the form reads back the new swimmer's id,
-- and the player list shows names and dates of birth)
drop policy if exists "staff read swimmers" on swimmers;
create policy "staff read swimmers" on swimmers
  for select to authenticated
  using (public.is_meet_staff());

-- Remove a swimmer (the form undoes the swimmer if the entry fails)
drop policy if exists "staff delete swimmers" on swimmers;
create policy "staff delete swimmers" on swimmers
  for delete to authenticated
  using (public.is_meet_staff());
