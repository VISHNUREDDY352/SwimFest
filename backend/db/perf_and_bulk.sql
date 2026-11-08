-- ============================================================
-- Speed + bulk operations
--
--   1. Indexes on the columns every page filters by
--   2. Unique rule so a swimmer can't be entered in the same race
--      twice (only added when the existing data is already clean;
--      otherwise a NOTICE says so). Lanes are not unique: a relay team
--      shares one lane.
--   3. One-call, all-or-nothing database functions:
--        bulk_import_entries  spreadsheet import of swimmers + races
--        save_heats           replace a meet's heats safely
--        save_results         save many lanes' times at once
--   4. swimmer_directory gains the SFI serial number (search by ID)
--
-- Run after rbac_governance.sql and staff_manage_swimmers.sql.
-- Safe to run more than once.
-- ============================================================

-- ── 1. Indexes ──────────────────────────────────────────────
create index if not exists event_entries_tournament_idx on public.event_entries (tournament_id);
create index if not exists event_entries_swimmer_idx    on public.event_entries (swimmer_id);
create index if not exists heat_rows_tournament_idx     on public.heat_rows (tournament_id);
create index if not exists heat_rows_entry_idx          on public.heat_rows (event_entry_id);
create index if not exists bookings_tournament_idx      on public.bookings (tournament_id);
create index if not exists swimmers_academy_idx         on public.swimmers (academy_id);
create index if not exists coaches_academy_idx          on public.coaches (academy_id);
create index if not exists swimmers_name_dob_idx        on public.swimmers (lower(full_name), date_of_birth);

-- ── 2. Unique rule (only when the data is already clean) ────
do $$
begin
  if not exists (
    select 1 from public.event_entries
     group by tournament_id, swimmer_id, event_name having count(*) > 1
  ) then
    create unique index if not exists event_entries_one_per_race
      on public.event_entries (tournament_id, swimmer_id, event_name);
  else
    raise notice 'event_entries has duplicate (meet, swimmer, race) rows - unique rule skipped. Remove the duplicates and run again.';
  end if;
end $$;

