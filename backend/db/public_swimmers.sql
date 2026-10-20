-- ============================================================
-- SwimFest — Public swimmer directory view
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- WHY: the `swimmers` table has an RLS policy that only lets a
-- user read swimmers they own (owner_id = auth.uid()), and it
-- also contains PII (parent_phone, parent_email). We do NOT want
-- to open the whole table to the public.
--
-- Instead we expose a read-only VIEW with only directory-safe
-- columns. The Search Profile page queries this view.
-- ============================================================

create or replace view public.swimmer_directory
with (security_invoker = false) as
  select
    s.swimmer_id,
    s.full_name,
    s.gender,
    s.category,
    s.academy_id,
    a.academy_name
  from public.swimmers s
  left join public.academies a on a.academy_id = s.academy_id;

-- Allow the anon + authenticated roles to read the view.
grant select on public.swimmer_directory to anon, authenticated;

-- ============================================================
-- Done. The Search Profile page (search.html) reads from
-- swimmer_directory, so no PII is exposed publicly.
-- ============================================================
