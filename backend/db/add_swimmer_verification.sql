-- ============================================================
-- Turn on swimmer verification
--
-- The live swimmers table has no status column, so swimmers can't
-- be approved or rejected and the Verifications queue can't show them.
-- This adds the column:
--   * every swimmer already in the database is marked approved
--   * swimmers added by parents from now on start as PENDING_VERIFICATION
--     and appear in Super Admin -> Approvals -> Verifications
--   * walk-in swimmers added by staff at the pool are approved straight
--     away (the player list page sends APPROVED_ACTIVE)
-- Safe to run more than once.
-- ============================================================

do $$ begin
  create type verification_status_enum as enum ('PENDING_VERIFICATION', 'APPROVED_ACTIVE', 'REJECTED');
exception when duplicate_object then null;
end $$;

-- Existing swimmers: approved
alter table public.swimmers
  add column if not exists status verification_status_enum not null default 'APPROVED_ACTIVE';

-- New swimmers from now on: waiting for verification unless staff say otherwise
alter table public.swimmers
  alter column status set default 'PENDING_VERIFICATION';

-- Super admin can approve or reject a swimmer
drop policy if exists "staff update swimmers" on swimmers;
create policy "staff update swimmers" on swimmers
  for update to authenticated
  using (public.is_meet_staff()) with check (public.is_meet_staff());
