-- ============================================================
-- SwimFest — Built-in staff credentials (Event Managers + Super Admin)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- EMs and Super Admins are INTERNAL staff — they are NOT created
-- through public signup. This script provisions their login
-- accounts directly and sets the correct role on their profile.
--
-- Each account has its own password (set in the VALUES list below).
-- Re-runnable: skips accounts that already exist.
-- ============================================================

-- pgcrypto provides crypt() + gen_salt() for password hashing
create extension if not exists pgcrypto;

do $$
declare
  staff record;
  uid uuid;
begin
  -- ── Define the built-in staff accounts here (email, name, role, password) ──
  for staff in
    select * from (values
      ('thangavishnuvardhanreddy@gmail.com', 'Event Manager', 'event_manager', 'vishnu@123'),
      ('superadmin@swimfest.in', 'SwimFest Super Admin', 'super_admin', 'SwimFest@2026')
    ) as t(email, full_name, role, password)
  loop
    -- Skip if the auth user already exists
    select id into uid from auth.users where email = staff.email;

    if uid is null then
      uid := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        uid, 'authenticated', 'authenticated', staff.email,
        crypt(staff.password, gen_salt('bf')),
        now(),  -- email pre-confirmed so they can log in immediately
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', staff.full_name, 'role', staff.role),
        now(), now()
      );

      -- Identity row (required by Supabase Auth for email logins)
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), uid, staff.email,
        jsonb_build_object('sub', uid::text, 'email', staff.email),
        'email', now(), now(), now()
      );
    end if;

    -- Ensure the profile row carries the correct staff role
    insert into public.profiles (id, full_name, role)
    values (uid, staff.full_name, staff.role::app_role_enum)
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;
  end loop;
end $$;

-- ── Verify ──
select u.email, p.role, p.full_name
from public.profiles p
join auth.users u on u.id = p.id
where p.role in ('event_manager','super_admin')
order by p.role;

-- ============================================================
-- Done. Log in at login.html with:
--   thangavishnuvardhanreddy@gmail.com / vishnu@123    (Event Manager)
--   superadmin@swimfest.in             / SwimFest@2026 (Super Admin)
-- Pick the matching role on the login form.
-- ============================================================
