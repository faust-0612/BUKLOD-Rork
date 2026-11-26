-- DEV candidate only, after ledger/scheduler drafts. Reconcile exact production
-- dispatcher body before promotion; no new trigger, cron, or notification stream.
begin;
do $guard$
begin
 if not exists(select 1 from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('private.buklod_living_dispatch_greetings_v1(integer)')
    and p.prosrc=$expected$
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
$expected$) then
   raise exception 'Living greeting dispatcher drift; reconcile deployed definition first';
 end if;
end
$guard$;
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
  v_rank_order integer;
  v_rank_name text;
  v_next_rank text;
  v_pending integer;
  v_rank_owner boolean:=false;
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
    order by case when v_event.kind='rank_up' and p.id=v_event.actor_id then 0 else 1 end,p.id
    limit greatest(1,least(coalesce(p_limit,100),100))
  loop
    insert into private.buklod_living_greeting_delivery_v1(event_id,recipient_id)
      values(v_event.id,v_recipient) on conflict do nothing;
    get diagnostics v_selected = row_count;
    if v_selected<>1 then continue;end if;
    v_title := v_event.title;
    v_body := v_event.body;
    v_route := v_event.route;
    v_rank_owner:=false;
    -- Personalize the existing rank notification, never add a second one.
    -- Scope peers retain their original congratulation route and message.
    if v_event.kind='rank_up' and v_recipient=v_event.actor_id
       and not private.buklod_is_platform_official_v1(v_recipient)
       and exists(select 1 from private.buklod_rank_bonus_scheduler_v1 where singleton and enabled) then
      select h.rank_order,h.rank_name into v_rank_order,v_rank_name
        from public.buklod_rank_history h where h.user_id=v_recipient
          and v_event.event_key='rank:'||h.id::text and h.trigger_ledger_id is not null
          and h.achievement_source<>'baseline';
      if found and v_rank_order between 1 and 40 then
        v_rank_owner:=true;
        v_title:=left('Congratulations! '||v_rank_name||' unlocked',140);
        v_route:='/points/progression';
        v_next_rank:=null;
        if v_rank_order<40 then
          v_next_rank:=(array['Circle Starter','Circle Active','Circle Steady','Circle Builder','Circle Impact','Circle Vanguard','BUKLOD Prime','BUKLOD Prime Elite'])[(v_rank_order/5)+1]
            ||' '||(array['V','IV','III','II','I'])[(v_rank_order%5)+1];
        end if;
        select count(*) into v_pending from public.buklod_rank_bonus_ledger_v1 b
          join private.buklod_rank_bonus_catalog_v1 c on c.bonus_key=b.bonus_key and c.enabled
          where b.user_id=v_recipient and b.redeemed_at is null and b.revoked_at is null and b.available_at<=now();
        v_body:=left('Your permanent rank is active. '||
          case when v_next_rank is not null then 'Next target: '||v_next_rank||'. ' else 'Highest rank achieved. ' end||
          case when v_pending>0 then v_pending::text||' optional collections await redemption. ' else '' end||
          'Open your rank roadmap to see available privileges.',450);
      end if;
    end if;
    if v_event.kind='birthday' and v_recipient<>v_event.actor_id then
      v_title := 'Birthday greetings sa BUKLOD!';
      v_body := 'May ka-BUKLOD kang may kaarawan. Padalhan siya ng pagbati!';
    end if;
    v_notification:=public.queue_notification(
      v_recipient,v_title,v_body,
      case when v_rank_owner then 'rank_visual_unlocked' when v_event.kind in ('holiday','kl_release')
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
commit;
