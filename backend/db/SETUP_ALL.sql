-- ============================================================
-- SwimFest — MASTER SETUP (run this ONE file in Supabase)
-- Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- This runs everything in the correct dependency order:
--   1. schema        (tables, enums, base RLS, signup trigger)
--   2. seed          (demo academies / coaches / tournaments)
--   3. role_policies (real role-based RLS + my_role()/is_staff())
--   4. public_swimmers    (swimmer_directory view)
--   5. public_leaderboard (academy_leaderboard view)
--   6. organizers    (organizers table + become_organizer())
--   7. verification_docs  (document_url columns + storage bucket)
--   8. reopen_requests    (organizer reopen flow + approve/deny RPCs)
--
-- NOTE: This file DELEGATES to the individual files' contents. In the
-- Supabase SQL Editor you cannot \i include other files, so this file
-- documents the ORDER — run each listed file's contents in this order,
-- OR paste them all in sequence below. To keep one source of truth,
-- the individual db/*.sql files remain the canonical scripts.
--
-- ── RECOMMENDED RUN ORDER (copy each file's contents in turn) ──
--   db/schema.sql
--   db/seed.sql
--   db/role_policies.sql
--   db/public_swimmers.sql
--   db/public_leaderboard.sql
--   db/organizers.sql
--   db/verification_docs.sql
--   db/reopen_requests.sql
--   db/seed_heats.sql        (optional: sample heat data)
--   db/seed_staff.sql        (optional: EM / super admin accounts)
--
-- After setup, promote your own account to super admin if needed:
--   update public.profiles set role = 'super_admin'
--   where id = (select id from auth.users where email = 'you@email.com');
-- ============================================================

-- Quick health check — run this AFTER the files above to confirm setup.
select 'tables' as check, count(*) as n
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','academies','coaches','swimmers','tournaments',
                     'bookings','event_entries','heat_rows','organizers','reopen_requests');

select 'views' as check, string_agg(table_name, ', ') as present
from information_schema.views
where table_schema = 'public'
  and table_name in ('swimmer_directory','academy_leaderboard','organizer_directory','reopen_request_queue');

select 'helper functions' as check, string_agg(routine_name, ', ') as present
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('my_role','is_staff','become_organizer','approve_reopen','deny_reopen');
