-- ============================================================
-- Reasons for rejections ("Sent back" feedback)
--
-- When the super admin or an Admin rejects a meet, swimmer, academy,
-- coach or organizer, the reason is saved on the row so the person who
-- submitted it can see what to fix (organizer dashboard, Fix and resend
-- screen, parent's profile and Register page).
--
-- The check constraints make a reason compulsory for every NEW
-- rejection. They are NOT VALID, so rows rejected before this file
-- (with no reason recorded) are left alone.
-- Safe to run more than once.
-- ============================================================

alter table public.tournaments add column if not exists rejection_notes text;
alter table public.swimmers    add column if not exists rejection_notes text;
alter table public.academies   add column if not exists rejection_notes text;
alter table public.coaches     add column if not exists rejection_notes text;
alter table public.organizers  add column if not exists rejection_notes text;

-- A meet can't be sent back without a reason
alter table public.tournaments drop constraint if exists tournaments_rejection_needs_reason;
alter table public.tournaments add constraint tournaments_rejection_needs_reason
  check (status::text <> 'REJECTED_DRAFT' or coalesce(btrim(rejection_notes), '') <> '') not valid;

-- Swimmers, academies, coaches and organizers can't be rejected without a reason
alter table public.swimmers drop constraint if exists swimmers_rejection_needs_reason;
alter table public.swimmers add constraint swimmers_rejection_needs_reason
  check (status::text <> 'REJECTED' or coalesce(btrim(rejection_notes), '') <> '') not valid;

alter table public.academies drop constraint if exists academies_rejection_needs_reason;
alter table public.academies add constraint academies_rejection_needs_reason
  check (status::text <> 'REJECTED' or coalesce(btrim(rejection_notes), '') <> '') not valid;

alter table public.coaches drop constraint if exists coaches_rejection_needs_reason;
alter table public.coaches add constraint coaches_rejection_needs_reason
  check (status::text <> 'REJECTED' or coalesce(btrim(rejection_notes), '') <> '') not valid;

alter table public.organizers drop constraint if exists organizers_rejection_needs_reason;
alter table public.organizers add constraint organizers_rejection_needs_reason
  check (status::text <> 'REJECTED' or coalesce(btrim(rejection_notes), '') <> '') not valid;
