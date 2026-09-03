-- ============================================================
-- SwimFest — Supabase / PostgreSQL Schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (uses IF NOT EXISTS / DROP guards where needed).
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ── ENUM TYPES ──────────────────────────────────────────────
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

-- ── PROFILES (links to Supabase auth.users) ─────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   varchar(120),
  role        app_role_enum not null default 'swimmer',
  phone       varchar(15),
  created_at  timestamptz default now()
);

-- ── ACADEMIES ───────────────────────────────────────────────
create table if not exists academies (
  academy_id      uuid primary key default gen_random_uuid(),
  academy_name    varchar(200) not null unique,
  address_line    text,
  city            varchar(100) not null,
  state           varchar(100) not null default 'Tamil Nadu',
  contact_person  varchar(120),
  phone_number    varchar(15),
  email_id        varchar(100),
  pool_length     varchar(10) check (pool_length in ('25m','50m')),
  lane_count      int check (lane_count in (6,8,10)),
  pool_type       varchar(100),
  registration_no varchar(100),
  status          verification_status_enum not null default 'APPROVED_ACTIVE',
  created_at      timestamptz default now()
);

-- ── COACHES ─────────────────────────────────────────────────
create table if not exists coaches (
  coach_id           uuid primary key default gen_random_uuid(),
  full_name          varchar(120) not null,
  gender             varchar(10),
  date_of_birth      date,
  mobile_number      varchar(15),
  email_id           varchar(100),
  academy_id         uuid references academies(academy_id) on delete set null,
  designation        varchar(50),
  certifications     jsonb default '[]',
  experience_years   int default 0,
  status             verification_status_enum not null default 'APPROVED_ACTIVE',
  created_at         timestamptz default now()
);

-- ── SWIMMERS ────────────────────────────────────────────────
create table if not exists swimmers (
  swimmer_id     uuid primary key default gen_random_uuid(),
  owner_id       uuid references auth.users(id) on delete set null,  -- the logged-in parent/account
  full_name      varchar(120) not null,
  gender         gender_enum not null,
  date_of_birth  date not null,
  category       category_enum,
  sfi_serial_no  varchar(50) unique,
  parent_name    varchar(120),
  parent_phone   varchar(15) not null,
  parent_email   varchar(100),
  academy_id     uuid references academies(academy_id) on delete set null,
  coach_id       uuid references coaches(coach_id) on delete set null,
  created_at     timestamptz default now()
);

-- ── TOURNAMENTS ─────────────────────────────────────────────
create table if not exists tournaments (
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
  created_at            timestamptz default now()
);

-- ── BOOKINGS (one paid registration = one booking) ──────────
create table if not exists bookings (
  booking_id     uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(tournament_id) on delete cascade,
  swimmer_id     uuid references swimmers(swimmer_id) on delete cascade,
  booked_by      uuid references auth.users(id) on delete set null,
  base_fee       numeric(10,2) default 800.00,
  relay_fee      numeric(10,2) default 0.00,
  platform_fee   numeric(10,2) default 50.00,
  total_amount   numeric(10,2) not null,
  relay_selected boolean default false,
  im_selected    boolean default false,
  payment_status varchar(20) default 'PENDING',   -- PENDING | PAID | FAILED
  payment_ref    varchar(100),
  booking_ref    varchar(50),
  created_at     timestamptz default now()
);

-- ── EVENT ENTRIES (multi-event bookings expand to rows) ─────
create table if not exists event_entries (
  entry_id       uuid primary key default gen_random_uuid(),
  booking_id     uuid references bookings(booking_id) on delete cascade,
  swimmer_id     uuid references swimmers(swimmer_id) on delete cascade,
  tournament_id  uuid references tournaments(tournament_id) on delete cascade,
  event_name     varchar(60) not null,       -- e.g. "50m Freestyle"
  stroke         varchar(30),
  distance       int check (distance in (25,50,100,200,400)),
  category       category_enum not null,
  gender         gender_enum not null,
  seed_time_ms   int,                         -- null / 0 = NT
  is_relay       boolean default false,
  is_im          boolean default false,
  created_at     timestamptz default now()
);

-- ── HEAT ROWS (seeded lanes + results) ──────────────────────
create table if not exists heat_rows (
  heat_row_id    uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(tournament_id) on delete cascade,
  event_entry_id uuid references event_entries(entry_id) on delete cascade,
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

-- ── EMERGENCY NOTICES (Super Admin) ─────────────────────────
create table if not exists emergency_notices (
  notice_id   uuid primary key default gen_random_uuid(),
  title       varchar(200) not null,
  message     text not null,
  is_active   boolean default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now(),
  expired_at  timestamptz
);

-- ── SYSTEM AUDIT LOGS (immutable trail) ─────────────────────
create table if not exists system_audit_logs (
  log_id          uuid primary key default gen_random_uuid(),
  admin_id        uuid references auth.users(id) on delete set null,
  action_type     varchar(50) not null,
  target_entity   varchar(50),
  target_entity_id varchar(60),
  notes           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS and add permissive read policies so the anon key
-- can read public data. Writes go through authenticated users.
-- (You can tighten these later.)
-- ============================================================
alter table academies         enable row level security;
alter table coaches           enable row level security;
alter table tournaments       enable row level security;
alter table swimmers          enable row level security;
alter table bookings          enable row level security;
alter table event_entries     enable row level security;
alter table heat_rows         enable row level security;
alter table emergency_notices enable row level security;
alter table profiles          enable row level security;

-- Public read for directory/listing tables
drop policy if exists "public read academies" on academies;
create policy "public read academies" on academies for select using (true);

drop policy if exists "public read coaches" on coaches;
create policy "public read coaches" on coaches for select using (true);

drop policy if exists "public read tournaments" on tournaments;
create policy "public read tournaments" on tournaments for select using (true);

drop policy if exists "public read heat_rows" on heat_rows;
create policy "public read heat_rows" on heat_rows for select using (true);

drop policy if exists "public read notices" on emergency_notices;
create policy "public read notices" on emergency_notices for select using (true);

-- Authenticated users can insert/select their own swimmers & bookings
drop policy if exists "own swimmers" on swimmers;
create policy "own swimmers" on swimmers for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own bookings" on bookings;
create policy "own bookings" on bookings for all
  using (booked_by = auth.uid()) with check (booked_by = auth.uid());

drop policy if exists "own entries" on event_entries;
create policy "own entries" on event_entries for all
  using (true) with check (true);

-- Profiles: user manages own row
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- Allow authenticated users to create tournaments (EMs/Organizers)
drop policy if exists "auth insert tournaments" on tournaments;
create policy "auth insert tournaments" on tournaments for insert
  to authenticated with check (true);

drop policy if exists "auth update tournaments" on tournaments;
create policy "auth update tournaments" on tournaments for update
  to authenticated using (true) with check (true);

-- Allow inserts to academies/coaches by authenticated users (EM submissions)
drop policy if exists "auth insert academies" on academies;
create policy "auth insert academies" on academies for insert to authenticated with check (true);

drop policy if exists "auth insert coaches" on coaches;
create policy "auth insert coaches" on coaches for insert to authenticated with check (true);

-- ============================================================
-- Auto-create a profile row when a new auth user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::app_role_enum, 'swimmer'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Done. Next: run seed.sql to populate demo academies,
-- coaches, and tournaments.
-- ============================================================
