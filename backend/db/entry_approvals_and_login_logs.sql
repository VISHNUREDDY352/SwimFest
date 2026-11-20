-- ============================================================
-- SwimFest — approve event registrations (not accounts) + login log
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run more than once.
--
-- 1. A swimmer account no longer needs approval to sign in or register.
-- 2. Each event registration (a booking and its races) waits for approval.
--    * Super Admin: any meet
--    * Admin: meets they are assigned to, or created
--    Only approved races go into heats. The parent sees the decision on
--    their profile (My registrations).
-- 3. Every sign-in is recorded; only Super Admins can read the log.
--
-- Needs public.is_meet_staff() (staff_manage_swimmers.sql) and
-- public.tournament_admins (rbac_governance.sql).
-- ============================================================

-- ── 1. Registration approval columns ────────────────────────
-- Bookings made before this change are marked approved, so heats for running
-- meets don't lose anyone. Only bookings whose swimmer was still waiting for
-- verification stay pending (they were made under the old "needs approval"
-- flow). This backfill runs only the first time, when the column is new.
do $$
declare fresh boolean;
begin
  fresh := not exists (select 1 from information_schema.columns
                        where table_schema = 'public' and table_name = 'bookings' and column_name = 'approval_status');

  alter table public.bookings
    add column if not exists approval_status text not null default 'PENDING',
    add column if not exists decision_notes  text,
    add column if not exists decided_by      uuid references auth.users(id) on delete set null,
    add column if not exists decided_at      timestamptz;

  -- Races: walk-ins and imports added by staff are approved straight away
  alter table public.event_entries
    add column if not exists approval_status text not null default 'APPROVED';

  if fresh then
    update public.bookings b set approval_status = 'APPROVED', decided_at = now()
     where not exists (select 1 from public.swimmers s
                        where s.swimmer_id = b.swimmer_id and s.status::text = 'PENDING_VERIFICATION');
    update public.event_entries e set approval_status = 'PENDING'
      from public.bookings b
     where e.booking_id = b.booking_id and b.approval_status = 'PENDING';
  end if;
end $$;

