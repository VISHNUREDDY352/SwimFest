-- ============================================================
-- SwimFest — Organizers table (separate from swimmers & academies)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Swimmer signups  -> swimmers table  (already exists)
-- Organizer signups -> organizers table  (this file)
--
-- Each organizer is tied to their auth account via owner_id.
-- ============================================================

create table if not exists organizers (
  organizer_id    uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id) on delete cascade,  -- the login account
  org_name        varchar(200) not null,        -- organization / club name
  contact_person  varchar(120) not null,        -- signup full name
  email_id        varchar(120),
  phone_number    varchar(15),
  city            varchar(100) default 'Tamil Nadu',
  state           varchar(100) default 'Tamil Nadu',
  registration_no varchar(100),
  document_url    text,                          -- optional proof document
  status          verification_status_enum not null default 'PENDING_VERIFICATION',
  created_at      timestamptz default now()
);

create unique index if not exists organizers_owner_uidx on organizers(owner_id);

-- ── RLS ─────────────────────────────────────────────────────
alter table organizers enable row level security;

-- An organizer manages their own row
drop policy if exists "own organizer" on organizers;
create policy "own organizer" on organizers for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Staff (event_manager / super_admin) can read + verify all organizers
drop policy if exists "staff read organizers" on organizers;
create policy "staff read organizers" on organizers
  for select to authenticated using (public.is_staff());

drop policy if exists "superadmin update organizers" on organizers;
create policy "superadmin update organizers" on organizers
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- Allow a new signup to insert their own organizer row
drop policy if exists "organizer self insert" on organizers;
create policy "organizer self insert" on organizers
  for insert to authenticated
  with check (owner_id = auth.uid());

-- ── Public directory view (no PII) for the Super Admin queue ──
-- Exposes only verification-relevant fields via owner privileges,
-- so the Super Admin verification queue can list organizers.
create or replace view public.organizer_directory
with (security_invoker = false) as
  select organizer_id, owner_id, org_name, contact_person, city, state,
         registration_no, document_url, status, created_at
  from public.organizers;

grant select on public.organizer_directory to anon, authenticated;

-- ============================================================
-- Safe self-upgrade to organizer
-- The "profiles no self escalate" policy (role_policies.sql) blocks
-- users from changing their own role — which also blocks a swimmer
-- from legitimately becoming an organizer. This SECURITY DEFINER
-- function allows ONLY the swimmer→organizer upgrade for the caller,
-- and never lets anyone grant themselves staff/admin roles.
-- ============================================================
create or replace function public.become_organizer()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Only upgrade from swimmer (or missing) to organizer; never touch
  -- event_manager / super_admin accounts.
  update public.profiles
     set role = 'organizer'
   where id = auth.uid()
     and role in ('swimmer');
end $$;

grant execute on function public.become_organizer() to authenticated;

-- ============================================================
-- Done. Organizer signups now persist to `organizers`, kept
-- separate from `swimmers` and `academies`.
-- NOTE: requires public.is_staff() / public.my_role() from
-- role_policies.sql (run that first if you haven't).
-- ============================================================
