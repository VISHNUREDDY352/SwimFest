-- ============================================================
-- SwimFest — BULLETPROOF ALL-IN-ONE DATABASE SETUP
-- ============================================================
-- Paste this ENTIRE file into:
--   Supabase Dashboard → SQL Editor → New query → Run
--
-- Safe to re-run multiple times (idempotent).
-- All optional modules (storage, auth seed) are protected with
-- error handlers so they NEVER fail table creation.
-- ============================================================

-- ── 1. EXTENSIONS ───────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── 2. ENUMS ────────────────────────────────────────────────
do $$ begin
  create type gender_enum as enum ('Boy','Girl');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_enum as enum ('U-10','U-12','U-14','U-16');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gateway_option_enum as enum ('OPTION_A_PLATFORM_GATEWAY','OPTION_B_NO_GATEWAY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tournament_status_enum as enum
    ('DRAFT','PENDING_APPROVAL','REJECTED_DRAFT','PUBLISHED','CLOSED','LOCKED','CLOSURE_REQUESTED','COMPLETED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_status_enum as enum ('PENDING_VERIFICATION','APPROVED_ACTIVE','REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type heat_status_enum as enum ('OK','DNS','DNF','DQ');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dq_code_enum as enum ('FS','IT','IS','IK','OT','LV','ET');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role_enum as enum ('swimmer','event_manager','organizer','super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reopen_status_enum as enum ('PENDING','APPROVED','DENIED');
exception when duplicate_object then null; end $$;

-- ── 3. TABLES (PUBLIC SCHEMA) ───────────────────────────────

-- PROFILES
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   varchar(120),
  role        app_role_enum not null default 'swimmer',
  phone       varchar(15),
  created_at  timestamptz default now()
);

-- ACADEMIES
create table if not exists public.academies (
  academy_id       uuid primary key default gen_random_uuid(),
  academy_name     varchar(200) not null unique,
  address_line     text,
  city             varchar(100) not null,
  state            varchar(100) not null default 'Tamil Nadu',
  contact_person   varchar(120),
  phone_number     varchar(15),
  email_id         varchar(100),
  pool_length      varchar(10) check (pool_length in ('25m','50m')),
  lane_count       int check (lane_count in (6,8,10)),
  pool_type        varchar(100),
  registration_no  varchar(100),
  document_url     text,
  created_by_email varchar(100),
  status           verification_status_enum not null default 'APPROVED_ACTIVE',
  created_at       timestamptz default now()
);

-- COACHES
create table if not exists public.coaches (
  coach_id          uuid primary key default gen_random_uuid(),
  full_name         varchar(120) not null,
  gender            varchar(10),
  date_of_birth     date,
  mobile_number     varchar(15),
  email_id          varchar(100),
  academy_id        uuid references public.academies(academy_id) on delete set null,
  designation       varchar(50),
  certifications    jsonb default '[]',
  experience_years  int default 0,
  document_url      text,
  created_by_email  varchar(100),
  status            verification_status_enum not null default 'APPROVED_ACTIVE',
  created_at        timestamptz default now()
);

-- SWIMMERS
create table if not exists public.swimmers (
  swimmer_id     uuid primary key default gen_random_uuid(),
  owner_id       uuid references auth.users(id) on delete set null,
  full_name      varchar(120) not null,
  gender         gender_enum not null,
  date_of_birth  date not null,
  category       category_enum,
  sfi_serial_no  varchar(50) unique,
  parent_name    varchar(120),
  parent_phone   varchar(15) not null,
  parent_email   varchar(100),
  school_name    varchar(150),
  nationality    varchar(50) default 'Indian',
  blood_group    varchar(10),
  id_ref         varchar(100),
  academy_id     uuid references public.academies(academy_id) on delete set null,
  coach_id       uuid references public.coaches(coach_id) on delete set null,
  status         verification_status_enum not null default 'PENDING_VERIFICATION',
  created_at     timestamptz default now()
);

-- ORGANIZERS
create table if not exists public.organizers (
  organizer_id    uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id) on delete cascade,
  org_name        varchar(200) not null,
  contact_person  varchar(120) not null,
  email_id        varchar(120),
  phone_number    varchar(15),
  city            varchar(100) default 'Tamil Nadu',
  state           varchar(100) default 'Tamil Nadu',
  registration_no varchar(100),
  document_url    text,
  status          verification_status_enum not null default 'PENDING_VERIFICATION',
  created_at      timestamptz default now()
);
create unique index if not exists organizers_owner_uidx on public.organizers(owner_id);

-- TOURNAMENTS
create table if not exists public.tournaments (
  tournament_id         uuid primary key default gen_random_uuid(),
  title                 varchar(200) not null,
  host_organization     varchar(200),
  state                 varchar(100) not null default 'Tamil Nadu',
  city                  varchar(100) not null,
  venue_name            varchar(200) not null,
  pool_length           varchar(10) check (pool_length in ('25m','50m')),
  lane_count            int check (lane_count in (6,8,10)),
  start_date            date not null,
  end_date              date not null,
  registration_deadline timestamptz,
  reg_fee_amount        numeric(10,2) default 800.00,
  relay_add_on_fee      numeric(10,2) default 300.00,
  platform_fee          numeric(10,2) default 50.00,
  max_individual_events int default 3,
  allow_swim_up         boolean default false,
  non_medalist_rule     boolean default true,
  gateway_option        gateway_option_enum default 'OPTION_A_PLATFORM_GATEWAY',
  status                tournament_status_enum not null default 'DRAFT',
  poster_url            text,
  created_by            uuid references auth.users(id) on delete set null,
  created_by_email      varchar(100),
  created_at            timestamptz default now()
);

-- BOOKINGS
create table if not exists public.bookings (
  booking_id     uuid primary key default gen_random_uuid(),
  tournament_id  uuid references public.tournaments(tournament_id) on delete cascade,
  swimmer_id     uuid references public.swimmers(swimmer_id) on delete cascade,
  booked_by      uuid references auth.users(id) on delete set null,
  base_fee       numeric(10,2) default 800.00,
  relay_fee      numeric(10,2) default 0.00,
  platform_fee   numeric(10,2) default 50.00,
  total_amount   numeric(10,2) not null,
  relay_selected boolean default false,
  im_selected    boolean default false,
  payment_status varchar(20) default 'PENDING',
  payment_ref    varchar(100),
  booking_ref    varchar(50),
  created_at     timestamptz default now()
);

-- EVENT ENTRIES
create table if not exists public.event_entries (
  entry_id       uuid primary key default gen_random_uuid(),
  booking_id     uuid references public.bookings(booking_id) on delete cascade,
  swimmer_id     uuid references public.swimmers(swimmer_id) on delete cascade,
  tournament_id  uuid references public.tournaments(tournament_id) on delete cascade,
  event_name     varchar(60) not null,
  stroke         varchar(30),
  distance       int check (distance in (25,50,100,200,400)),
  category       category_enum not null,
  gender         gender_enum not null,
  seed_time_ms   int,
  is_relay       boolean default false,
  is_im          boolean default false,
  created_at     timestamptz default now()
);

-- HEAT ROWS
create table if not exists public.heat_rows (
  heat_row_id    uuid primary key default gen_random_uuid(),
  tournament_id  uuid references public.tournaments(tournament_id) on delete cascade,
  event_entry_id uuid references public.event_entries(entry_id) on delete cascade,
  pool_label     varchar(100),
  event_no       int,
  heat_number    int not null,
  lane_number    int not null,
  finish_time_ms int,
  status         heat_status_enum default 'OK',
  dq_code        dq_code_enum,
  points_awarded int default 0,
  official_rank  int,
  updated_at     timestamptz default now()
);

-- REOPEN REQUESTS
create table if not exists public.reopen_requests (
  request_id     uuid primary key default gen_random_uuid(),
  tournament_id  uuid references public.tournaments(tournament_id) on delete cascade,
  requested_by   uuid references auth.users(id) on delete set null,
  reason         text not null,
  status         reopen_status_enum not null default 'PENDING',
  decided_by     uuid references auth.users(id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz default now()
);

-- EMERGENCY NOTICES
create table if not exists public.emergency_notices (
  notice_id   uuid primary key default gen_random_uuid(),
  title       varchar(200) not null,
  message     text not null,
  is_active   boolean default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now(),
  expired_at  timestamptz
);

-- SYSTEM AUDIT LOGS
create table if not exists public.system_audit_logs (
  log_id          uuid primary key default gen_random_uuid(),
  admin_id        uuid references auth.users(id) on delete set null,
  action_type     varchar(60) not null,
  target_entity   varchar(60),
  target_entity_id varchar(100),
  notes           text,
  created_at      timestamptz default now()
);

-- ── 4. AUTH TRIGGER & HELPER FUNCTIONS ──────────────────────

-- Profile creation trigger on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role app_role_enum := 'swimmer';
  v_meta_role text;
begin
  begin
    if (new.raw_user_meta_data ? 'role') then
      v_meta_role := lower(trim(new.raw_user_meta_data->>'role'));
      if v_meta_role in ('swimmer','event_manager','organizer','super_admin') then
        v_role := v_meta_role::app_role_enum;
      end if;
    end if;
  exception when others then
    v_role := 'swimmer';
  end;

  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_role,
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone     = excluded.phone;

  return new;
exception when others then
  return new; -- never block auth signup
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- my_role() helper
create or replace function public.my_role()
returns app_role_enum
language sql stable security definer
set search_path = public
as $$
  select coalesce(role, 'swimmer'::app_role_enum) from public.profiles where id = auth.uid()
$$;
grant execute on function public.my_role() to anon, authenticated;

-- is_staff() helper
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.my_role() in
    ('event_manager','organizer','super_admin'), false)
$$;
grant execute on function public.is_staff() to anon, authenticated;

-- become_organizer() helper
create or replace function public.become_organizer()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles set role = 'organizer'
   where id = auth.uid() and role in ('swimmer');
end $$;
grant execute on function public.become_organizer() to authenticated;

-- approve_reopen helper
create or replace function public.approve_reopen(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tid uuid;
begin
  if public.my_role() <> 'super_admin' then
    raise exception 'Only super admin can approve reopen requests';
  end if;
  select tournament_id into v_tid from public.reopen_requests where request_id = p_request_id;
  if v_tid is null then raise exception 'Request not found'; end if;
  update public.reopen_requests
     set status = 'APPROVED', decided_by = auth.uid(), decided_at = now()
   where request_id = p_request_id;
  update public.tournaments
     set status = 'PUBLISHED'
   where tournament_id = v_tid;
end $$;
grant execute on function public.approve_reopen(uuid) to authenticated;

-- deny_reopen helper
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

-- ── 5. PUBLIC VIEWS ─────────────────────────────────────────

-- Swimmer Directory
create or replace view public.swimmer_directory
with (security_invoker = false) as
  select s.swimmer_id, s.full_name, s.gender, s.category, s.academy_id, a.academy_name
  from public.swimmers s
  left join public.academies a on a.academy_id = s.academy_id;
grant select on public.swimmer_directory to anon, authenticated;

-- Academy Leaderboard
create or replace view public.academy_leaderboard
with (security_invoker = false) as
  select a.academy_id, a.academy_name, a.city,
    coalesce(sum(hr.points_awarded), 0)                              as total_points,
    count(*) filter (where hr.official_rank = 1)                     as gold,
    count(*) filter (where hr.official_rank = 2)                     as silver,
    count(*) filter (where hr.official_rank = 3)                     as bronze,
    count(distinct s.swimmer_id) filter (where hr.official_rank between 1 and 3) as medalists
  from public.academies a
  join public.swimmers s        on s.academy_id = a.academy_id
  join public.event_entries ee  on ee.swimmer_id = s.swimmer_id
  join public.heat_rows hr       on hr.event_entry_id = ee.entry_id
  where hr.status = 'OK'
  group by a.academy_id, a.academy_name, a.city
  having coalesce(sum(hr.points_awarded), 0) > 0
  order by total_points desc, gold desc, silver desc, bronze desc;
grant select on public.academy_leaderboard to anon, authenticated;

-- Organizer Directory
create or replace view public.organizer_directory
with (security_invoker = false) as
  select organizer_id, owner_id, org_name, contact_person, city, state,
         registration_no, document_url, status, created_at
  from public.organizers;
grant select on public.organizer_directory to anon, authenticated;

-- Reopen Request Queue
create or replace view public.reopen_request_queue
with (security_invoker = false) as
  select r.request_id, r.tournament_id, r.reason, r.status, r.created_at,
         r.requested_by, t.title as tournament_title,
         o.org_name, o.contact_person
  from public.reopen_requests r
  join public.tournaments t on t.tournament_id = r.tournament_id
  left join public.organizers o on o.owner_id = r.requested_by;
grant select on public.reopen_request_queue to anon, authenticated;

-- ── 6. ROW LEVEL SECURITY (RLS) POLICIES ────────────────────

alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.coaches enable row level security;
alter table public.swimmers enable row level security;
alter table public.organizers enable row level security;
alter table public.tournaments enable row level security;
alter table public.bookings enable row level security;
alter table public.event_entries enable row level security;
alter table public.heat_rows enable row level security;
alter table public.reopen_requests enable row level security;
alter table public.emergency_notices enable row level security;
alter table public.system_audit_logs enable row level security;

-- Profiles policies
drop policy if exists "profiles self select" on profiles;
create policy "profiles self select" on profiles
  for select to authenticated using (id = auth.uid() or public.my_role() = 'super_admin');

drop policy if exists "profiles self insert" on profiles;
create policy "profiles self insert" on profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles no self escalate" on profiles;
create policy "profiles no self escalate" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());

drop policy if exists "superadmin manage profiles" on profiles;
create policy "superadmin manage profiles" on profiles
  for update to authenticated using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

-- Academies policies
drop policy if exists "public read academies" on academies;
create policy "public read academies" on academies for select using (true);

drop policy if exists "staff insert academies" on academies;
create policy "staff insert academies" on academies for insert to authenticated with check (public.is_staff());

drop policy if exists "superadmin update academies" on academies;
create policy "superadmin update academies" on academies for update to authenticated
  using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

-- Coaches policies
drop policy if exists "public read coaches" on coaches;
create policy "public read coaches" on coaches for select using (true);

drop policy if exists "staff insert coaches" on coaches;
create policy "staff insert coaches" on coaches for insert to authenticated with check (public.is_staff());

drop policy if exists "superadmin update coaches" on coaches;
create policy "superadmin update coaches" on coaches for update to authenticated
  using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

-- Swimmers policies
drop policy if exists "own swimmers select" on swimmers;
create policy "own swimmers select" on swimmers for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());

