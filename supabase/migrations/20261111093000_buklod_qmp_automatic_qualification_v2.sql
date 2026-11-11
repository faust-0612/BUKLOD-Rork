-- BUKLOD QMP R2: deterministic qualification, no manual finance review.
-- Existing BASE/bonus amounts, period rule versions, caps, Finance V3 month
-- close and cash activation switches are preserved. Do not settle cash here.
-- This migration reconciles only OPEN QMP periods; finalized weights are immutable.

CREATE OR REPLACE FUNCTION private.buklod_community_qmp_record_event_v1(p_user_id uuid, p_content_id uuid, p_source_event_key text, p_contribution_type text, p_base_qmp bigint, p_bonus_qmp bigint, p_state text, p_qualification_state text, p_reason_code text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_existing uuid;
  v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions;
  v_state text:=upper(trim(coalesce(p_state,'PENDING')));
  v_qstate text:=upper(trim(coalesce(p_qualification_state,'PENDING')));
  v_base bigint:=greatest(coalesce(p_base_qmp,0),0);
  v_bonus bigint:=greatest(coalesce(p_bonus_qmp,0),0);
  v_monthly_cap bigint:=250;
  v_content_cap bigint:=25;
  v_velocity bigint:=30;
  v_used_month bigint:=0;
  v_used_content bigint:=0;
  v_recent bigint:=0;
  v_id uuid;
begin
  if p_user_id is null or trim(coalesce(p_source_event_key,''))='' then return null; end if;
  select id into v_existing from private.buklod_community_qmp_events where source_event_key=p_source_event_key;
  if v_existing is not null then return v_existing; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  if not coalesce((v_rule.config#>>'{activation,event_recording_enabled}')::boolean,false) then return null; end if;
  v_monthly_cap:=coalesce((v_rule.config#>>'{caps,monthly_bonus}')::bigint,250);
  v_content_cap:=coalesce((v_rule.config#>>'{caps,per_content_bonus}')::bigint,25);
  v_velocity:=coalesce((v_rule.config#>>'{caps,hourly_velocity_hold}')::bigint,30);
  -- Qualification is deterministic: no human approval queue. The activity
  -- itself remains available, but insufficient evidence never earns QMP.
  if v_state in ('PENDING','HELD') then
    v_state:='DISQUALIFIED';
    v_qstate:='DISQUALIFIED';
    p_reason_code:=case when upper(coalesce(p_state,''))='HELD'
      then 'AUTO_RATE_LIMIT_EXCLUDED' else 'AUTO_MINIMUM_NOT_MET' end;
  end if;
  if v_bonus>0 then
    select coalesce(sum(e.bonus_qmp),0)::bigint into v_used_month
    from private.buklod_community_qmp_events e
    where e.user_id=p_user_id and e.settlement_period_id=v_period.id and e.state in ('QUALIFIED','FINALIZED');
    v_bonus:=least(v_bonus,greatest(v_monthly_cap-v_used_month,0));
    if p_content_id is not null then
      select coalesce(sum(e.bonus_qmp),0)::bigint into v_used_content
      from private.buklod_community_qmp_events e
      where e.user_id=p_user_id and e.content_id=p_content_id and e.settlement_period_id=v_period.id
        and e.state in ('QUALIFIED','FINALIZED');
      v_bonus:=least(v_bonus,greatest(v_content_cap-v_used_content,0));
    end if;
  end if;
  if v_state='QUALIFIED' then
    select count(*)::bigint into v_recent from private.buklod_community_qmp_events e
    where e.user_id=p_user_id and e.created_at>=now()-interval '1 hour' and e.state in ('QUALIFIED','HELD');
    if v_recent>=v_velocity then
      v_state:='DISQUALIFIED'; v_qstate:='DISQUALIFIED'; p_reason_code:='AUTO_RATE_LIMIT_EXCLUDED';
    end if;
  end if;
  insert into private.buklod_community_qmp_events(
    user_id,content_id,source_event_key,contribution_type,base_qmp,bonus_qmp,total_qmp,
    settlement_period_id,rule_version,state,qualification_state,reason_code,metadata
  ) values(
    p_user_id,p_content_id,left(p_source_event_key,220),upper(left(p_contribution_type,80)),v_base,v_bonus,v_base+v_bonus,
    v_period.id,v_period.rule_version,v_state,v_qstate,left(p_reason_code,80),coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;
  insert into private.buklod_community_qmp_accounts(user_id,settlement_period_id,qualified_qmp,held_qmp,reversed_qmp,updated_at)
  values(p_user_id,v_period.id,
    case when v_state='QUALIFIED' then v_base+v_bonus else 0 end,
    case when v_state='HELD' then v_base+v_bonus else 0 end,0,now())
  on conflict(user_id,settlement_period_id) do update set
    qualified_qmp=private.buklod_community_qmp_accounts.qualified_qmp+
      case when v_state='QUALIFIED' then v_base+v_bonus else 0 end,
    held_qmp=private.buklod_community_qmp_accounts.held_qmp+
      case when v_state='HELD' then v_base+v_bonus else 0 end,
    updated_at=now();
  return v_id;
end;
$function$


-- A late photo attachment legitimately qualifies an otherwise short Wall post.
-- It does not double-credit an already qualified post or bypass velocity guards.
create or replace function private.buklod_community_qmp_photo_qualify_v1()
returns trigger language plpgsql security definer set search_path to ''
as $qmp_media$
declare
  v_post public.community_posts%rowtype;
  v_period private.buklod_community_settlement_periods%rowtype;
  v_rule private.buklod_community_qmp_rule_versions%rowtype;
  v_event_id uuid;
begin
  if nullif(trim(coalesce(new.media_path,'')),'') is null then return new; end if;
  select * into v_post from public.community_posts where id=new.post_id;
  if v_post.id is null or v_post.user_id is null or v_post.is_reel
     or v_post.is_hidden or v_post.deleted_at is not null then return new; end if;
  -- Must be the same month as the original post, not a new month reward.
  select * into v_period from private.buklod_community_settlement_periods
    where v_post.created_at>=starts_at and v_post.created_at<ends_at and status='OPEN'
    order by starts_at desc limit 1;
  if v_period.id is null then return new; end if;
  -- Recorder uses the current month; never credit an old post into a later month.
  if v_period.period_key <> to_char(timezone('Asia/Manila',now()),'YYYY-MM')
    then return new; end if;
  if not exists (
    select 1 from private.buklod_community_qmp_events e
    where e.source_event_key='post:'||v_post.id::text
      and e.user_id=v_post.user_id
      and e.settlement_period_id=v_period.id
      and (e.state='PENDING'
           or (e.state='DISQUALIFIED' and e.reason_code='AUTO_MINIMUM_NOT_MET'))
  ) then return new; end if;
  if exists (
    select 1 from private.buklod_community_qmp_events e
    where e.source_event_key='photo:'||v_post.id::text
  ) then return new; end if;
  select * into v_rule from private.buklod_community_qmp_rule_versions
    where rule_version=v_period.rule_version;
  v_event_id:=private.buklod_community_qmp_record_event_v1(
    v_post.user_id,v_post.id,'photo:'||v_post.id::text,
    'USEFUL_POST',coalesce((v_rule.config#>>'{base_qmp,useful_post}')::bigint,5),
    0,'QUALIFIED','QUALIFIED','PHOTO_SOURCE_VERIFIED',
    jsonb_build_object('source','community_post_media'));
  if v_event_id is not null and exists(
    select 1 from private.buklod_community_qmp_events
    where id=v_event_id and state='QUALIFIED'
  ) then
    perform private.buklod_community_qmp_progress_mission_v1(v_post.user_id,v_period.id,'USEFUL_POST');
  end if;
  return new;
end;
$qmp_media$;
revoke all on function private.buklod_community_qmp_photo_qualify_v1() from public,anon,authenticated;
drop trigger if exists buklod_community_qmp_photo_qualify on public.community_post_media;
create trigger buklod_community_qmp_photo_qualify
after insert or update of media_path on public.community_post_media
for each row execute function private.buklod_community_qmp_photo_qualify_v1();

-- Reconcile outstanding evidence once, without guessing or credits for short
-- no-media posts, short/duplicate/self comments, missing sources, or fast bursts.
-- Row locks + OPEN-period guard make this idempotent and prevent payout drift.
create or replace function private.buklod_community_qmp_auto_reconcile_open_v1()
returns jsonb language plpgsql security definer set search_path to ''
as $qmp_auto$
declare
  v_event record;
  v_eligible boolean;
  v_source_ok boolean;
  v_qualified bigint:=0;
  v_rejected bigint:=0;
  v_reason text;
  v_min integer;
  v_days integer;
begin
  for v_event in
    select e.*,rv.config as rule_config
    from private.buklod_community_qmp_events e
    join private.buklod_community_settlement_periods p
      on p.id=e.settlement_period_id and p.status='OPEN'
    join private.buklod_community_qmp_rule_versions rv
      on rv.rule_version=e.rule_version
    where e.state in ('PENDING','HELD')
    order by e.created_at,e.id
    for update of e
  loop
    v_eligible:=false;
    v_source_ok:=false;
    v_reason:='AUTO_MINIMUM_NOT_MET';
    if v_event.state='HELD' then
      v_reason:='AUTO_RATE_LIMIT_EXCLUDED';
    elsif v_event.contribution_type='USEFUL_POST' then
      v_min:=coalesce((v_event.rule_config#>>'{qualification,post_min_chars}')::integer,40);
      select true,
        (length(trim(coalesce(p.body,'')))>=v_min
         or nullif(trim(coalesce(p.media_path,'')),'') is not null
         or exists (select 1 from public.community_post_media m
                    where m.post_id=p.id and nullif(trim(coalesce(m.media_path,'')),'') is not null))
      into v_source_ok,v_eligible
      from public.community_posts p
      where p.id=v_event.content_id and p.user_id=v_event.user_id
        and not p.is_hidden and p.deleted_at is null and not p.is_reel;
    elsif v_event.contribution_type='MEANINGFUL_REPLY' then
      v_min:=coalesce((v_event.rule_config#>>'{qualification,reply_min_chars}')::integer,20);
      v_days:=coalesce((v_event.rule_config#>>'{qualification,duplicate_reply_days}')::integer,7);
      select true,
        (length(trim(coalesce(c.body,'')))>=v_min
         and c.user_id is distinct from p.user_id
         and p.user_id is not null
         and not exists (
           select 1 from public.comments d
           where d.user_id=c.user_id and d.id<>c.id
             and d.created_at<=c.created_at
             and d.created_at>=c.created_at-make_interval(days=>v_days)
             and lower(regexp_replace(trim(coalesce(d.body,'')),'\s+',' ','g'))
               =lower(regexp_replace(trim(coalesce(c.body,'')),'\s+',' ','g'))
         ))
      into v_source_ok,v_eligible
      from public.comments c
      join public.community_posts p on p.id=c.post_id
      where c.id=case when coalesce(v_event.metadata->>'comment_id','') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (v_event.metadata->>'comment_id')::uuid else null end
        and c.user_id=v_event.user_id and c.post_id=v_event.content_id
        and not c.is_hidden and c.deleted_at is null
        and not p.is_hidden and p.deleted_at is null;
    end if;
    v_source_ok:=coalesce(v_source_ok,false);
    v_eligible:=coalesce(v_eligible,false);
    if not v_source_ok and v_event.state<>'HELD' then
      v_reason:='AUTO_SOURCE_UNAVAILABLE';
    elsif v_eligible then
      v_reason:='AUTO_EVIDENCE_QUALIFIED';
    end if;
    update private.buklod_community_qmp_events
       set state=case when v_eligible then 'QUALIFIED' else 'DISQUALIFIED' end,
           qualification_state=case when v_eligible then 'QUALIFIED' else 'DISQUALIFIED' end,
           reason_code=v_reason,
           metadata=coalesce(metadata,'{}'::jsonb)
             ||jsonb_build_object('auto_decision_v2',true,'prior_reason',v_event.reason_code)
     where id=v_event.id;
    if v_event.state='HELD' then
      update private.buklod_community_qmp_accounts
         set held_qmp=greatest(held_qmp-v_event.total_qmp,0),updated_at=now()
       where user_id=v_event.user_id and settlement_period_id=v_event.settlement_period_id;
    end if;
    if v_eligible then
      insert into private.buklod_community_qmp_accounts(
        user_id,settlement_period_id,qualified_qmp,held_qmp,reversed_qmp,updated_at)
      values(v_event.user_id,v_event.settlement_period_id,v_event.total_qmp,0,0,now())
      on conflict(user_id,settlement_period_id) do update
        set qualified_qmp=private.buklod_community_qmp_accounts.qualified_qmp+excluded.qualified_qmp,
            updated_at=now();
      v_qualified:=v_qualified+1;
    else
      v_rejected:=v_rejected+1;
    end if;
    update private.buklod_community_qmp_review_requests
       set status=case when v_eligible then 'APPROVED' else 'REJECTED' end,
           reviewer_note='Automatically evaluated from verifiable activity and rules',
           reviewed_at=now()
     where event_id=v_event.id and status in ('REQUESTED','UNDER_REVIEW');
  end loop;
  return jsonb_build_object('qualified_events',v_qualified,'excluded_events',v_rejected);
end;
$qmp_auto$;
revoke all on function private.buklod_community_qmp_auto_reconcile_open_v1() from public,anon,authenticated;

-- Clear only unfinalized legacy reviews; preserve every completed month.
select private.buklod_community_qmp_auto_reconcile_open_v1();

-- Retire manual approval/request RPC access, retaining old audit records.
revoke execute on function public.admin_review_buklod_community_qmp_event_v1(uuid,boolean,text)
  from public,anon,authenticated;
revoke execute on function public.admin_list_buklod_qmp_month_review_queue_v1(text,integer)
  from public,anon,authenticated;
revoke execute on function public.request_my_buklod_community_qmp_review_v1(uuid,text)
  from public,anon,authenticated;
