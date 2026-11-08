-- BUKLOD Living Interactions R2. Apply AFTER the already-applied 20261108025000 migration.
-- Additive upgrade, not historical migration replay. DEV ONLY; DO NOT AUTO APPLY.
-- Existing data, event IDs, delivery ledger, cron names and RLS retained.
alter table private.buklod_living_greeting_events_v1
 drop constraint buklod_living_greeting_events_v1_kind_check;
alter table private.buklod_living_greeting_events_v1
 add constraint buklod_living_greeting_events_v1_kind_check
 check (kind in ('cluster_welcome','birthday','holiday','kl_release','rank_up','character_reward'));

-- buklod_living_member_welcome_v1
create or replace function private.buklod_living_member_welcome_v1()
returns trigger language plpgsql security definer set search_path='' as $living$
declare
  v_scope_type text;
  v_scope_name text;
  v_name text;
begin
  if new.membership_status <> 'ACTIVE' or
    (tg_op='UPDATE' and old.membership_status='ACTIVE') then return new; end if;
  select s.scope_type,s.name into v_scope_type,v_scope_name from public.buklod_scopes s
  where s.id=new.scope_id and s.status='ACTIVE';
  if v_scope_type is null or v_scope_type not in ('CLUSTER','ORGANIZATION') then return new; end if;
  select coalesce(nullif(pg_catalog.btrim(p.full_name),''),'bagong miyembro')
    into v_name from public.profiles p where p.id=new.user_id;
  insert into private.buklod_living_greeting_events_v1
    (event_key,kind,actor_id,scope_id,title,body,route,expires_at)
  values (
    'membership:'||new.id::text,'cluster_welcome',new.user_id,new.scope_id,
    left('Welcome, '||coalesce(v_name,'bagong miyembro')||'!',140),
    left('Kasama na si '||coalesce(v_name,'bagong miyembro')||' sa '||
      coalesce(v_scope_name,'BUKLOD')||'. Batiin siya sa Community!',450),
    '/member/'||new.user_id::text,now()+interval '48 hours'
  ) on conflict(event_key) do nothing;
  return new;
end;
$living$;
revoke all on function private.buklod_living_member_welcome_v1() from public,anon,authenticated;

-- buklod_living_daily_greetings_v1
create or replace function private.buklod_living_daily_greetings_v1()
returns integer language plpgsql security definer set search_path='' as $living$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_stamp text := to_char(v_day,'YYYY-MM-DD');
  v_count integer := 0;
  v_added integer;
  v_holiday record;
  v_user record;
  v_story record;
begin
  -- One-time calendar greetings, with an admin-maintained holiday catalog.
  select h.* into v_holiday from private.buklod_living_greeting_holidays_v1 h
    where h.month_day=to_char(v_day,'MM-DD') and h.enabled;
  if found then
    insert into private.buklod_living_greeting_events_v1
      (event_key,kind,title,body,route,expires_at)
    values('holiday:'||v_stamp,'holiday',v_holiday.title,v_holiday.body,
      '/buklod',now()+interval '30 hours')
    on conflict(event_key) do nothing;
    get diagnostics v_added = row_count; v_count := v_count+v_added;
  end if;
  -- Birth dates are private: birthday event initially targets only that member.
  -- Followers/Cluster members are included ONLY if the member opts in.
  for v_user in select p.id from public.profiles p
    where p.is_active and p.birth_date is not null
      and extract(month from p.birth_date)=extract(month from v_day)
      and extract(day from p.birth_date)=extract(day from v_day)
  loop
    insert into private.buklod_living_greeting_events_v1
      (event_key,kind,actor_id,title,body,route,expires_at)
    values ('birthday:'||v_user.id::text||':'||v_stamp,'birthday',v_user.id,
      'Happy Birthday!','Binabati ka ng buong BUKLOD ngayong espesyal mong araw!',
      '/member/'||v_user.id::text,now()+interval '30 hours')
    on conflict(event_key) do nothing;
    get diagnostics v_added = row_count; v_count := v_count+v_added;
  end loop;
  -- Release gating requires both approved and released; do not notify drafts,
  -- scheduled-future episodes or historical releases from the first migration.
  for v_story in select k.id,k.title,k.season_number,k.episode_number from public.kl_episodes k
    where k.status='approved' and k.release_at <= now()
      and k.release_at >= now()-interval '48 hours'
  loop
    insert into private.buklod_living_greeting_events_v1
      (event_key,kind,title,body,route,expires_at)
    values ('kl_release:'||v_story.id::text,'kl_release',
      left(pg_catalog.format('Kabihasnang Ligaw — Series %s: Kabanata %s available na!',
        v_story.season_number,v_story.episode_number),140),
      left('Bagong release: '||v_story.title||'. Basahin na!',450),
      '/kabihasnang-ligaw',now()+interval '7 days')
    on conflict(event_key) do nothing;
    get diagnostics v_added = row_count; v_count := v_count+v_added;
  end loop;
  -- Bound history size; deletion cascades deliveries without touching notifications.
  delete from private.buklod_living_greeting_events_v1
    where created_at < now()-interval '120 days';
  return v_count;
