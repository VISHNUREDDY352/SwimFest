-- ============================================================
-- SwimFest — one meet per name
-- Refuses a second meet whose name matches an existing one,
-- ignoring capitals and extra spaces ("Coimbatore  meet" =
-- "coimbatore meet"). The Create a meet page checks the same
-- rule as you type; this makes it impossible to bypass.
--
-- Run once in the Supabase SQL editor, AFTER removing existing
-- duplicates (cleanup_duplicate_*.sql). If duplicates remain,
-- it stops and lists them instead of failing with a raw error.
-- ============================================================

do $$
declare
  dupes text;
begin
  -- Count copies per normalized name first, then list the repeated ones
  select string_agg(format('"%s" (%s copies)', name, copies), ', ')
    into dupes
  from (
    select min(title) as name, count(*) as copies
    from public.tournaments
    group by lower(regexp_replace(btrim(title), '\s+', ' ', 'g'))
    having count(*) > 1
  ) d;

  if dupes is not null then
    raise exception 'Remove these duplicate meets first: %', dupes;
  end if;
end $$;

create unique index if not exists tournaments_title_unique
  on public.tournaments (lower(regexp_replace(btrim(title), '\s+', ' ', 'g')));