drop policy if exists "own swimmers insert" on swimmers;
create policy "own swimmers insert" on swimmers for insert to authenticated
  with check (owner_id = auth.uid() or public.is_staff());

drop policy if exists "own swimmers update" on swimmers;
create policy "own swimmers update" on swimmers for update to authenticated
  using (owner_id = auth.uid() or public.my_role() = 'super_admin');

-- Organizers policies
drop policy if exists "own organizer" on organizers;
create policy "own organizer" on organizers for all
  using (owner_id = auth.uid() or public.is_staff()) with check (owner_id = auth.uid() or public.my_role() = 'super_admin');

drop policy if exists "organizer self insert" on organizers;
create policy "organizer self insert" on organizers for insert to authenticated with check (owner_id = auth.uid());

-- Tournaments policies
drop policy if exists "public read tournaments" on tournaments;
create policy "public read tournaments" on tournaments for select using (true);

drop policy if exists "staff insert tournaments" on tournaments;
create policy "staff insert tournaments" on tournaments for insert to authenticated with check (public.is_staff());

drop policy if exists "owner update tournaments" on tournaments;
create policy "owner update tournaments" on tournaments for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "superadmin update tournaments" on tournaments;
create policy "superadmin update tournaments" on tournaments for update to authenticated
  using (public.my_role() = 'super_admin') with check (public.my_role() = 'super_admin');