end;
$living$;
revoke all on function private.buklod_living_daily_greetings_v1() from public,anon,authenticated;

-- buklod_living_kl_releases_v1
create or replace function private.buklod_living_kl_releases_v1()
returns integer language plpgsql security definer set search_path='' as $living$
declare v_count integer:=0;
declare v_added integer;
declare v_story record;
begin
  for v_story in
    select k.id,k.title,k.season_number,k.episode_number
    from public.kl_episodes k
    where k.status='approved' and k.release_at<=now()
      and k.release_at>=now()-interval '48 hours'
  loop
    insert into private.buklod_living_greeting_events_v1
      (event_key,kind,title,body,route,expires_at)
    values ('kl_release:'||v_story.id::text,'kl_release',
      left(pg_catalog.format('Kabihasnang Ligaw — Series %s: Kabanata %s available na!',
        v_story.season_number,v_story.episode_number),140),
      left('Bagong release: '||v_story.title||'. Basahin na!',450),
      '/kabihasnang-ligaw',now()+interval '7 days')
    on conflict(event_key) do nothing;
    get diagnostics v_added = row_count; v_count := v_count+v_added;
  end loop;
  return v_count;
end;
$living$;
revoke all on function private.buklod_living_kl_releases_v1() from public,anon,authenticated;

-- buklod_living_kl_release_trigger_v1
create or replace function private.buklod_living_kl_release_trigger_v1()
returns trigger language plpgsql security definer set search_path='' as $living$
begin
  if new.status<>'approved' or new.release_at is null
     or new.release_at > now() or new.release_at < now()-interval '48 hours'
  then return new; end if;
  if tg_op='UPDATE' and old.status=new.status and old.release_at is not distinct from new.release_at
  then return new; end if;
  insert into private.buklod_living_greeting_events_v1
    (event_key,kind,title,body,route,expires_at)
  values ('kl_release:'||new.id::text,'kl_release',
    left(pg_catalog.format('Kabihasnang Ligaw — Series %s: Kabanata %s available na!',
      new.season_number,new.episode_number),140),
    left('Bagong release: '||new.title||'. Basahin na!',450),
    '/kabihasnang-ligaw',now()+interval '7 days')
  on conflict(event_key) do nothing;
  return new;
end;
$living$;
revoke all on function private.buklod_living_kl_release_trigger_v1() from public,anon,authenticated;

-- buklod_living_rank_milestone_v1
create or replace function private.buklod_living_rank_milestone_v1()
returns trigger language plpgsql security definer set search_path='' as $living$
declare v_name text;
begin
  if new.trigger_ledger_id is null or new.achievement_source='baseline'
  then return new; end if;
  select coalesce(nullif(pg_catalog.btrim(p.full_name),''),'ka-BUKLOD')
    into v_name from public.profiles p where p.id=new.user_id;
  insert into private.buklod_living_greeting_events_v1
    (event_key,kind,actor_id,title,body,route,expires_at)
  values ('rank:'||new.id::text,'rank_up',new.user_id,
    left('Rank unlocked: '||new.rank_name,140),
    left(coalesce(v_name,'Ka-BUKLOD')||' reached '||new.rank_name||'. Congratulate them!',450),
    '/member/'||new.user_id::text,now()+interval '7 days')
  on conflict(event_key) do nothing;
  return new;
end;
$living$;
revoke all on function private.buklod_living_rank_milestone_v1() from public,anon,authenticated;
drop trigger if exists buklod_living_rank_milestone_v1 on public.buklod_rank_history;
create trigger buklod_living_rank_milestone_v1 after insert on public.buklod_rank_history
for each row execute function private.buklod_living_rank_milestone_v1();

