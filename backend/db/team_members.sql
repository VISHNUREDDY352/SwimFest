-- ============================================================
-- team_members: one row per Owner, Co-Super Admin and Admin
--
-- Only these three roles are in this table; everyone else (parents,
-- swimmers, organizers) is not. It is kept in step with profiles
-- (which sign-in uses) in both directions:
--   • Team tab or profiles changes a role  → team_members follows
--   • editing / deleting a row here        → profiles follows
-- Rules: always at least one Owner. Needs rbac_governance.sql and
-- team_management.sql first. Safe to run more than once.
-- ============================================================

-- The signed-in viewer's role ('anon' when signed out); also in secure_views.sql
create or replace function public.viewer_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid()), 'anon')
$$;
grant execute on function public.viewer_role() to anon, authenticated;

create table if not exists public.team_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  team_role  text not null check (team_role in ('owner', 'co_super_admin', 'admin')),
  updated_at timestamptz not null default now()
);
alter table public.team_members enable row level security;

-- Super admins can read it; nobody writes through the website (the Team tab
-- uses team_set_role, which changes profiles, and this table follows)
drop policy if exists "super admins read team" on public.team_members;
create policy "super admins read team" on public.team_members
  for select to authenticated using (public.viewer_role() = 'super_admin');

-- profiles role → team role
create or replace function public.team_role_of(p_role text, p_owner boolean)
returns text language sql immutable as $$
  select case when p_role = 'super_admin' and p_owner then 'owner'
              when p_role = 'super_admin' then 'co_super_admin'
              when p_role = 'event_manager' then 'admin' end
$$;

-- ── profiles → team_members ─────────────────────────────────
create or replace function public.sync_team_from_profile()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare tr text;
begin
  if tg_op = 'DELETE' then
    delete from public.team_members where user_id = old.id;
    return old;
  end if;
  tr := public.team_role_of(new.role::text, coalesce(new.is_master_owner, false));
  if tr is null then
    delete from public.team_members where user_id = new.id;
  else
    insert into public.team_members (user_id, full_name, email, team_role, updated_at)
    values (new.id, new.full_name, (select email from auth.users where id = new.id), tr, now())
    on conflict (user_id) do update
      set full_name = excluded.full_name, email = excluded.email, team_role = excluded.team_role, updated_at = now();
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_team on public.profiles;
create trigger profiles_sync_team after insert or update of role, is_master_owner, full_name or delete on public.profiles
  for each row execute function public.sync_team_from_profile();

-- ── team_members → profiles (direct edits in Supabase) ──────
-- Skipped when the change came from profiles itself (trigger depth > 1).
create or replace function public.sync_profile_from_team()
returns trigger language plpgsql security definer set search_path = public as $$
declare owners int;
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if old.team_role = 'owner' then
      select count(*) into owners from public.team_members where team_role = 'owner';
      if owners < 1 then raise exception 'There must always be at least one Owner'; end if;
    end if;
    -- Off the team: back to organizer (if they run an organization) or swimmer / parent
    update public.profiles
       set role = (case when exists (select 1 from public.organizers o where o.owner_id = old.user_id)
                        then 'organizer' else 'swimmer' end)::app_role_enum,
           is_master_owner = false
     where id = old.user_id;
    delete from public.tournament_admins where admin_id = old.user_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.team_role = 'owner' and new.team_role <> 'owner' then
    select count(*) into owners from public.team_members where team_role = 'owner';
    if owners < 1 then raise exception 'There must always be at least one Owner'; end if;
  end if;

  update public.profiles
     set role = (case when new.team_role = 'admin' then 'event_manager' else 'super_admin' end)::app_role_enum,
         is_master_owner = (new.team_role = 'owner')
   where id = new.user_id;
  if new.team_role <> 'admin' then delete from public.tournament_admins where admin_id = new.user_id; end if;
  return new;
end $$;
drop trigger if exists team_sync_profile on public.team_members;
create trigger team_sync_profile after insert or update of team_role or delete on public.team_members
  for each row execute function public.sync_profile_from_team();

-- ── Fill it with today's team ───────────────────────────────
insert into public.team_members (user_id, full_name, email, team_role)
select p.id, p.full_name, u.email, public.team_role_of(p.role::text, coalesce(p.is_master_owner, false))
  from public.profiles p join auth.users u on u.id = p.id
 where p.role::text in ('super_admin', 'event_manager')
on conflict (user_id) do update
  set full_name = excluded.full_name, email = excluded.email, team_role = excluded.team_role, updated_at = now();
-- Anyone no longer on the team
delete from public.team_members t
 where not exists (select 1 from public.profiles p where p.id = t.user_id and p.role::text in ('super_admin', 'event_manager'));

-- ── Team tab reads the list from this table ─────────────────
create or replace function public.team_list()
returns table (id uuid, full_name text, email text, role text, is_master_owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_master_owner() then raise exception 'Only the Owner can manage the team'; end if;
  return query
    select t.user_id, t.full_name, t.email,
           case when t.team_role = 'admin' then 'event_manager' else 'super_admin' end,
           t.team_role = 'owner'
      from public.team_members t
     order by case t.team_role when 'owner' then 0 when 'co_super_admin' then 1 else 2 end, t.full_name;
end $$;
grant execute on function public.team_list() to authenticated;