-- ── Who may run a meet ──────────────────────────────────────
-- Super admin: any meet. Admin: assigned or created. Organizer: created.
create or replace function public.can_run_meet(p_tournament_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case (select role::text from public.profiles where id = auth.uid())
    when 'super_admin'   then true
    when 'event_manager' then exists (select 1 from public.tournaments
                                        where tournament_id = p_tournament_id and created_by = auth.uid())
                           or exists (select 1 from public.tournament_admins
                                        where tournament_id = p_tournament_id and admin_id = auth.uid())
    when 'organizer'     then exists (select 1 from public.tournaments
                                        where tournament_id = p_tournament_id and created_by = auth.uid())
    else false
  end
$$;
grant execute on function public.can_run_meet(uuid) to authenticated;

-- ── 3a. Bulk import of walk-in swimmers + races ─────────────
-- p_rows: [{ row_no, full_name, gender, date_of_birth, category,
--            parent_phone, academy_id, races: [{ event_name, is_im, seed_time_ms }] }]
-- The page validates every row first. This function re-checks the
-- essentials and saves everything in one transaction: if anything
-- fails, nothing is saved. An existing swimmer with the same name and
-- date of birth is reused instead of being created again.
create or replace function public.bulk_import_entries(p_tournament_id uuid, p_rows jsonb)
returns table (swimmers_added int, swimmers_reused int, entries_added int, entries_skipped int)
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  v_bad    text;
  v_added  int;
  v_reused int;
  v_entries int;
  v_total  int;
begin
  if not public.can_run_meet(p_tournament_id) then
    raise exception 'You are not allowed to add swimmers to this meet.' using errcode = '42501';
  end if;

  select status::text into v_status from public.tournaments where tournament_id = p_tournament_id;
  if v_status is null then
    raise exception 'Meet not found.';
  end if;
  if v_status in ('LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED') then
    raise exception 'This meet is % - its roster can no longer change.', lower(v_status);
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import.';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2000 rows at a time.';
  end if;

  create temp table _imp on commit drop as
  select r.row_no, trim(r.full_name) as full_name, r.gender, r.date_of_birth, r.category,
         trim(r.parent_phone) as parent_phone, r.academy_id, r.races,
         null::uuid as swimmer_id, false as reused
    from jsonb_to_recordset(p_rows) as r(
           row_no int, full_name text, gender text, date_of_birth date, category text,
           parent_phone text, academy_id uuid, races jsonb);

  -- Re-check the essentials (the page already did; this guards the database)
  select format('Row %s: %s', row_no,
           case when coalesce(full_name, '') = '' then 'name is missing'
                when gender not in ('Boy', 'Girl') then 'gender must be Boy or Girl'
                when date_of_birth is null then 'date of birth is missing'
                when category not in ('U-10', 'U-12', 'U-14', 'U-16') then 'age group must be U-10 to U-16'
                when coalesce(parent_phone, '') = '' then 'parent phone is missing'
                when length(parent_phone) > 15 then 'parent phone is longer than 15 characters'
                else 'has no races' end)
    into v_bad
    from _imp
   where coalesce(full_name, '') = '' or gender not in ('Boy', 'Girl') or date_of_birth is null
      or category not in ('U-10', 'U-12', 'U-14', 'U-16')
      or coalesce(parent_phone, '') = '' or length(parent_phone) > 15
      or races is null or jsonb_array_length(races) = 0
   order by row_no limit 1;
  if v_bad is not null then raise exception '%', v_bad; end if;

  -- Reuse swimmers that already exist (same name + date of birth)
  update _imp i
     set swimmer_id = s.swimmer_id, reused = true
    from (select distinct on (lower(full_name), date_of_birth) swimmer_id, lower(full_name) as lname, date_of_birth
            from public.swimmers order by lower(full_name), date_of_birth, created_at) s
   where s.lname = lower(i.full_name) and s.date_of_birth = i.date_of_birth;

  -- Create the rest in one statement (one new swimmer per name + dob in the file)
  with fresh as (
    select distinct on (lower(full_name), date_of_birth)
           full_name, gender, date_of_birth, category, parent_phone, academy_id
      from _imp where swimmer_id is null
     order by lower(full_name), date_of_birth, row_no
  ), ins as (
    insert into public.swimmers (full_name, gender, date_of_birth, category, parent_phone, academy_id, status)
    select full_name, gender::gender_enum, date_of_birth, category::category_enum, parent_phone, academy_id,
           'APPROVED_ACTIVE'::verification_status_enum
      from fresh
    returning swimmer_id, lower(full_name) as lname, date_of_birth
  )
  update _imp i set swimmer_id = ins.swimmer_id
    from ins where ins.lname = lower(i.full_name) and ins.date_of_birth = i.date_of_birth and i.swimmer_id is null;

  select count(distinct swimmer_id) filter (where not reused),
         count(distinct swimmer_id) filter (where reused)
    into v_added, v_reused from _imp;

  -- Every race, in one statement. Races the swimmer is already in are skipped.
  select count(*) into v_total from _imp i, jsonb_array_elements(i.races);

  with races as (
    select distinct on (i.swimmer_id, x.event_name)
           i.swimmer_id, i.gender, i.category, x.event_name,
           coalesce(x.is_im, false) as is_im, nullif(x.seed_time_ms, 0) as seed_time_ms
      from _imp i,
           jsonb_to_recordset(i.races) as x(event_name text, is_im boolean, seed_time_ms int)
     where coalesce(x.event_name, '') <> ''
  ), ins as (
    insert into public.event_entries
      (tournament_id, swimmer_id, event_name, stroke, distance, category, gender, seed_time_ms, is_relay, is_im)
    select p_tournament_id, r.swimmer_id, r.event_name,
           case when r.is_im then 'Medley' else nullif(regexp_replace(r.event_name, '^\d+m\s*', '', 'i'), '') end,
           case when substring(r.event_name from '^(\d+)')::int in (25, 50, 100, 200, 400)
                then substring(r.event_name from '^(\d+)')::int end,
           r.category::category_enum, r.gender::gender_enum, r.seed_time_ms, false, r.is_im
      from races r
     where not exists (select 1 from public.event_entries e
                        where e.tournament_id = p_tournament_id and e.swimmer_id = r.swimmer_id
                          and e.event_name = r.event_name)
    returning 1
  )
  select count(*) into v_entries from ins;

  insert into public.system_audit_logs (admin_id, action_type, target_entity, target_entity_id, notes)
  values (auth.uid(), 'BULK_IMPORT', 'TOURNAMENT', p_tournament_id::text,
          format('%s new swimmers, %s existing, %s races added', v_added, v_reused, v_entries));

  return query select v_added, v_reused, v_entries, v_total - v_entries;
end;
$$;
grant execute on function public.bulk_import_entries(uuid, jsonb) to authenticated;

-- ── 3b. Replace a meet's heats in one transaction ───────────
-- p_rows: [{ event_entry_id, pool_label, event_no, heat_number, lane_number }]
-- Refuses when any lane already has a time or status, so results are never lost.
create or replace function public.save_heats(p_tournament_id uuid, p_rows jsonb)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.can_run_meet(p_tournament_id) then
    raise exception 'You are not allowed to change heats for this meet.' using errcode = '42501';
  end if;
  if exists (select 1 from public.heat_rows
              where tournament_id = p_tournament_id
                and (finish_time_ms is not null or status::text <> 'OK')) then
    raise exception 'Results have already been entered for this meet. Heats can''t be replaced.';
  end if;

  delete from public.heat_rows where tournament_id = p_tournament_id;

  insert into public.heat_rows (tournament_id, event_entry_id, pool_label, event_no, heat_number, lane_number, status)
  select p_tournament_id, r.event_entry_id, r.pool_label, r.event_no, r.heat_number, r.lane_number, 'OK'::heat_status_enum
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
         as r(event_entry_id uuid, pool_label text, event_no int, heat_number int, lane_number int)
    join public.event_entries e on e.entry_id = r.event_entry_id and e.tournament_id = p_tournament_id;
  get diagnostics v_count = row_count;

  insert into public.system_audit_logs (admin_id, action_type, target_entity, target_entity_id, notes)
  values (auth.uid(), 'HEATS_SAVED', 'TOURNAMENT', p_tournament_id::text, format('%s lanes saved', v_count));

  return v_count;
end;
$$;
grant execute on function public.save_heats(uuid, jsonb) to authenticated;

-- ── 3c. Save many lanes' results at once ────────────────────
-- p_rows: [{ heat_row_id, prev_time_ms, prev_status, finish_time_ms, status, dq_code,
--            set_rank, official_rank, points_awarded }]
-- A lane is only updated if it still holds prev_time_ms / prev_status
-- (what this official last saw), so two officials can't overwrite each other.
-- Returns the ids that were saved; the page reports the rest as "changed by someone else".
create or replace function public.save_results(p_tournament_id uuid, p_rows jsonb)
returns setof uuid
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_run_meet(p_tournament_id) then
    raise exception 'You are not allowed to enter results for this meet.' using errcode = '42501';
  end if;

  return query
  update public.heat_rows h
     set finish_time_ms = r.finish_time_ms,
         status         = r.status::heat_status_enum,
         dq_code        = case when r.status = 'DQ' then r.dq_code::dq_code_enum end,
         official_rank  = case when coalesce(r.set_rank, false) then r.official_rank else h.official_rank end,
         points_awarded = case when coalesce(r.set_rank, false) then coalesce(r.points_awarded, 0) else h.points_awarded end,
         updated_at     = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
           heat_row_id uuid, prev_time_ms int, prev_status text, finish_time_ms int, status text,
           dq_code text, set_rank boolean, official_rank int, points_awarded int)
   where h.heat_row_id = r.heat_row_id
     and h.tournament_id = p_tournament_id
     and h.finish_time_ms is not distinct from r.prev_time_ms
     and h.status::text = coalesce(r.prev_status, 'OK')
  returning h.heat_row_id;
end;
$$;
grant execute on function public.save_results(uuid, jsonb) to authenticated;

-- ── 4. swimmer_directory: add the SFI serial number (search by ID) ──
-- New column goes last so "create or replace" keeps working.
create or replace view public.swimmer_directory
with (security_invoker = false) as
  select s.swimmer_id, s.full_name, s.gender, s.category, s.academy_id, a.academy_name, s.sfi_serial_no
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