-- buklod_living_character_reward_v1
create or replace function private.buklod_living_character_reward_v1()
returns trigger language plpgsql security definer set search_path='' as $living$
declare v_name text;
declare v_reward text;
begin
  if new.discovered_at is null or new.discovered_at < now()-interval '48 hours'
  then return new; end if;
  if tg_op='UPDATE' and old.discovered_at is not distinct from new.discovered_at
  then return new; end if;
  select coalesce(nullif(pg_catalog.btrim(p.full_name),''),'ka-BUKLOD')
    into v_name from public.profiles p where p.id=new.user_id;
  v_reward:=case when new.reward_kind='title_badge' then 'character badge'
    when new.reward_kind='profile_frame' then 'profile frame'
    when new.reward_kind='visual_effect' then 'character effect'
    when new.reward_kind='expression' then 'character expression'
    else 'character reward' end;
  insert into private.buklod_living_greeting_events_v1
    (event_key,kind,actor_id,title,body,route,expires_at)
  values ('character-reward:'||new.user_id::text||':'||new.collectible_id,
    'character_reward',new.user_id,
    left('Character reward unlocked!',140),
    left(coalesce(v_name,'Ka-BUKLOD')||' unlocked a new '||v_reward||'. Say congrats!',450),
    '/member/'||new.user_id::text,now()+interval '7 days')
  on conflict(event_key) do nothing;
  return new;
end;
$living$;
revoke all on function private.buklod_living_character_reward_v1() from public,anon,authenticated;
drop trigger if exists buklod_living_character_reward_v1 on public.buklod_character_collectible_state;
create trigger buklod_living_character_reward_v1
after insert or update of discovered_at on public.buklod_character_collectible_state
for each row execute function private.buklod_living_character_reward_v1();

-- buklod_living_dispatch_greetings_v1
create or replace function private.buklod_living_dispatch_greetings_v1(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $living$
declare
  v_event private.buklod_living_greeting_events_v1%rowtype;
  v_recipient uuid;
  v_selected integer:=0;
  v_sent integer:=0;
  v_notification uuid;
  v_title text;
  v_body text;
  v_route text;
begin
  -- A single serialized worker caps push traffic. Transaction rolls back on
  -- any delivery error so the same recipient can be retried safely.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('buklod:living:dispatch:v1',0)) then
    return 0;
  end if;
  select * into v_event from private.buklod_living_greeting_events_v1
    where completed_at is null order by created_at,id limit 1 for update skip locked;
  if not found then return 0; end if;
  if v_event.expires_at <= now() then
    update private.buklod_living_greeting_events_v1
      set completed_at=now() where id=v_event.id;
    return 0;
  end if;
  for v_recipient in
    select p.id from public.profiles p
    where p.is_active
      and (p.is_verified or (v_event.kind='birthday' and p.id=v_event.actor_id))
      and not exists (select 1 from private.buklod_living_greeting_delivery_v1 d
        where d.event_id=v_event.id and d.recipient_id=p.id)
      and (
        v_event.kind in ('holiday','kl_release')
        or (
          v_event.kind in ('cluster_welcome','rank_up','character_reward')
          and (p.id=v_event.actor_id or (p.id <> v_event.actor_id and (
            exists (select 1 from public.buklod_scope_memberships ms
              where ms.user_id=p.id and ms.scope_id=v_event.scope_id
                and ms.membership_status='ACTIVE')
            or exists (select 1 from public.buklod_user_follows f
              where f.follower_id=p.id and f.followed_user_id=v_event.actor_id)
            or (v_event.kind in ('rank_up','character_reward') and exists (
              select 1 from public.buklod_scope_memberships own
              join public.buklod_scope_memberships peer on peer.scope_id=own.scope_id
              join public.buklod_scopes s on s.id=own.scope_id
              where own.user_id=v_event.actor_id and own.membership_status='ACTIVE'
                and peer.user_id=p.id and peer.membership_status='ACTIVE'
                and s.status='ACTIVE' and s.scope_type in ('CLUSTER','ORGANIZATION')
            ))
          )))
        )
        or (
          v_event.kind='birthday' and (
            p.id=v_event.actor_id
            or (
              exists (select 1 from public.buklod_living_greeting_preferences_v1 gp
                where gp.user_id=v_event.actor_id and gp.share_birthday)
              and (
                exists (select 1 from public.buklod_user_follows f
                  where f.follower_id=p.id and f.followed_user_id=v_event.actor_id)
                or exists (
                  select 1 from public.buklod_scope_memberships m1
                  join public.buklod_scope_memberships m2 on m2.scope_id=m1.scope_id
                  join public.buklod_scopes s on s.id=m1.scope_id
                  where m1.user_id=p.id and m1.membership_status='ACTIVE'
                    and m2.user_id=v_event.actor_id and m2.membership_status='ACTIVE'
                    and s.scope_type='CLUSTER' and s.status='ACTIVE'
                )
              )
            )
          )
        )
      )
    order by p.id
    limit greatest(1,least(coalesce(p_limit,100),100))
  loop
    insert into private.buklod_living_greeting_delivery_v1(event_id,recipient_id)
      values(v_event.id,v_recipient) on conflict do nothing;
    get diagnostics v_selected = row_count;
    if v_selected<>1 then continue;end if;
    v_title := v_event.title;
    v_body := v_event.body;
    v_route := v_event.route;
    if v_event.kind='birthday' and v_recipient<>v_event.actor_id then
      v_title := 'Birthday greetings sa BUKLOD!';
      v_body := 'May ka-BUKLOD kang may kaarawan. Padalhan siya ng pagbati!';
    end if;
    v_notification:=public.queue_notification(
      v_recipient,v_title,v_body,
      case when v_event.kind in ('holiday','kl_release')
        then 'announcement_'||v_event.kind else 'community_'||v_event.kind end,
      pg_catalog.jsonb_build_object(
        'route',v_route,'event_id',v_event.id,'scope_id',v_event.scope_id,
        'actor_id',v_event.actor_id,'source','buklod_living_greetings_v1'
      )
    );
    v_sent:=v_sent+1;
  end loop;
  if v_sent < greatest(1,least(coalesce(p_limit,100),100)) then
    update private.buklod_living_greeting_events_v1
      set completed_at=now() where id=v_event.id;
  end if;
  return v_sent;