drop policy if exists "superadmin delete tournaments" on tournaments;
create policy "superadmin delete tournaments" on tournaments for delete to authenticated
  using (public.my_role() = 'super_admin');

-- Bookings policies
drop policy if exists "own bookings" on bookings;
create policy "own bookings" on bookings for select to authenticated
  using (booked_by = auth.uid() or public.is_staff());

drop policy if exists "user create booking" on bookings;
create policy "user create booking" on bookings for insert to authenticated
  with check (booked_by = auth.uid());

-- Event Entries policies
drop policy if exists "public read entries" on event_entries;
create policy "public read entries" on event_entries for select using (true);

drop policy if exists "register insert entries" on event_entries;
create policy "register insert entries" on event_entries for insert to authenticated
  with check (public.is_staff() or exists (
    select 1 from public.bookings b where b.booking_id = event_entries.booking_id and b.booked_by = auth.uid()
  ));

-- Heat Rows policies
drop policy if exists "public read heat_rows" on heat_rows;
create policy "public read heat_rows" on heat_rows for select using (true);

drop policy if exists "staff write heat_rows" on heat_rows;
create policy "staff write heat_rows" on heat_rows for all to authenticated using (public.is_staff());

-- Reopen Requests policies
drop policy if exists "org insert reopen" on reopen_requests;
create policy "org insert reopen" on reopen_requests for insert to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "org read own reopen" on reopen_requests;
create policy "org read own reopen" on reopen_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_staff());

