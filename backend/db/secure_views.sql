-- ============================================================
-- Close the "UNRESTRICTED" views
--
-- A view reads its tables with its owner's rights, so the tables'
-- permission rules don't apply to it: anyone with the site's public
-- key could read every row. Each view now decides itself who may
-- see which rows. Columns stay the same, so no page changes are needed.
--
--   swimmer_directory     public: only swimmers entered in a published
--                         meet (heat sheets, results, live board);
--                         parents: their own children; super admin and
--                         Admins: everyone
--   organizer_directory   super admin and Admins: everyone;
--                         an organizer: their own organization; public: nothing
--   reopen_request_queue  super admin only
--   academy_leaderboard   unchanged (public by design)
-- Safe to run more than once.
-- ============================================================

-- The signed-in viewer's role ('anon' when signed out)
create or replace function public.viewer_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()), 'anon')
$$;
grant execute on function public.viewer_role() to anon, authenticated;

-- ── Swimmers ────────────────────────────────────────────────
create or replace view public.swimmer_directory
with (security_invoker = false) as
  select s.swimmer_id, s.full_name, s.gender, s.category, s.academy_id, a.academy_name
    from public.swimmers s
    left join public.academies a on a.academy_id = s.academy_id
   where public.viewer_role() in ('super_admin', 'event_manager')
      or s.owner_id = auth.uid()
      or exists (
           select 1 from public.event_entries e
             join public.tournaments t on t.tournament_id = e.tournament_id
            where e.swimmer_id = s.swimmer_id
              and t.status::text in ('PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'));
grant select on public.swimmer_directory to anon, authenticated;

-- ── Organizers ──────────────────────────────────────────────
create or replace view public.organizer_directory
with (security_invoker = false) as
  select organizer_id, owner_id, org_name, contact_person, city, state,
         registration_no, document_url, status, created_at
    from public.organizers
   where public.viewer_role() in ('super_admin', 'event_manager')
      or owner_id = auth.uid();
revoke select on public.organizer_directory from anon;
grant select on public.organizer_directory to authenticated;

-- ── Reopen requests ─────────────────────────────────────────
create or replace view public.reopen_request_queue
with (security_invoker = false) as
  select r.request_id, r.tournament_id, r.reason, r.status, r.created_at,
         r.requested_by, t.title as tournament_title,
         o.org_name, o.contact_person
    from public.reopen_requests r
    join public.tournaments t on t.tournament_id = r.tournament_id
    left join public.organizers o on o.owner_id = r.requested_by
   where public.viewer_role() = 'super_admin';
revoke select on public.reopen_request_queue from anon;
grant select on public.reopen_request_queue to authenticated;
