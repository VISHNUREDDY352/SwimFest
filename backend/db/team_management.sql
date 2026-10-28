-- ============================================================
-- Team tab (super admin page, Owner only)
--
-- The Owner can see every super admin and Admin, find any user by
-- name or email, and give or take away roles:
--   Co-Super Admin (super_admin, not Owner), Owner, Admin (event_manager)
-- Every change is written to the audit log.
-- Needs rbac_governance.sql first (is_master_owner). Safe to run again.
-- ============================================================

-- Everyone with a staff role, with their login email
create or replace function public.team_list()
returns table (id uuid, full_name text, email text, role text, is_master_owner boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_master_owner() then raise exception 'Only the Owner can manage the team'; end if;
  return query
    select p.id, p.full_name::text, u.email::text, p.role::text, p.is_master_owner
      from public.profiles p join auth.users u on u.id = p.id
     where p.role::text in ('super_admin', 'event_manager')
     order by (p.role::text = 'super_admin') desc, p.is_master_owner desc, p.full_name;
end $$;

-- Find a person to add, by name or email (at most 20)
create or replace function public.team_find(q text)
returns table (id uuid, full_name text, email text, role text, is_master_owner boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_master_owner() then raise exception 'Only the Owner can manage the team'; end if;
  if length(trim(coalesce(q, ''))) < 2 then return; end if;
  return query
    select p.id, p.full_name::text, u.email::text, p.role::text, p.is_master_owner
      from public.profiles p join auth.users u on u.id = p.id
     where p.full_name ilike '%' || trim(q) || '%' or u.email ilike '%' || trim(q) || '%'
     order by p.full_name
     limit 20;
end $$;

-- Give or take away a role.
--   p_role: 'owner' | 'co_super_admin' | 'admin' | 'remove'
-- 'remove' returns the person to organizer (if they run an organization) or swimmer/parent.
create or replace function public.team_set_role(p_user uuid, p_role text)
returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  before_role text; before_owner boolean; who text; new_role text; new_owner boolean := false; owners int;
begin
  if not public.is_master_owner() then raise exception 'Only the Owner can manage the team'; end if;
  if p_user = auth.uid() then raise exception 'You can''t change your own role'; end if;

  select p.role::text, p.is_master_owner, coalesce(p.full_name, u.email)
    into before_role, before_owner, who
    from public.profiles p join auth.users u on u.id = p.id where p.id = p_user;
  if before_role is null then raise exception 'That user was not found'; end if;

  if p_role = 'owner' then new_role := 'super_admin'; new_owner := true;
  elsif p_role = 'co_super_admin' then new_role := 'super_admin';
  elsif p_role = 'admin' then new_role := 'event_manager';
  elsif p_role = 'remove' then
    new_role := case when exists (select 1 from public.organizers o where o.owner_id = p_user) then 'organizer' else 'swimmer' end;
  else raise exception 'Unknown role %', p_role;
  end if;

  -- There must always be at least one Owner
  if before_owner and not new_owner then
    select count(*) into owners from public.profiles where role::text = 'super_admin' and is_master_owner;
    if owners <= 1 then raise exception 'There must always be at least one Owner'; end if;
  end if;

  update public.profiles set role = new_role::app_role_enum, is_master_owner = new_owner where id = p_user;
  -- No longer an Admin: they no longer run any meets
  if new_role <> 'event_manager' then delete from public.tournament_admins where admin_id = p_user; end if;

  insert into public.system_audit_logs (admin_id, action_type, target_entity, target_entity_id, notes)
  values (auth.uid(), 'TEAM_ROLE_CHANGED', 'PROFILE', p_user::text,
          format(E'%s\nChange: %s → %s',
                 who,
                 case when before_role = 'super_admin' then case when before_owner then 'Owner' else 'Co-Super Admin' end
                      when before_role = 'event_manager' then 'Admin' else initcap(before_role) end,
                 case when new_role = 'super_admin' then case when new_owner then 'Owner' else 'Co-Super Admin' end
                      when new_role = 'event_manager' then 'Admin' else initcap(new_role) end));
  return who;
end $$;

grant execute on function public.team_list() to authenticated;
grant execute on function public.team_find(text) to authenticated;
grant execute on function public.team_set_role(uuid, text) to authenticated;
