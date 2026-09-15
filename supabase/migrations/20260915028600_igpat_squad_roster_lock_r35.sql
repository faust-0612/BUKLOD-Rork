-- BUKLOD IGPAT R35 — Squad consent/roster integrity.
-- Team membership may change while a challenge is merely OPEN. The accepted
-- battle roster is snapshotted at acceptance and stays locked until the match
-- completes or is cancelled, so W/L attribution cannot include people who left
-- before acceptance or people who joined after the battle began.

create or replace function public.igpat_create_squad_match_v1(
  p_squad_id uuid,
  p_opponent_squad_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  opponent_captain uuid;
  own_count integer;
  opponent_count integer;
  new_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_squad_id = p_opponent_squad_id then raise exception 'A Squad cannot challenge itself'; end if;

  if not exists (
    select 1 from public.igpat_arena_squads s
    where s.id=p_squad_id and s.captain_user_id=actor and s.status='ACTIVE'
  ) then raise exception 'Only your active Squad captain can create this challenge'; end if;

  select s.captain_user_id into opponent_captain
  from public.igpat_arena_squads s
  where s.id=p_opponent_squad_id and s.status='ACTIVE';
  if opponent_captain is null then raise exception 'Opponent Squad is unavailable'; end if;

  if not exists (
    select 1 from public.buklod_user_follows f
    where f.follower_id=actor and f.followed_user_id=opponent_captain
  ) then raise exception 'Follow the opposing captain before sending a Squad challenge'; end if;

  select count(*) into own_count
  from public.igpat_arena_squad_members m
  where m.squad_id=p_squad_id and m.status='ACTIVE';
  select count(*) into opponent_count
  from public.igpat_arena_squad_members m
  where m.squad_id=p_opponent_squad_id and m.status='ACTIVE';
  if own_count < 2 or opponent_count < 2 then
    raise exception 'Both Squads need at least 2 consenting active members';
  end if;

  if exists (
    select 1 from public.igpat_arena_squad_matches m
    where m.status in ('OPEN','ACCEPTED','ACTIVE')
      and ((m.challenger_squad_id=p_squad_id and m.opponent_squad_id=p_opponent_squad_id)
        or (m.challenger_squad_id=p_opponent_squad_id and m.opponent_squad_id=p_squad_id))
  ) then raise exception 'These Squads already have an active challenge'; end if;

  if (
    select count(*) from public.igpat_arena_squad_matches m
    where m.challenger_squad_id=p_squad_id and m.created_at>=now()-interval '24 hours'
  ) >= 3 then raise exception 'Squad challenge cooldown reached. Try again later'; end if;

  insert into public.igpat_arena_squad_matches(
    challenger_squad_id,opponent_squad_id,status
  ) values(p_squad_id,p_opponent_squad_id,'OPEN')
  returning id into new_id;

  -- Deliberately do NOT snapshot here. OPEN is still a consent window.
  return new_id;
end;
$$;

create or replace function public.igpat_respond_squad_match_v1(
  p_match_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  match_row public.igpat_arena_squad_matches%rowtype;
  challenger_count integer;
  opponent_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select * into match_row
  from public.igpat_arena_squad_matches m
  where m.id=p_match_id and m.status='OPEN'
  for update;

  if match_row.id is null or not exists (
    select 1 from public.igpat_arena_squads s
    where s.id=match_row.opponent_squad_id
      and s.captain_user_id=actor
      and s.status='ACTIVE'
  ) then raise exception 'Only the challenged Squad captain can respond'; end if;

  -- Clear any stale pre-acceptance snapshots from earlier/dev migration states.
  delete from public.igpat_arena_squad_match_members mm
  where mm.match_id=p_match_id;

  if not coalesce(p_accept,false) then
    update public.igpat_arena_squad_matches
    set status='CANCELLED'
    where id=p_match_id;
    return;
  end if;

  if not exists (
    select 1 from public.igpat_arena_squads s
    where s.id=match_row.challenger_squad_id and s.status='ACTIVE'
  ) then raise exception 'The challenging Squad is no longer active'; end if;

  select count(*) into challenger_count
  from public.igpat_arena_squad_members m
  where m.squad_id=match_row.challenger_squad_id and m.status='ACTIVE';
  select count(*) into opponent_count
  from public.igpat_arena_squad_members m
  where m.squad_id=match_row.opponent_squad_id and m.status='ACTIVE';

  if challenger_count < 2 or opponent_count < 2 then
    raise exception 'Both Squads still need at least 2 active consenting members at acceptance';
  end if;

  insert into public.igpat_arena_squad_match_members(match_id,squad_id,user_id)
  select p_match_id,m.squad_id,m.user_id
  from public.igpat_arena_squad_members m
  where m.squad_id in (match_row.challenger_squad_id,match_row.opponent_squad_id)
    and m.status='ACTIVE';

  update public.igpat_arena_squad_matches
  set status='ACCEPTED'
  where id=p_match_id;
end;
$$;

create or replace function public.igpat_cancel_squad_match_v1(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  match_row public.igpat_arena_squad_matches%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select * into match_row
  from public.igpat_arena_squad_matches m
  where m.id=p_match_id and m.status='OPEN'
  for update;

  if match_row.id is null or not exists (
    select 1 from public.igpat_arena_squads s
    where s.id=match_row.challenger_squad_id
      and s.captain_user_id=actor
      and s.status='ACTIVE'
  ) then raise exception 'Only the challenging captain can cancel an open Squad challenge'; end if;

  update public.igpat_arena_squad_matches
  set status='CANCELLED'
  where id=p_match_id;

  delete from public.igpat_arena_squad_match_members mm
  where mm.match_id=p_match_id;
end;
$$;

create or replace function public.igpat_invite_squad_member_v1(
  p_squad_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  active_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.igpat_arena_squads s
    where s.id=p_squad_id and s.captain_user_id=actor and s.status='ACTIVE'
  ) then raise exception 'Only the active Squad captain can invite members'; end if;

  if exists (
    select 1 from public.igpat_arena_squad_matches m
    where (m.challenger_squad_id=p_squad_id or m.opponent_squad_id=p_squad_id)
      and m.status in ('ACCEPTED','ACTIVE')
  ) then raise exception 'Squad roster is locked while an accepted battle is active'; end if;

  if p_target_user_id=actor then raise exception 'Captain is already in the Squad'; end if;
  if not exists (
    select 1 from public.buklod_user_follows f
    where f.follower_id=actor and f.followed_user_id=p_target_user_id
  ) then raise exception 'Follow this member first before inviting them to your Squad'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=p_target_user_id and coalesce(p.is_active,false)=true
  ) then raise exception 'Member is not active'; end if;
  if exists (
    select 1 from public.igpat_arena_squad_members m
    where m.user_id=p_target_user_id and m.status='ACTIVE'
  ) then raise exception 'Member already belongs to an active Arena Squad'; end if;

  select count(*) into active_count
  from public.igpat_arena_squad_members m
  where m.squad_id=p_squad_id and m.status='ACTIVE';
  if active_count>=8 then raise exception 'Arena Squads are limited to 8 active members'; end if;

  insert into public.igpat_arena_squad_members(
    squad_id,user_id,status,invited_by,responded_at
  ) values(p_squad_id,p_target_user_id,'INVITED',actor,null)
  on conflict(squad_id,user_id) do update
    set status='INVITED',invited_by=actor,created_at=now(),responded_at=null
  where igpat_arena_squad_members.status<>'ACTIVE';
end;
$$;

create or replace function public.igpat_respond_squad_invite_v1(
  p_squad_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  active_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.igpat_arena_squad_members m
    where m.squad_id=p_squad_id and m.user_id=actor and m.status='INVITED'
  ) then raise exception 'Squad invitation is unavailable'; end if;

  if coalesce(p_accept,false) then
    if exists (
      select 1 from public.igpat_arena_squad_matches m
      where (m.challenger_squad_id=p_squad_id or m.opponent_squad_id=p_squad_id)
        and m.status in ('ACCEPTED','ACTIVE')
    ) then raise exception 'This Squad roster is locked until its accepted battle is finished'; end if;

    if exists (
      select 1 from public.igpat_arena_squad_members m
      where m.user_id=actor and m.status='ACTIVE'
    ) then raise exception 'Leave your current Arena Squad before accepting another'; end if;

    select count(*) into active_count
    from public.igpat_arena_squad_members m
    where m.squad_id=p_squad_id and m.status='ACTIVE';
    if active_count>=8 then raise exception 'This Arena Squad is already full'; end if;

    update public.igpat_arena_squad_members
    set status='ACTIVE',responded_at=now()
    where squad_id=p_squad_id and user_id=actor and status='INVITED';
  else
    update public.igpat_arena_squad_members
    set status='DECLINED',responded_at=now()
    where squad_id=p_squad_id and user_id=actor and status='INVITED';
  end if;
end;
$$;

create or replace function public.igpat_leave_squad_v1(p_squad_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  captain uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select s.captain_user_id into captain
  from public.igpat_arena_squads s
  where s.id=p_squad_id and s.status='ACTIVE';
  if captain is null then raise exception 'Squad is unavailable'; end if;

  if exists (
    select 1 from public.igpat_arena_squad_matches m
    where (m.challenger_squad_id=p_squad_id or m.opponent_squad_id=p_squad_id)
      and m.status in ('ACCEPTED','ACTIVE')
  ) then raise exception 'Squad roster is locked until the accepted battle is finished'; end if;

  if captain=actor then
    if exists (
      select 1 from public.igpat_arena_squad_matches m
      where (m.challenger_squad_id=p_squad_id or m.opponent_squad_id=p_squad_id)
        and m.status='OPEN'
    ) then raise exception 'Cancel or decline open Squad challenges before archiving the Squad'; end if;

    update public.igpat_arena_squads
    set status='ARCHIVED',updated_at=now()
    where id=p_squad_id;
    update public.igpat_arena_squad_members
    set status='LEFT',responded_at=now()
    where squad_id=p_squad_id and status in ('ACTIVE','INVITED');
  else
    -- OPEN is still the consent window, so a member may withdraw before acceptance.
    update public.igpat_arena_squad_members
    set status='LEFT',responded_at=now()
    where squad_id=p_squad_id and user_id=actor and status='ACTIVE';
    if not found then raise exception 'You are not an active member of this Squad'; end if;
  end if;
end;
$$;

revoke all on function public.igpat_create_squad_match_v1(uuid,uuid) from public,anon;
grant execute on function public.igpat_create_squad_match_v1(uuid,uuid) to authenticated,service_role;
revoke all on function public.igpat_respond_squad_match_v1(uuid,boolean) from public,anon;
grant execute on function public.igpat_respond_squad_match_v1(uuid,boolean) to authenticated,service_role;
revoke all on function public.igpat_cancel_squad_match_v1(uuid) from public,anon;
grant execute on function public.igpat_cancel_squad_match_v1(uuid) to authenticated,service_role;
revoke all on function public.igpat_invite_squad_member_v1(uuid,uuid) from public,anon;
grant execute on function public.igpat_invite_squad_member_v1(uuid,uuid) to authenticated,service_role;
revoke all on function public.igpat_respond_squad_invite_v1(uuid,boolean) from public,anon;
grant execute on function public.igpat_respond_squad_invite_v1(uuid,boolean) to authenticated,service_role;
revoke all on function public.igpat_leave_squad_v1(uuid) from public,anon;
grant execute on function public.igpat_leave_squad_v1(uuid) to authenticated,service_role;
