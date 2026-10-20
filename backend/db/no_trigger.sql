-- ============================================================
-- OPTION: Remove the trigger entirely.
-- The frontend (auth.js) already upserts the profile after signup,
-- so we don't strictly need the DB trigger. Removing it eliminates
-- "Database error saving new user" caused by trigger failures.
-- Run this in Supabase SQL Editor.
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Make sure profiles has permissive insert for the signed-in user
alter table public.profiles enable row level security;

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
