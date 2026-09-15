-- BUKLOD IGPAT R39 — Last Man Standing voting fairness.
-- Outside Respect opens only after every active participant has submitted for the
-- current round, and a voter must be able to view every active round entry.
-- This prevents early-entry bias and one-sided voting against scoped/private media.

create or replace function public.igpat_vote_lms_v1(
  p_event_id uuid,
  p_participant_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  e public.igpat_arena_lms_events%rowtype;
  post_id uuid;
  active_count integer;
  entry_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select * into e
  from public.igpat_arena_lms_events x
  where x.id=p_event_id and x.status='ACTIVE';
  if e.id is null then raise exception 'Last Man Standing is unavailable for Respect'; end if;

  if exists (
    select 1 from public.igpat_arena_lms_participants p
    where p.event_id=p_event_id
      and p.user_id=actor
      and p.status in ('ACTIVE','ELIMINATED','CHAMPION')
  ) then raise exception 'Event participants cannot vote in their own elimination event'; end if;

  select count(*) into active_count
  from public.igpat_arena_lms_participants p
  where p.event_id=p_event_id and p.status='ACTIVE';

  select count(*) into entry_count
  from public.igpat_arena_lms_entries x
  where x.event_id=p_event_id
    and x.round_no=e.current_round
    and exists (
      select 1 from public.igpat_arena_lms_participants p
      where p.event_id=p_event_id and p.user_id=x.user_id and p.status='ACTIVE'
    );

  if active_count < 2 or entry_count <> active_count then
    raise exception 'Outside Respect opens only after every active participant submits this round';
  end if;

  if exists (
    select 1
    from public.igpat_arena_lms_entries x
    join public.igpat_arena_lms_participants p
      on p.event_id=x.event_id and p.user_id=x.user_id and p.status='ACTIVE'
    where x.event_id=p_event_id
      and x.round_no=e.current_round
      and not public.can_view_community_post_v2(x.post_id)
  ) then
    raise exception 'You must be able to view every active round entry before giving Respect';
  end if;

  select x.post_id into post_id
  from public.igpat_arena_lms_entries x
  join public.igpat_arena_lms_participants p
    on p.event_id=x.event_id and p.user_id=x.user_id and p.status='ACTIVE'
  where x.event_id=p_event_id
    and x.round_no=e.current_round
    and x.user_id=p_participant_user_id;

  if post_id is null or not public.can_view_community_post_v2(post_id) then
    raise exception 'Round entry is unavailable to this account';
  end if;

  insert into public.igpat_arena_lms_votes(
    event_id,round_no,voter_user_id,participant_user_id
  ) values(p_event_id,e.current_round,actor,p_participant_user_id)
  on conflict(event_id,round_no,voter_user_id) do update
    set participant_user_id=excluded.participant_user_id,
        created_at=now();

  update public.igpat_arena_lms_entries x
  set respect_received=(
    select count(*)
    from public.igpat_arena_lms_votes v
    where v.event_id=p_event_id
      and v.round_no=e.current_round
      and v.participant_user_id=x.user_id
  )
  where x.event_id=p_event_id and x.round_no=e.current_round;
end;
$$;

revoke all on function public.igpat_vote_lms_v1(uuid,uuid) from public,anon;
grant execute on function public.igpat_vote_lms_v1(uuid,uuid) to authenticated,service_role;