end;
$living$;
revoke all on function private.buklod_living_dispatch_greetings_v1(integer) from public,anon,authenticated;

-- buklod_my_living_greetings_v1
create or replace function public.buklod_my_living_greetings_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $living$
declare
  v_user uuid:=(select auth.uid());
  v_today date:=(now() at time zone 'Asia/Manila')::date;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select pg_catalog.jsonb_build_object(
    'new_member_count', (select count(*) from public.profiles p
      where p.is_active and p.is_verified and coalesce(p.verified_at,p.created_at) >= now()-interval '24 hours'),
    'latest_kl_title', (select pg_catalog.format(
      'Kabihasnang Ligaw — Series %s: Kabanata %s available na!',
      k.season_number,k.episode_number) from public.kl_episodes k
      where k.status='approved' and k.release_at<=now()
        and k.release_at>=now()-interval '7 days'
      order by k.release_at desc limit 1),
    'my_recent_rank', (select r.rank_name from public.buklod_rank_history r
      where r.user_id=v_user and r.achievement_source<>'baseline'
        and r.achieved_at >= now()-interval '7 days'
      order by r.achieved_at desc limit 1),
    'my_recent_reward', (select
      case when c.reward_kind='title_badge' then 'bagong character badge'
           when c.reward_kind='profile_frame' then 'bagong profile frame'
           when c.reward_kind='visual_effect' then 'bagong character effect'
           else 'bagong character item' end
      from public.buklod_character_collectible_state c
      where c.user_id=v_user and c.discovered_at >= now()-interval '7 days'
      order by c.discovered_at desc limit 1),
    'holiday_title', (select h.title from private.buklod_living_greeting_holidays_v1 h
      where h.enabled and h.month_day=to_char(v_today,'MM-DD') limit 1),
    'my_birthday', (select exists(select 1 from public.profiles p where p.id=v_user
      and p.birth_date is not null
      and extract(month from p.birth_date)=extract(month from v_today)
      and extract(day from p.birth_date)=extract(day from v_today))),
    'share_birthday', (select coalesce((select gp.share_birthday
      from public.buklod_living_greeting_preferences_v1 gp where gp.user_id=v_user),false))
  ) into v_result;
  return v_result;
end;
$living$;
revoke all on function public.buklod_my_living_greetings_v1() from public,anon;
grant execute on function public.buklod_my_living_greetings_v1() to authenticated;

-- Keep the already scheduled daily and delivery jobs unchanged.
-- This new source-only job promptly announces an approved KL chapter which
-- first becomes available after midnight (deduplicated by episode ID).
select cron.schedule(
 'buklod-living-greetings-kl-releases-v1','*/5 * * * *',
 'select private.buklod_living_kl_releases_v1()'
);
