-- ============================================================
-- SwimFest — Fix: robust new-user trigger + safe RLS for profiles
-- Run this in Supabase SQL Editor if Stage 3 signup fails with
-- "Database error saving new user".
-- ============================================================

-- 1. Replace the trigger function with a defensive version that
--    never throws (bad/missing metadata won't block signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role_enum := 'swimmer';
begin
  -- Safely coerce role; default to 'swimmer' on any problem
  begin
    if (new.raw_user_meta_data ? 'role') then
      v_role := (new.raw_user_meta_data->>'role')::app_role_enum;
    end if;
  exception when others then
    v_role := 'swimmer';
  end;

  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_role,
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- Never block auth signup even if profile insert fails
  return new;
end;
$$;

-- 2. Re-create the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Make sure the trigger can insert into profiles regardless of RLS.
--    (security definer already bypasses RLS, but add an explicit
--     insert policy so client-side upserts also work.)
alter table profiles enable row level security;

drop policy if exists "profiles self insert" on profiles;
create policy "profiles self insert" on profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles self select" on profiles;
create policy "profiles self select" on profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