drop policy if exists "superadmin update reopen" on reopen_requests;
create policy "superadmin update reopen" on reopen_requests for update to authenticated
  using (public.my_role() = 'super_admin');

-- Audit Logs & Notices
drop policy if exists "staff read audit" on system_audit_logs;
create policy "staff read audit" on system_audit_logs for select to authenticated using (public.is_staff());

drop policy if exists "superadmin insert audit" on system_audit_logs;
create policy "superadmin insert audit" on system_audit_logs for insert to authenticated with check (public.my_role() = 'super_admin');

drop policy if exists "public read notices" on emergency_notices;
create policy "public read notices" on emergency_notices for select using (true);

drop policy if exists "superadmin write notices" on emergency_notices;
create policy "superadmin write notices" on emergency_notices for all to authenticated with check (public.my_role() = 'super_admin');

-- ── 7. SEED DATA (ACADEMIES & TOURNAMENTS) ──────────────────

insert into public.academies (academy_name, address_line, city, state, contact_person, phone_number, email_id, pool_length, lane_count, pool_type, registration_no, status)
values
  ('Chennai Swim Club',      '14, Velachery Main Road',            'Chennai',        'Tamil Nadu', 'R. Sundaram',      '+91 98400 12345', 'info@chennaiswim.com',        '50m', 8, 'Indoor Heated Pool',       'TN-REG-2024-001', 'APPROVED_ACTIVE'),
  ('SRM Aquatics Academy',   'SRM University Campus, Kattankulathur','Kattankulathur','Tamil Nadu', 'Dr. M. Arumugam',  '+91 94440 67890', 'sports@srm.edu',              '50m', 8, 'Outdoor Competition Pool', 'TN-REG-2024-002', 'APPROVED_ACTIVE'),
  ('Aqua Stars Coimbatore',  'Race Course Road, Coimbatore',       'Coimbatore',     'Tamil Nadu', 'P. Krishnamurthy', '+91 97890 54321', 'aquastars.cbe@gmail.com',     '25m', 6, 'Indoor Pool',              'TN-REG-2024-003', 'APPROVED_ACTIVE'),
  ('SDAT Academy Chennai',   'SDAT Aquatic Complex, Velachery',    'Chennai',        'Tamil Nadu', 'S. Balakrishnan',  '+91 94450 11223', 'sdat.aquatics@tn.gov.in',     '50m', 8, 'Olympic Standard Pool',    'TN-REG-2024-004', 'APPROVED_ACTIVE')
