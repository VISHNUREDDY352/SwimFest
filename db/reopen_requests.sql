-- ============================================================
-- SwimFest — Meet Reopen Requests (organizer → super admin approval)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Flow:
--   1. An organizer requests to reopen their OWN completed meet
--      (inserts a PENDING row here — they cannot reopen it themselves).
--   2. Super Admin reviews the queue and APPROVES or DENIES.
--   3. On APPROVE, the tournament status flips back to PUBLISHED.
--
-- Requires public.my_role() / public.is_staff() from role_policies.sql.
-- ============================================================

do $$ begin
  create type reopen_status_enum as enum ('PENDING','APPROVED','DENIED');
exception when duplicate_object then null; end $$;

create table if not exists reopen_requests (
  request_id     uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(tournament_id) on delete cascade,
  requested_by   uuid references auth.users(id) on delete set null,  -- organizer
  reason         text not null,
  status         reopen_status_enum not null default 'PENDING',
  decided_by     uuid references auth.users(id) on delete set null,  -- super admin
  decided_at     timestamptz,
  created_at     timestamptz default now()
);

create index if not exists reopen_requests_status_idx on reopen_requests(status);
create index if not exists reopen_requests_tournament_idx on reopen_requests(tournament_id);

-- ── RLS ─────────────────────────────────────────────────────
alter table reopen_requests enable row level security;

-- Organizer: create a request for a meet THEY created, and read their own
drop policy if exists "org insert reopen" on reopen_requests;
create policy "org insert reopen" on reopen_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.tournaments t
      where t.tournament_id = reopen_requests.tournament_id
        and t.created_by = auth.uid()
    )
  );

drop policy if exists "org read own reopen" on reopen_requests;
create policy "org read own reopen" on reopen_requests
  for select to authenticated
  using (requested_by = auth.uid() or public.is_staff());

-- Super Admin: update (approve/deny) any request
drop policy if exists "superadmin update reopen" on reopen_requests;
create policy "superadmin update reopen" on reopen_requests
  for update to authenticated
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- ── Approve helper (SECURITY DEFINER) ───────────────────────
-- Super admin calls this to approve a request: it marks the request
-- APPROVED and flips the tournament back to PUBLISHED atomically.
create or replace function public.approve_reopen(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tid uuid;
begin
  if public.my_role() <> 'super_admin' then
    raise exception 'Only super admin can approve reopen requests';
  end if;

  select tournament_id into v_tid from public.reopen_requests where request_id = p_request_id;
  if v_tid is null then
    raise exception 'Request not found';
  end if;

  update public.reopen_requests
     set status = 'APPROVED', decided_by = auth.uid(), decided_at = now()
   where request_id = p_request_id;

  update public.tournaments
     set status = 'PUBLISHED'
   where tournament_id = v_tid;
end $$;

grant execute on function public.approve_reopen(uuid) to authenticated;

-- ── Deny helper ─────────────────────────────────────────────
create or replace function public.deny_reopen(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if public.my_role() <> 'super_admin' then
    raise exception 'Only super admin can deny reopen requests';
  end if;
  update public.reopen_requests
     set status = 'DENIED', decided_by = auth.uid(), decided_at = now()
   where request_id = p_request_id;
end $$;

grant execute on function public.deny_reopen(uuid) to authenticated;

-- ── Public view for the super-admin queue (joins meet + organizer) ──
create or replace view public.reopen_request_queue
with (security_invoker = false) as
  select r.request_id, r.tournament_id, r.reason, r.status, r.created_at,
         r.requested_by, t.title as tournament_title,
         o.org_name, o.contact_person
  from public.reopen_requests r
  join public.tournaments t on t.tournament_id = r.tournament_id
  left join public.organizers o on o.owner_id = r.requested_by;

grant select on public.reopen_request_queue to anon, authenticated;

-- ============================================================
-- Done. Organizers request reopen; super admins approve via
-- approve_reopen() / deny via deny_reopen().
-- ============================================================
