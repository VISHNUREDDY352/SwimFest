-- Run this in Supabase SQL Editor to diagnose signup issues.

-- 1. Does the profiles table exist with the right columns?
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

-- 2. Does the trigger exist?
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname = 'on_auth_user_created';

-- 3. Does the app_role_enum type exist and what values?
select enumlabel
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'app_role_enum';
