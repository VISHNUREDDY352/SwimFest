-- ============================================================
-- SwimFest — Public Academy Leaderboard view
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- WHY: the leaderboard needs to aggregate published results
-- (heat_rows.points_awarded / official_rank) grouped by academy.
-- That path goes heat_rows -> event_entries -> swimmers -> academies,
-- and `swimmers` RLS blocks anon reads. We do the aggregation in a
-- VIEW (owner privileges) and expose only academy-level totals —
-- no swimmer PII leaves the database.
--
-- Points are taken from heat_rows.points_awarded as published by
-- officials in the Results console. Medal counts come from
-- official_rank (1=gold, 2=silver, 3=bronze).
-- ============================================================

create or replace view public.academy_leaderboard
with (security_invoker = false) as
  select
    a.academy_id,
    a.academy_name,
    a.city,
    coalesce(sum(hr.points_awarded), 0)                              as total_points,
    count(*) filter (where hr.official_rank = 1)                     as gold,
    count(*) filter (where hr.official_rank = 2)                     as silver,
    count(*) filter (where hr.official_rank = 3)                     as bronze,
    count(distinct s.swimmer_id)
      filter (where hr.official_rank between 1 and 3)                as medalists
  from public.academies a
  join public.swimmers s        on s.academy_id = a.academy_id
  join public.event_entries ee  on ee.swimmer_id = s.swimmer_id
  join public.heat_rows hr       on hr.event_entry_id = ee.entry_id
  where hr.status = 'OK'
  group by a.academy_id, a.academy_name, a.city
  having coalesce(sum(hr.points_awarded), 0) > 0
  order by total_points desc, gold desc, silver desc, bronze desc;

grant select on public.academy_leaderboard to anon, authenticated;

-- ============================================================
-- Done. The Academy Leaderboard page (leaderboard.html) reads
-- from this view. Rows appear once officials publish results
-- with points in the Results console.
-- ============================================================