do $$ begin
  alter table public.bookings add constraint bookings_approval_status_chk
    check (approval_status in ('PENDING', 'APPROVED', 'REJECTED'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_entries add constraint entries_approval_status_chk
    check (approval_status in ('PENDING', 'APPROVED', 'REJECTED'));
exception when duplicate_object then null;
end $$;

-- ── 2. Swimmer accounts: no approval needed ─────────────────
alter table public.swimmers alter column status set default 'APPROVED_ACTIVE';
update public.swimmers set status = 'APPROVED_ACTIVE' where status = 'PENDING_VERIFICATION';

-- ── 3. Parents can't approve their own entries ──────────────
-- A parent's new booking / race always starts PENDING, and only staff
-- can change the decision afterwards.
create or replace function public.guard_entry_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Staff, and the SQL editor / service role (no signed-in user), may set it.
  -- Anonymous visitors can't write bookings or races at all (RLS).
  if auth.uid() is null or public.is_meet_staff() then return new; end if;
  if tg_op = 'INSERT' then
    new.approval_status := 'PENDING';
    if tg_table_name = 'bookings' then
      new.decision_notes := null; new.decided_by := null; new.decided_at := null;
    end if;
  else
    new.approval_status := old.approval_status;
    if tg_table_name = 'bookings' then
      new.decision_notes := old.decision_notes; new.decided_by := old.decided_by; new.decided_at := old.decided_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bookings_guard_approval on public.bookings;
create trigger bookings_guard_approval before insert or update on public.bookings
  for each row execute function public.guard_entry_approval();
drop trigger if exists entries_guard_approval on public.event_entries;
create trigger entries_guard_approval before insert or update on public.event_entries
  for each row execute function public.guard_entry_approval();

-- Admins and Super Admins can read bookings (approval queues). Organizers
-- aren't included: they'd otherwise see every parent's registrations.
drop policy if exists "staff read bookings" on public.bookings;
create policy "staff read bookings" on public.bookings
  for select to authenticated
  using ((select role::text from public.profiles where id = auth.uid()) in ('super_admin', 'event_manager'));

-- ── 4. Who may decide a meet's registrations ────────────────
create or replace function public.can_decide_entries(p_tournament uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role::text from public.profiles where id = auth.uid()) = 'super_admin'
    or ((select role::text from public.profiles where id = auth.uid()) = 'event_manager'
        and (exists (select 1 from public.tournament_admins ta
                      where ta.tournament_id = p_tournament and ta.admin_id = auth.uid())
             or exists (select 1 from public.tournaments t
                         where t.tournament_id = p_tournament and t.created_by = auth.uid()))),
    false)
$$;
grant execute on function public.can_decide_entries(uuid) to authenticated;

-- Approve or decline one registration (booking + its races), logged
create or replace function public.decide_booking(p_booking_id uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b record; v_status text;
begin
  select bk.*, t.title as meet_title, s.full_name as swimmer_name
    into b
    from public.bookings bk
    left join public.tournaments t on t.tournament_id = bk.tournament_id
    left join public.swimmers s on s.swimmer_id = bk.swimmer_id
   where bk.booking_id = p_booking_id;
  if not found then raise exception 'Registration not found'; end if;
  if not public.can_decide_entries(b.tournament_id) then
    raise exception 'You can only decide registrations for meets you run';
  end if;
  if not p_approve and coalesce(trim(p_notes), '') = '' then
    raise exception 'A reason is needed to decline a registration';
  end if;

  v_status := case when p_approve then 'APPROVED' else 'REJECTED' end;
  update public.bookings
     set approval_status = v_status, decision_notes = nullif(trim(p_notes), ''),
         decided_by = auth.uid(), decided_at = now()
   where booking_id = p_booking_id;
  update public.event_entries set approval_status = v_status where booking_id = p_booking_id;

  insert into public.system_audit_logs (admin_id, action_type, target_entity, target_entity_id, notes)
  values (auth.uid(), case when p_approve then 'REGISTRATION_APPROVED' else 'REGISTRATION_REJECTED' end,
          'TOURNAMENT', b.tournament_id::text,
          coalesce(b.swimmer_name, 'Swimmer') || ' · ' || coalesce(b.meet_title, 'meet')
          || coalesce(' · ' || b.booking_ref, '')
          || case when p_approve then '' else E'\nReason: ' || trim(p_notes) end);
end $$;
grant execute on function public.decide_booking(uuid, boolean, text) to authenticated;

-- ── 5. Login log ────────────────────────────────────────────
create table if not exists public.login_logs (
  log_id       uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  email        text,
  full_name    text,
  role         text,
  method       text,
  user_agent   text,
  ip_address   text,
  logged_in_at timestamptz not null default now()
);
create index if not exists login_logs_time_idx on public.login_logs (logged_in_at desc);
alter table public.login_logs enable row level security;

drop policy if exists "super admins read login logs" on public.login_logs;
create policy "super admins read login logs" on public.login_logs
  for select to authenticated
  using ((select role::text from public.profiles where id = auth.uid()) = 'super_admin');
-- No insert/update/delete policies: rows are only written by record_login()

-- Called by the site right after a successful sign-in. The database fills in
-- who, when and from where, so an entry can't be faked for someone else.
create or replace function public.record_login(p_method text default 'password', p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare hdrs json; v_ip text;
begin
  if auth.uid() is null then return; end if;
  begin
    hdrs := current_setting('request.headers', true)::json;
  exception when others then hdrs := null;
  end;
  v_ip := nullif(trim(split_part(coalesce(hdrs->>'x-forwarded-for', hdrs->>'x-real-ip', ''), ',', 1)), '');
  insert into public.login_logs (user_id, email, full_name, role, method, user_agent, ip_address)
  select auth.uid(), u.email, p.full_name, p.role::text, left(p_method, 30), left(p_user_agent, 300), v_ip
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = auth.uid();
end $$;
grant execute on function public.record_login(text, text) to authenticated;

notify pgrst, 'reload schema';
