-- ============================================================
-- SwimFest — Enable Supabase Realtime for the super admin dashboard
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Adds the tables the super admin console watches to the
-- supabase_realtime publication, so new submissions appear instantly.
-- Re-runnable: skips tables that are already published.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['tournaments','swimmers','academies','coaches','organizers','reopen_requests','bookings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Verify ──
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
