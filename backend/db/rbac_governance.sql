-- ============================================================
-- Role matrix (Section 11): Owner / Co-Super Admin, assigned meets,
-- a tamper-proof audit log, record versions and organizer payouts.
-- Safe to run more than once.
-- ============================================================

-- ── 1. Master Owner vs Co-Super Admin ───────────────────────
-- Both are role 'super_admin'. The Owner has is_master_owner = true;
-- a Co-Super Admin has false (logged approvals, reopening needs a
-- written justification, read-only financials).
alter table public.profiles add column if not exists is_master_owner boolean not null default false;
-- Everyone who is a super admin today stays an Owner
update public.profiles set is_master_owner = true where role::text = 'super_admin' and is_master_owner = false
  and not exists (select 1 from public.profiles p where p.is_master_owner);

create or replace function public.is_master_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'super_admin' and is_master_owner from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.is_master_owner() to authenticated;

-- Only an Owner can make someone an Owner (or take it away)
create or replace function public.guard_master_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null in the Supabase SQL editor, where the project owner may set it directly
  if new.is_master_owner is distinct from old.is_master_owner and auth.uid() is not null and not public.is_master_owner() then
    raise exception 'Only the Master Owner can change who is an Owner';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_master_owner on public.profiles;
create trigger profiles_guard_master_owner before update on public.profiles
  for each row execute function public.guard_master_owner();

-- ── 2. Admins assigned to meets ─────────────────────────────
-- An Admin (event_manager) runs the player list and heat generation
-- only for meets they are assigned to (or created themselves).
create table if not exists public.tournament_admins (
  tournament_id uuid not null references public.tournaments(tournament_id) on delete cascade,
  admin_id      uuid not null references auth.users(id) on delete cascade,
  assigned_by   uuid references auth.users(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  primary key (tournament_id, admin_id)
);
alter table public.tournament_admins enable row level security;

drop policy if exists "staff read assignments" on public.tournament_admins;
create policy "staff read assignments" on public.tournament_admins
  for select to authenticated using (public.is_meet_staff());
drop policy if exists "superadmin assign admins" on public.tournament_admins;
create policy "superadmin assign admins" on public.tournament_admins
  for insert to authenticated with check ((select role::text from public.profiles where id = auth.uid()) = 'super_admin');
drop policy if exists "superadmin unassign admins" on public.tournament_admins;
create policy "superadmin unassign admins" on public.tournament_admins
  for delete to authenticated using ((select role::text from public.profiles where id = auth.uid()) = 'super_admin');

-- ── 3. Audit log: who, when, from where; can't be changed ───
alter table public.system_audit_logs add column if not exists ip_address text;

-- The database fills in the admin, the time and the IP address, so they can't be faked
create or replace function public.stamp_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare hdrs json;
begin
  new.admin_id := coalesce(auth.uid(), new.admin_id);
  new.created_at := now();
  begin
    hdrs := current_setting('request.headers', true)::json;
  exception when others then hdrs := null;
  end;
  new.ip_address := nullif(trim(split_part(coalesce(hdrs->>'x-forwarded-for', hdrs->>'x-real-ip', ''), ',', 1)), '');
  return new;
end $$;
drop trigger if exists audit_stamp on public.system_audit_logs;
create trigger audit_stamp before insert on public.system_audit_logs
  for each row execute function public.stamp_audit_log();

-- Entries can never be edited or deleted
create or replace function public.audit_log_is_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Audit log entries cannot be changed or deleted';
end $$;
drop trigger if exists audit_immutable on public.system_audit_logs;
create trigger audit_immutable before update or delete on public.system_audit_logs
  for each row execute function public.audit_log_is_immutable();

-- Every staff member's actions are logged, not only the super admin's
drop policy if exists "staff insert audit" on public.system_audit_logs;
create policy "staff insert audit" on public.system_audit_logs
  for insert to authenticated with check (public.is_meet_staff());

-- ── 4. Record versions (no silent overwrites) ───────────────
-- Each save raises row_version by one. Pages save "only if the version
-- is still the one I loaded"; if another admin saved first, nothing is
-- changed and the page asks to reload.
alter table public.tournaments   add column if not exists row_version integer not null default 1;
alter table public.event_entries add column if not exists row_version integer not null default 1;
alter table public.heat_rows     add column if not exists row_version integer not null default 1;

create or replace function public.bump_row_version()
returns trigger language plpgsql as $$
begin
  new.row_version := old.row_version + 1;
  return new;
end $$;
drop trigger if exists tournaments_row_version on public.tournaments;
create trigger tournaments_row_version before update on public.tournaments
  for each row execute function public.bump_row_version();
drop trigger if exists event_entries_row_version on public.event_entries;
create trigger event_entries_row_version before update on public.event_entries
  for each row execute function public.bump_row_version();
drop trigger if exists heat_rows_row_version on public.heat_rows;
create trigger heat_rows_row_version before update on public.heat_rows
  for each row execute function public.bump_row_version();

-- ── 5. Organizer payout summary ─────────────────────────────
-- Totals for the signed-in organizer's own meets only (bookings themselves stay private)
create or replace function public.organizer_payout_summary()
returns table (tournament_id uuid, title text, gateway_option text, start_date date,
               paid_bookings bigint, paid_amount numeric, unpaid_bookings bigint, unpaid_amount numeric)
language sql stable security definer set search_path = public as $$
  select t.tournament_id, t.title::text, t.gateway_option::text, t.start_date::date,
         count(b.*) filter (where b.payment_status::text = 'PAID'),
         coalesce(sum(b.total_amount) filter (where b.payment_status::text = 'PAID'), 0),
         count(b.*) filter (where b.payment_status::text <> 'PAID'),
         coalesce(sum(b.total_amount) filter (where b.payment_status::text <> 'PAID'), 0)
    from public.tournaments t
    left join public.bookings b on b.tournament_id = t.tournament_id
   where t.created_by = auth.uid()
   group by t.tournament_id
   order by t.start_date desc
$$;
grant execute on function public.organizer_payout_summary() to authenticated;
