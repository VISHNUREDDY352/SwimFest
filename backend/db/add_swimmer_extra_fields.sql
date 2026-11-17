-- ============================================================
-- SwimFest — optional swimmer details from the registration form
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run more than once.
--
-- The live swimmers table was missing these, so registration failed with
-- "Could not find the 'blood_group' column of 'swimmers' in the schema cache".
-- ============================================================

alter table public.swimmers
  add column if not exists school_name varchar(150),
  add column if not exists nationality varchar(50) default 'Indian',
  add column if not exists blood_group varchar(10),
  add column if not exists id_ref      varchar(100);

-- Make the API see the new columns straight away
notify pgrst, 'reload schema';
