-- ============================================================
-- SwimFest — Sample heat sheet data
-- Creates a few event_entries + heat_rows for the Golden
-- Non-Medalist tournament so the public Heat Sheets viewer
-- (heatsheets.html) has real data to display.
-- Run in Supabase SQL Editor AFTER schema.sql + seed.sql.
-- ============================================================

do $$
declare
  v_tid uuid;
  v_sid uuid;
  v_e1  uuid; v_e2 uuid; v_e3 uuid; v_e4 uuid; v_e5 uuid;
begin
  -- Tournament
  select tournament_id into v_tid from tournaments
    where title = 'Golden Non-Medalist Championship 2026' limit 1;
  if v_tid is null then raise notice 'Tournament not found — run seed.sql first'; return; end if;

  -- A placeholder swimmer to attach entries to (unattached, no owner)
  insert into swimmers (full_name, gender, date_of_birth, category, parent_name, parent_phone)
    values ('Demo Roster Swimmer', 'Boy', '2015-05-14', 'U-12', 'Demo Parent', '+91 90000 00000')
    returning swimmer_id into v_sid;

  -- Event entries (Event 3 — Boys U-12 50m Freestyle) with seed times
  insert into event_entries (swimmer_id, tournament_id, event_name, stroke, distance, category, gender, seed_time_ms)
    values (v_sid, v_tid, '50m Freestyle', 'Freestyle', 50, 'U-12', 'Boy', 31100) returning entry_id into v_e1;
  insert into event_entries (swimmer_id, tournament_id, event_name, stroke, distance, category, gender, seed_time_ms)
    values (v_sid, v_tid, '50m Freestyle', 'Freestyle', 50, 'U-12', 'Boy', 32400) returning entry_id into v_e2;
  insert into event_entries (swimmer_id, tournament_id, event_name, stroke, distance, category, gender, seed_time_ms)
    values (v_sid, v_tid, '50m Freestyle', 'Freestyle', 50, 'U-12', 'Boy', 33000) returning entry_id into v_e3;
  insert into event_entries (swimmer_id, tournament_id, event_name, stroke, distance, category, gender, seed_time_ms)
    values (v_sid, v_tid, '50m Freestyle', 'Freestyle', 50, 'U-12', 'Boy', null)  returning entry_id into v_e4;
  insert into event_entries (swimmer_id, tournament_id, event_name, stroke, distance, category, gender, seed_time_ms)
    values (v_sid, v_tid, '50m Freestyle', 'Freestyle', 50, 'U-12', 'Boy', 38700) returning entry_id into v_e5;

  -- Heat rows — Heat 1 of 1, spearhead lanes (Pool 1, Event 3)
  insert into heat_rows (tournament_id, event_entry_id, pool_label, event_no, heat_number, lane_number, status)
  values
    (v_tid, v_e1, 'Competition Pool A', 3, 1, 4, 'OK'),   -- fastest → lane 4
    (v_tid, v_e2, 'Competition Pool A', 3, 1, 5, 'OK'),
    (v_tid, v_e3, 'Competition Pool A', 3, 1, 3, 'OK'),
    (v_tid, v_e5, 'Competition Pool A', 3, 1, 6, 'OK'),
    (v_tid, v_e4, 'Competition Pool A', 3, 1, 2, 'OK');   -- NT → outer lane

  raise notice 'Sample heat sheet inserted for Golden Non-Medalist Championship 2026.';
end $$;
