-- ============================================================
-- SwimFest — Database Columns Migration Script
-- Run this in Supabase Dashboard → SQL Editor → New query → Run
-- Adds created_by_email and status columns to existing tables
-- ============================================================

-- 1. Add created_by_email to tournaments
alter table public.tournaments
  add column if not exists created_by_email varchar(100);

-- 2. Add created_by_email to academies
alter table public.academies
  add column if not exists created_by_email varchar(100);

-- 3. Add created_by_email to coaches
alter table public.coaches
  add column if not exists created_by_email varchar(100);

-- 4. Ensure verification_status_enum exists
do $$ begin
  create type verification_status_enum as enum ('PENDING_VERIFICATION','APPROVED_ACTIVE','REJECTED');
exception when duplicate_object then null; end $$;

-- 5. Add status to swimmers
alter table public.swimmers
  add column if not exists status verification_status_enum not null default 'PENDING_VERIFICATION';

-- 6. Add demographic fields to swimmers if missing
alter table public.swimmers
  add column if not exists school_name varchar(150),
  add column if not exists nationality varchar(50) default 'Indian',
  add column if not exists blood_group varchar(10),
  add column if not exists id_ref varchar(100);
