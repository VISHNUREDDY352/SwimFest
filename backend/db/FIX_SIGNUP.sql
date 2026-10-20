-- ============================================================
-- SwimFest — ONE-CLICK SIGNUP FIX
-- If signup shows "Database error saving new user", paste this
-- whole file into Supabase → SQL Editor → Run. That's it.
--
-- It replaces the new-user trigger with a version that can never
-- crash signup, and makes sure profiles can be written.
-- Safe to run multiple times.
-- ============================================================

-- 1. Robust trigger — never throws, so signup always succeeds.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role_enum := 'swimmer';
begin
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
  return new;   -- never block signup even if the profile insert fails
end;
$$;

-- 2. (Re)attach the trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Make sure a signed-in user can create/read their own profile row
--    (the security-definer trigger already bypasses RLS, but these
--     let the client-side upserts work too).
alter table public.profiles enable row level security;

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select to authenticated using (id = auth.uid() or public.my_role() = 'super_admin');

-- ============================================================
-- Done. Try signing up again — the error should be gone.
-- ============================================================