on conflict (academy_name) do nothing;

insert into public.coaches (full_name, gender, date_of_birth, mobile_number, email_id, academy_id, designation, certifications, experience_years, status)
select v.full_name, v.gender, v.dob::date, v.mobile, v.email,
       a.academy_id, v.designation, v.certs::jsonb, v.exp, 'APPROVED_ACTIVE'::verification_status_enum
from (values
  ('K. Ramesh',     'Male',   '1982-06-14', '+91 98400 11111', 'k.ramesh@chennaiswim.com', 'Chennai Swim Club',    'Head Coach', '["ASCA Level 3","SFI Certified"]', 12),
  ('V. Anand',      'Male',   '1978-11-05', '+91 94440 33333', 'v.anand@srm.edu',          'SRM Aquatics Academy', 'Head Coach', '["ASCA Level 4","NIS Diploma"]', 18),
  ('A. Selvakumar', 'Male',   '1975-07-08', '+91 94450 66666', 'selva@sdat.gov.in',        'SDAT Academy Chennai', 'Head Coach', '["ASCA Level 5","NIS Diploma"]', 22)
) as v(full_name, gender, dob, mobile, email, academy_name, designation, certs, exp)
join public.academies a on a.academy_name = v.academy_name
on conflict do nothing;

insert into public.tournaments (title, host_organization, state, city, venue_name, pool_length, lane_count, start_date, end_date, registration_deadline, reg_fee_amount, relay_add_on_fee, allow_swim_up, non_medalist_rule, gateway_option, status)
values
  ('Golden Non-Medalist Championship 2026', 'SRM University', 'Tamil Nadu', 'Chennai', 'SRM University Pool, Kattankulathur', '50m', 8, '2026-10-15','2026-10-16','2026-09-30 23:59:00+05:30', 800.00, 300.00, false, true,  'OPTION_A_PLATFORM_GATEWAY', 'PUBLISHED'),
  ('Tamil Nadu State Junior Aquatic Meet 2026','SDAT',        'Tamil Nadu', 'Chennai', 'SDAT Aquatic Complex, Velachery',    '50m', 8, '2026-11-05','2026-11-07','2026-10-20 23:59:00+05:30', 500.00, 300.00, true,  true,  'OPTION_A_PLATFORM_GATEWAY', 'PUBLISHED'),
  ('All-India Inter-Club Swimming Meet 2026','SDAT',          'Tamil Nadu', 'Chennai', 'SDAT Aquatic Complex, Velachery',    '50m', 8, '2026-06-20','2026-06-22','2026-06-01 23:59:00+05:30', 600.00, 300.00, false, false, 'OPTION_A_PLATFORM_GATEWAY', 'COMPLETED')
on conflict do nothing;

-- ── 8. OPTIONAL: STORAGE BUCKET (SAFE TRY) ──────────────────
do $$ begin
  insert into storage.buckets (id, name, public)
  values ('verification-docs', 'verification-docs', true)
  on conflict (id) do nothing;

  drop policy if exists "verification docs upload" on storage.objects;
  create policy "verification docs upload" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'verification-docs');

  drop policy if exists "verification docs read" on storage.objects;
  create policy "verification docs read" on storage.objects
    for select using (bucket_id = 'verification-docs');
exception when others then
  null; -- safely ignore if storage extension is not yet initialized
end $$;

-- ── 9. OPTIONAL: SEED STAFF ACCOUNTS (SAFE TRY) ─────────────
do $$
declare
  staff record;
  uid uuid;
begin
  for staff in
    select * from (values
      ('superadmin@swimfest.in', 'SwimFest Super Admin', 'super_admin', 'SwimFest@2026'),
      ('thangavishnuvardhanreddy@gmail.com', 'Event Manager', 'event_manager', 'vishnu@123')
    ) as t(email, full_name, role, password)
  loop
    begin
      select id into uid from auth.users where email = staff.email;
      if uid is null then
        uid := gen_random_uuid();
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
          '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', staff.email,
          crypt(staff.password, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', staff.full_name, 'role', staff.role),
          now(), now()
        );
        begin
          insert into auth.identities (
            id, user_id, provider_id, identity_data, provider, email,
            last_sign_in_at, created_at, updated_at
          ) values (
            gen_random_uuid(), uid, staff.email,
            jsonb_build_object('sub', uid::text, 'email', staff.email),
            'email', staff.email, now(), now(), now()
          );
        exception when others then null; end;
      end if;

      insert into public.profiles (id, full_name, role, phone)
      values (uid, staff.full_name, staff.role::app_role_enum, '')
      on conflict (id) do update set role = staff.role::app_role_enum;
    exception when others then
      null; -- safely ignore if direct auth.users insert is restricted by Supabase version
    end;
  end loop;
end $$;

-- ── 10. SUCCESS CONFIRMATION ────────────────────────────────
select 'Setup completed successfully!' as status,
  (select count(*) from public.academies) as academies_count,
  (select count(*) from public.tournaments) as tournaments_count;
