-- BUKLOD Community Wall Contribution Economy R1
-- QMP is monthly contribution weight, never a peso conversion.
-- Additive, forward-only, server-authoritative.
-- BUKLOD_COMMUNITY_QMP_ECONOMY_R1

create schema if not exists private;

create table if not exists private.buklod_community_qmp_rule_versions (
  rule_version text primary key,
  status text not null check (status in ('STAGED','ACTIVE','RETIRED')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  config jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists buklod_community_qmp_one_active_rule_idx
  on private.buklod_community_qmp_rule_versions ((1)) where status='ACTIVE';

insert into private.buklod_community_qmp_rule_versions(rule_version,status,effective_from,config,reason)
select 'community_qmp_v1','ACTIVE',now(),
  jsonb_build_object(
    'pool_bps',3000,
    'activation',jsonb_build_object(
      'event_recording_enabled',true,
      'estimate_enabled',true,
      'financial_finalization_enabled',false,
      'boost_enabled',false,
      'premium_creator_enabled',false
    ),
    'base_qmp',jsonb_build_object('useful_post',5,'qualified_video',10,'meaningful_reply',3),
    'engagement_bonus',jsonb_build_object('unique_reaction',1,'internal_share',2),
    'caps',jsonb_build_object('per_content_bonus',25,'monthly_bonus',250,'hourly_velocity_hold',30),
    'video',jsonb_build_object(
      'max_bytes',1073741824,
      'max_duration_seconds',1800,
      'monthly_allowance_bytes',5368709120
    ),
    'qualification',jsonb_build_object('post_min_chars',40,'reply_min_chars',20,'duplicate_reply_days',7),
    'target_margin',jsonb_build_object('min_bps',4000,'max_bps',5000)
  ),
  'Initial versioned defaults. QMP values and monthly quota are centrally configurable; UI must not hard-code them.'
where not exists (
  select 1 from private.buklod_community_qmp_rule_versions where rule_version='community_qmp_v1'
);

create table if not exists private.buklod_community_settlement_periods (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'OPEN'
    check (status in ('OPEN','QUALIFYING','RECONCILING','REVIEW','FINALIZED','PAYABLE','PAID','LOCKED')),
  rule_version text not null references private.buklod_community_qmp_rule_versions(rule_version),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists private.buklod_community_qmp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid references public.community_posts(id) on delete set null,
  source_event_key text not null unique,
  contribution_type text not null,
  base_qmp bigint not null default 0 check (base_qmp >= 0),
  bonus_qmp bigint not null default 0 check (bonus_qmp >= 0),
  total_qmp bigint not null default 0 check (total_qmp >= 0),
  settlement_period_id uuid not null references private.buklod_community_settlement_periods(id) on delete restrict,
  rule_version text not null references private.buklod_community_qmp_rule_versions(rule_version),
  state text not null check (state in ('PENDING','QUALIFIED','HELD','DISQUALIFIED','REVERSED','FINALIZED')),
  qualification_state text not null check (qualification_state in ('PENDING','QUALIFIED','PARTIALLY_QUALIFIED','DISQUALIFIED','UNDER_REVIEW')),
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index if not exists buklod_community_qmp_events_user_period_idx
  on private.buklod_community_qmp_events(user_id,settlement_period_id,created_at desc);
create index if not exists buklod_community_qmp_events_content_idx
  on private.buklod_community_qmp_events(content_id,created_at desc) where content_id is not null;
create index if not exists buklod_community_qmp_events_state_idx
  on private.buklod_community_qmp_events(settlement_period_id,state,created_at desc);

create table if not exists private.buklod_community_qmp_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_period_id uuid not null references private.buklod_community_settlement_periods(id) on delete restrict,
  qualified_qmp bigint not null default 0 check (qualified_qmp >= 0),
  held_qmp bigint not null default 0 check (held_qmp >= 0),
  reversed_qmp bigint not null default 0 check (reversed_qmp >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,settlement_period_id)
);
create index if not exists buklod_community_qmp_accounts_period_idx
  on private.buklod_community_qmp_accounts(settlement_period_id,qualified_qmp desc);

create table if not exists private.buklod_community_qmp_levels (
  level_code text not null,
  label text not null,
  min_qmp bigint not null check (min_qmp >= 0),
  max_qmp bigint,
  rule_version text not null references private.buklod_community_qmp_rule_versions(rule_version),
  enabled boolean not null default true,
  primary key(level_code,rule_version)
);
insert into private.buklod_community_qmp_levels(level_code,label,min_qmp,max_qmp,rule_version) values
 ('STARTER','STARTER',0,24,'community_qmp_v1'),
 ('ACTIVE','ACTIVE',25,74,'community_qmp_v1'),
 ('CONTRIBUTOR','CONTRIBUTOR',75,149,'community_qmp_v1'),
 ('BUILDER','BUILDER',150,299,'community_qmp_v1'),
 ('COMMUNITY_CHAMPION','COMMUNITY CHAMPION',300,null,'community_qmp_v1')
on conflict(level_code,rule_version) do nothing;

create table if not exists private.buklod_community_qmp_missions (
  mission_id uuid primary key default gen_random_uuid(),
  mission_code text not null,
  title text not null,
  description text not null,
  requirements jsonb not null,
  reward_qmp bigint not null default 0 check (reward_qmp >= 0),
  rule_version text not null references private.buklod_community_qmp_rule_versions(rule_version),
  enabled boolean not null default true,
  unique(mission_code,rule_version)
);
insert into private.buklod_community_qmp_missions(mission_code,title,description,requirements,reward_qmp,rule_version) values
 ('HELPFUL_VOICE','HELPFUL VOICE','Contribute meaningful approved replies.',jsonb_build_object('event_type','MEANINGFUL_REPLY','target_count',5),10,'community_qmp_v1'),
 ('COMMUNITY_CREATOR','COMMUNITY CREATOR','Publish useful original Community posts.',jsonb_build_object('event_type','USEFUL_POST','target_count',3),15,'community_qmp_v1'),
 ('VIDEO_STORYTELLER','VIDEO STORYTELLER','Publish a qualified original Wall video.',jsonb_build_object('event_type','QUALIFIED_VIDEO','target_count',1),15,'community_qmp_v1'),
 ('COMMUNITY_BUILDER','COMMUNITY BUILDER','Maintain useful Community activity across multiple days.',jsonb_build_object('event_type','ACTIVE_DAY','target_count',3),20,'community_qmp_v1')
on conflict(mission_code,rule_version) do nothing;

create table if not exists private.buklod_community_qmp_mission_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_period_id uuid not null references private.buklod_community_settlement_periods(id) on delete restrict,
  mission_id uuid not null references private.buklod_community_qmp_missions(mission_id) on delete restrict,
  progress_count integer not null default 0 check (progress_count >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','QUALIFIED','REWARDED')),
  qualified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id,settlement_period_id,mission_id)
);

create table if not exists private.buklod_community_qmp_active_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_period_id uuid not null references private.buklod_community_settlement_periods(id) on delete restrict,
  activity_date date not null,
  created_at timestamptz not null default now(),
  primary key(user_id,settlement_period_id,activity_date)
);

create table if not exists private.buklod_community_qmp_review_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.buklod_community_qmp_events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','CLOSED')),
  user_note text,
  reviewer_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(event_id,user_id)
);

create table if not exists private.buklod_community_user_pool_periods (
  id uuid primary key default gen_random_uuid(),
  settlement_period_id uuid not null unique references private.buklod_community_settlement_periods(id) on delete restrict,
  r38_period_id uuid references private.buklod_r38_economic_periods(id) on delete restrict,
  designated_revenue_minor bigint not null default 0 check (designated_revenue_minor >= 0),
  pool_percentage_bps integer not null default 3000 check (pool_percentage_bps between 0 and 10000),
  user_pool_minor bigint not null default 0 check (user_pool_minor >= 0),
  total_qualified_qmp bigint not null default 0 check (total_qualified_qmp >= 0),
  status text not null default 'FINALIZED' check (status in ('FINALIZED','PAYABLE','PAID','LOCKED')),
  rule_version text not null references private.buklod_community_qmp_rule_versions(rule_version),
  rounding_residue_minor bigint not null default 0,
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.buklod_community_user_share_allocations (
  id uuid primary key default gen_random_uuid(),
  pool_period_id uuid not null references private.buklod_community_user_pool_periods(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  qualified_qmp bigint not null check (qualified_qmp >= 0),
  total_period_qmp bigint not null check (total_period_qmp >= 0),
  share_weight numeric not null check (share_weight >= 0 and share_weight <= 1),
  amount_minor bigint not null check (amount_minor >= 0),
  status text not null default 'FINALIZED' check (status in ('FINALIZED','PAYABLE','PAID','LOCKED','ADJUSTED')),
  rule_version text not null,
  idempotency_key text not null unique,
  finalized_at timestamptz not null default now(),
  unique(pool_period_id,user_id)
);
create index if not exists buklod_community_user_share_user_idx
  on private.buklod_community_user_share_allocations(user_id,finalized_at desc);

create table if not exists private.buklod_community_economy_analytics (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on all tables in schema private from public,anon,authenticated;

create or replace function private.buklod_community_qmp_active_rule_v1()
returns private.buklod_community_qmp_rule_versions
language sql stable security definer set search_path=''
as $$
  select r from private.buklod_community_qmp_rule_versions r
  where r.status='ACTIVE' and r.effective_from<=now()
    and (r.effective_to is null or r.effective_to>now())
  order by r.effective_from desc limit 1;
$$;
revoke all on function private.buklod_community_qmp_active_rule_v1() from public,anon,authenticated;

create or replace function private.buklod_community_qmp_ensure_period_v1()
returns private.buklod_community_settlement_periods
language plpgsql security definer set search_path=''
as $$
declare
  v_rule private.buklod_community_qmp_rule_versions;
  v_month timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_key text;
  v_period private.buklod_community_settlement_periods;
begin
  select * into v_rule from private.buklod_community_qmp_active_rule_v1();
  if v_rule.rule_version is null then raise exception 'No active Community QMP rule version'; end if;
  v_month:=date_trunc('month',timezone('Asia/Manila',now()));
  v_start:=v_month at time zone 'Asia/Manila';
  v_end:=(v_month+interval '1 month') at time zone 'Asia/Manila';
  v_key:=to_char(v_month,'YYYY-MM');
  insert into private.buklod_community_settlement_periods(period_key,starts_at,ends_at,status,rule_version)
  values(v_key,v_start,v_end,'OPEN',v_rule.rule_version) on conflict(period_key) do nothing;
  select * into v_period from private.buklod_community_settlement_periods where period_key=v_key;
  return v_period;
end;
$$;
revoke all on function private.buklod_community_qmp_ensure_period_v1() from public,anon,authenticated;

create or replace function private.buklod_community_qmp_record_event_v1(
  p_user_id uuid,p_content_id uuid,p_source_event_key text,p_contribution_type text,
  p_base_qmp bigint,p_bonus_qmp bigint,p_state text,p_qualification_state text,
  p_reason_code text default null,p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
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
      v_state:='HELD'; v_qstate:='UNDER_REVIEW'; p_reason_code:=coalesce(p_reason_code,'VELOCITY_REVIEW');
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
$$;
revoke all on function private.buklod_community_qmp_record_event_v1(uuid,uuid,text,text,bigint,bigint,text,text,text,jsonb)
  from public,anon,authenticated;

create or replace function private.buklod_community_qmp_progress_mission_v1(p_user_id uuid,p_period_id uuid,p_event_type text)
returns void language plpgsql security definer set search_path=''
as $$
declare m record; v_target integer; v_next integer;
begin
  for m in select * from private.buklod_community_qmp_missions
    where enabled and rule_version=(select rule_version from private.buklod_community_settlement_periods where id=p_period_id)
      and upper(requirements->>'event_type')=upper(p_event_type)
  loop
    v_target:=greatest(coalesce((m.requirements->>'target_count')::integer,1),1);
    insert into private.buklod_community_qmp_mission_progress(user_id,settlement_period_id,mission_id,progress_count,status,updated_at)
    values(p_user_id,p_period_id,m.mission_id,1,'ACTIVE',now())
    on conflict(user_id,settlement_period_id,mission_id) do update
      set progress_count=private.buklod_community_qmp_mission_progress.progress_count+1,updated_at=now()
    returning progress_count into v_next;
    if v_next>=v_target then
      update private.buklod_community_qmp_mission_progress
      set status='QUALIFIED',qualified_at=coalesce(qualified_at,now()),updated_at=now()
      where user_id=p_user_id and settlement_period_id=p_period_id and mission_id=m.mission_id and status='ACTIVE';
      if found then
        perform private.buklod_community_qmp_record_event_v1(
          p_user_id,null,'mission:'||p_period_id::text||':'||m.mission_id::text||':'||p_user_id::text,
          'MISSION_REWARD',0,m.reward_qmp,'QUALIFIED','QUALIFIED','MISSION_COMPLETED',jsonb_build_object('mission_code',m.mission_code));
        update private.buklod_community_qmp_mission_progress set status='REWARDED',updated_at=now()
        where user_id=p_user_id and settlement_period_id=p_period_id and mission_id=m.mission_id;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function private.buklod_community_qmp_progress_mission_v1(uuid,uuid,text) from public,anon,authenticated;

create or replace function private.buklod_community_qmp_mark_active_day_v1(p_user_id uuid,p_period_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_date date:=timezone('Asia/Manila',now())::date;
begin
  insert into private.buklod_community_qmp_active_days(user_id,settlement_period_id,activity_date)
  values(p_user_id,p_period_id,v_date) on conflict do nothing;
  if found then perform private.buklod_community_qmp_progress_mission_v1(p_user_id,p_period_id,'ACTIVE_DAY'); end if;
end;
$$;
revoke all on function private.buklod_community_qmp_mark_active_day_v1(uuid,uuid) from public,anon,authenticated;

create or replace function private.buklod_community_qmp_video_quota_v1(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions;
  v_allowance bigint:=5368709120; v_used bigint:=0; v_count bigint:=0;
begin
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_allowance:=coalesce((v_rule.config#>>'{video,monthly_allowance_bytes}')::bigint,5368709120);
  select coalesce(sum(coalesce(p.media_size_bytes,0)),0)::bigint,count(*)::bigint into v_used,v_count
  from public.community_posts p
  where p.user_id=p_user_id and p.created_at>=v_period.starts_at and p.created_at<v_period.ends_at
    and p.deleted_at is null and p.is_reel=false and lower(coalesce(p.media_mime_type,'')) like 'video/%';
  return jsonb_build_object('period_key',v_period.period_key,'allowance_bytes',v_allowance,'used_bytes',v_used,
    'remaining_bytes',greatest(v_allowance-v_used,0),'uploaded_videos',v_count,'reset_at',v_period.ends_at);
end;
$$;
revoke all on function private.buklod_community_qmp_video_quota_v1(uuid) from public,anon,authenticated;

create or replace function private.buklod_community_qmp_before_post_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions;
  v_max_bytes bigint:=1073741824; v_max_duration numeric:=1800; v_quota jsonb; v_size bigint:=coalesce(new.media_size_bytes,0);
begin
  if new.is_reel=false and lower(coalesce(new.media_mime_type,'')) like 'video/%' then
    v_period:=private.buklod_community_qmp_ensure_period_v1();
    select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
    v_max_bytes:=coalesce((v_rule.config#>>'{video,max_bytes}')::bigint,1073741824);
    v_max_duration:=coalesce((v_rule.config#>>'{video,max_duration_seconds}')::numeric,1800);
    if v_size>v_max_bytes then raise exception 'Wall video exceeds the per-video size limit'; end if;
    if coalesce(new.media_duration_seconds,0)>v_max_duration then raise exception 'Wall video exceeds the per-video duration limit'; end if;
    if new.user_id is not null then
      v_quota:=private.buklod_community_qmp_video_quota_v1(new.user_id);
      if coalesce((v_quota->>'used_bytes')::bigint,0)+v_size>coalesce((v_quota->>'allowance_bytes')::bigint,0) then
        raise exception 'Monthly Community Wall video allowance exceeded';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.buklod_community_qmp_before_post_v1() from public,anon,authenticated;
drop trigger if exists buklod_community_qmp_before_post on public.community_posts;
create trigger buklod_community_qmp_before_post before insert on public.community_posts
for each row execute function private.buklod_community_qmp_before_post_v1();

create or replace function private.buklod_community_qmp_after_post_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions;
  v_min integer:=40; v_post bigint:=5; v_video bigint:=10; v_is_video boolean;
begin
  if new.user_id is null or new.is_reel=true or new.is_hidden or new.deleted_at is not null then return new; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_min:=coalesce((v_rule.config#>>'{qualification,post_min_chars}')::integer,40);
  v_post:=coalesce((v_rule.config#>>'{base_qmp,useful_post}')::bigint,5);
  v_video:=coalesce((v_rule.config#>>'{base_qmp,qualified_video}')::bigint,10);
  v_is_video:=lower(coalesce(new.media_mime_type,'')) like 'video/%';
  if v_is_video then
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'QUALIFIED_VIDEO',
      v_video,0,'QUALIFIED','QUALIFIED','VIDEO_BASE',jsonb_build_object('audience',new.audience));
    perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'QUALIFIED_VIDEO');
  elsif length(trim(coalesce(new.body,'')))>=v_min or new.media_path is not null then
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'USEFUL_POST',
      v_post,0,'QUALIFIED','QUALIFIED','POST_BASE',jsonb_build_object('audience',new.audience));
    perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'USEFUL_POST');
  else
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'USEFUL_POST',
      v_post,0,'PENDING','PENDING','MINIMUM_SUBSTANCE_REVIEW',jsonb_build_object('audience',new.audience));
  end if;
  perform private.buklod_community_qmp_mark_active_day_v1(new.user_id,v_period.id);
  return new;
end;
$$;
revoke all on function private.buklod_community_qmp_after_post_v1() from public,anon,authenticated;
drop trigger if exists buklod_community_qmp_after_post on public.community_posts;
create trigger buklod_community_qmp_after_post after insert on public.community_posts
for each row execute function private.buklod_community_qmp_after_post_v1();

create or replace function private.buklod_community_qmp_after_comment_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_period private.buklod_community_settlement_periods; v_rule private.buklod_community_qmp_rule_versions;
  v_creator uuid; v_min integer:=20; v_days integer:=7; v_reply bigint:=3; v_bonus bigint:=1; v_dup boolean:=false;
begin
  if new.user_id is null or new.is_hidden or new.deleted_at is not null then return new; end if;
  select p.user_id into v_creator from public.community_posts p where p.id=new.post_id;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_min:=coalesce((v_rule.config#>>'{qualification,reply_min_chars}')::integer,20);
  v_days:=coalesce((v_rule.config#>>'{qualification,duplicate_reply_days}')::integer,7);
  v_reply:=coalesce((v_rule.config#>>'{base_qmp,meaningful_reply}')::bigint,3);
  v_bonus:=coalesce((v_rule.config#>>'{engagement_bonus,unique_reaction}')::bigint,1);
  select exists(select 1 from public.comments c where c.user_id=new.user_id and c.id<>new.id
    and c.created_at>=now()-make_interval(days=>v_days)
    and lower(regexp_replace(trim(c.body),'\s+',' ','g'))=lower(regexp_replace(trim(new.body),'\s+',' ','g'))) into v_dup;
  if v_creator is not null and new.user_id<>v_creator and length(trim(coalesce(new.body,'')))>=v_min and not v_dup then
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.post_id,'comment:'||new.id::text,'MEANINGFUL_REPLY',
      v_reply,0,'QUALIFIED','QUALIFIED','MEANINGFUL_REPLY',jsonb_build_object('comment_id',new.id));
    perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'MEANINGFUL_REPLY');
    perform private.buklod_community_qmp_record_event_v1(v_creator,new.post_id,'creator-comment:'||new.id::text,'VALIDATED_ENGAGEMENT',
      0,v_bonus,'QUALIFIED','QUALIFIED','LEGITIMATE_REPLY_ENGAGEMENT',jsonb_build_object('comment_id',new.id));
    perform private.buklod_community_qmp_mark_active_day_v1(new.user_id,v_period.id);
  else
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.post_id,'comment:'||new.id::text,'MEANINGFUL_REPLY',
      v_reply,0,case when v_dup or new.user_id=v_creator then 'DISQUALIFIED' else 'PENDING' end,
      case when v_dup or new.user_id=v_creator then 'DISQUALIFIED' else 'PENDING' end,
      case when new.user_id=v_creator then 'SELF_THREAD_EXCLUDED' when v_dup then 'DUPLICATE_REPLY' else 'REPLY_QUALITY_REVIEW' end,
      jsonb_build_object('comment_id',new.id));
  end if;
  return new;
end;
$$;
revoke all on function private.buklod_community_qmp_after_comment_v1() from public,anon,authenticated;
drop trigger if exists buklod_community_qmp_after_comment on public.comments;
create trigger buklod_community_qmp_after_comment after insert on public.comments
for each row execute function private.buklod_community_qmp_after_comment_v1();

create or replace function private.buklod_community_qmp_after_reaction_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_creator uuid; v_rule private.buklod_community_qmp_rule_versions; v_period private.buklod_community_settlement_periods; v_bonus bigint:=1;
begin
  select p.user_id into v_creator from public.community_posts p where p.id=new.post_id;
  if v_creator is null or new.user_id=v_creator then return new; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_bonus:=coalesce((v_rule.config#>>'{engagement_bonus,unique_reaction}')::bigint,1);
  perform private.buklod_community_qmp_record_event_v1(v_creator,new.post_id,'creator-reaction:'||new.post_id::text||':'||new.user_id::text,
    'VALIDATED_ENGAGEMENT',0,v_bonus,'QUALIFIED','QUALIFIED','UNIQUE_REACTION',jsonb_build_object('reaction',new.reaction));
  return new;
end;
$$;
revoke all on function private.buklod_community_qmp_after_reaction_v1() from public,anon,authenticated;
drop trigger if exists buklod_community_qmp_after_reaction on public.reactions;
create trigger buklod_community_qmp_after_reaction after insert on public.reactions
for each row execute function private.buklod_community_qmp_after_reaction_v1();

create or replace function private.buklod_community_qmp_after_share_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_creator uuid; v_rule private.buklod_community_qmp_rule_versions; v_period private.buklod_community_settlement_periods; v_bonus bigint:=2;
begin
  select p.user_id into v_creator from public.community_posts p where p.id=new.source_post_id;
  if v_creator is null or new.shared_by=v_creator then return new; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_bonus:=coalesce((v_rule.config#>>'{engagement_bonus,internal_share}')::bigint,2);
  perform private.buklod_community_qmp_record_event_v1(v_creator,new.source_post_id,'creator-share:'||new.id::text,
    'VALIDATED_ENGAGEMENT',0,v_bonus,'QUALIFIED','QUALIFIED','INTERNAL_SHARE',jsonb_build_object('share_id',new.id));
  return new;
end;
$$;
revoke all on function private.buklod_community_qmp_after_share_v1() from public,anon,authenticated;
drop trigger if exists buklod_community_qmp_after_share on public.community_post_internal_shares;
create trigger buklod_community_qmp_after_share after insert on public.community_post_internal_shares
for each row execute function private.buklod_community_qmp_after_share_v1();

create or replace function public.get_my_buklod_community_video_quota_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  return private.buklod_community_qmp_video_quota_v1(v_actor);
end; $$;
revoke all on function public.get_my_buklod_community_video_quota_v1() from public,anon;
grant execute on function public.get_my_buklod_community_video_quota_v1() to authenticated;

create or replace function public.assert_my_buklod_community_video_quota_v1(p_size_bytes bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=(select auth.uid()); v_q jsonb; v_size bigint:=greatest(coalesce(p_size_bytes,0),0); begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_q:=private.buklod_community_qmp_video_quota_v1(v_actor);
  return v_q||jsonb_build_object('requested_bytes',v_size,'allowed',
    coalesce((v_q->>'used_bytes')::bigint,0)+v_size<=coalesce((v_q->>'allowance_bytes')::bigint,0));
end; $$;
revoke all on function public.assert_my_buklod_community_video_quota_v1(bigint) from public,anon;
grant execute on function public.assert_my_buklod_community_video_quota_v1(bigint) to authenticated;

create or replace function public.get_my_buklod_community_contribution_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid()); v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions; v_qmp bigint:=0; v_held bigint:=0; v_total bigint:=0;
  v_weight numeric:=0; v_level record; v_next record; v_posts bigint:=0; v_videos bigint:=0; v_replies bigint:=0;
  v_r38 private.buklod_r38_economic_periods; v_designated_minor bigint:=0; v_est_pool bigint:=0; v_est_share bigint:=null;
  v_pool_bps integer:=3000; v_final jsonb:=null; v_quota jsonb; v_review jsonb:='[]'::jsonb; v_estimate_enabled boolean:=true;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_pool_bps:=coalesce((v_rule.config->>'pool_bps')::integer,3000);
  v_estimate_enabled:=coalesce((v_rule.config#>>'{activation,estimate_enabled}')::boolean,false);
  select coalesce(a.qualified_qmp,0),coalesce(a.held_qmp,0) into v_qmp,v_held
  from private.buklod_community_qmp_accounts a where a.user_id=v_actor and a.settlement_period_id=v_period.id;
  v_qmp:=coalesce(v_qmp,0); v_held:=coalesce(v_held,0);
  select coalesce(sum(a.qualified_qmp),0)::bigint into v_total
  from private.buklod_community_qmp_accounts a where a.settlement_period_id=v_period.id;
  if v_total>0 then v_weight:=v_qmp::numeric/v_total::numeric; end if;
  select l.* into v_level from private.buklod_community_qmp_levels l
  where l.rule_version=v_period.rule_version and l.enabled and v_qmp>=l.min_qmp and (l.max_qmp is null or v_qmp<=l.max_qmp)
  order by l.min_qmp desc limit 1;
  select l.* into v_next from private.buklod_community_qmp_levels l
  where l.rule_version=v_period.rule_version and l.enabled and l.min_qmp>v_qmp order by l.min_qmp asc limit 1;
  select count(*) filter(where e.contribution_type='USEFUL_POST'),count(*) filter(where e.contribution_type='QUALIFIED_VIDEO'),
         count(*) filter(where e.contribution_type='MEANINGFUL_REPLY') into v_posts,v_videos,v_replies
  from private.buklod_community_qmp_events e where e.user_id=v_actor and e.settlement_period_id=v_period.id and e.state in ('QUALIFIED','FINALIZED');
  select * into v_r38 from private.buklod_r38_economic_periods where period_key=upper(v_period.period_key) limit 1;
  if v_r38.id is not null and v_estimate_enabled then
    select coalesce(sum(round(e.amount*100)),0)::bigint into v_designated_minor
    from private.buklod_r38_financial_entries e where e.period_id=v_r38.id and e.direction='revenue'
      and e.reconciliation_state='RECONCILED' and coalesce((e.metadata->>'user_pool_designated')::boolean,false)=true;
  end if;
  v_est_pool:=floor(v_designated_minor::numeric*v_pool_bps/10000)::bigint;
  if v_total>0 and v_estimate_enabled then v_est_share:=floor(v_est_pool::numeric*v_qmp::numeric/v_total::numeric)::bigint; end if;
  select jsonb_build_object('amount_minor',a.amount_minor,'status',a.status,'finalized_at',a.finalized_at) into v_final
  from private.buklod_community_user_share_allocations a join private.buklod_community_user_pool_periods pp on pp.id=a.pool_period_id
  where pp.settlement_period_id=v_period.id and a.user_id=v_actor limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('event_id',e.id,'type',e.contribution_type,'status',e.state,
    'reason_category',coalesce(e.reason_code,'REVIEW'),'review_eligible',e.state in ('HELD','PENDING','DISQUALIFIED')) order by e.created_at desc),'[]'::jsonb)
  into v_review from (select * from private.buklod_community_qmp_events where user_id=v_actor and settlement_period_id=v_period.id
    and state in ('HELD','PENDING','DISQUALIFIED') order by created_at desc limit 10) e;
  v_quota:=private.buklod_community_qmp_video_quota_v1(v_actor);
  return jsonb_build_object(
    'period',jsonb_build_object('key',v_period.period_key,'starts_at',v_period.starts_at,'ends_at',v_period.ends_at,'status',v_period.status),
    'rule_version',v_period.rule_version,'this_month_qmp',v_qmp,'held_qmp',v_held,'total_qualified_qmp',v_total,'share_weight',v_weight,
    'qualified_posts',coalesce(v_posts,0),'qualified_videos',coalesce(v_videos,0),'meaningful_replies',coalesce(v_replies,0),
    'contribution_level',coalesce(v_level.label,'STARTER'),
    'next_level',case when v_next.level_code is null then null else jsonb_build_object('label',v_next.label,'min_qmp',v_next.min_qmp,'remaining_qmp',greatest(v_next.min_qmp-v_qmp,0)) end,
    'estimated_share_minor',v_est_share,'estimated_pool_minor',v_est_pool,
    'estimate_label','ESTIMATE / NOT FINAL / SUBJECT TO QUALIFICATION REVIEW / SUBJECT TO FINALIZED REVENUE',
    'finalized_share',v_final,'video_quota',v_quota,'review_items',v_review);
end;
$$;
revoke all on function public.get_my_buklod_community_contribution_v1() from public,anon;
grant execute on function public.get_my_buklod_community_contribution_v1() to authenticated;

create or replace function public.request_my_buklod_community_qmp_review_v1(p_event_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_event private.buklod_community_qmp_events; v_row private.buklod_community_qmp_review_requests;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_event from private.buklod_community_qmp_events where id=p_event_id and user_id=v_actor;
  if v_event.id is null then raise exception 'Contribution event not found'; end if;
  if v_event.state not in ('HELD','PENDING','DISQUALIFIED') then raise exception 'This contribution is not eligible for review'; end if;
  insert into private.buklod_community_qmp_review_requests(event_id,user_id,user_note,status)
  values(v_event.id,v_actor,nullif(left(trim(coalesce(p_note,'')),500),''),'REQUESTED')
  on conflict(event_id,user_id) do update set user_note=excluded.user_note returning * into v_row;
  return jsonb_build_object('id',v_row.id,'status',v_row.status);
end;
$$;
revoke all on function public.request_my_buklod_community_qmp_review_v1(uuid,text) from public,anon;
grant execute on function public.request_my_buklod_community_qmp_review_v1(uuid,text) to authenticated;

create or replace function public.record_buklod_community_economy_analytics_v1(p_event_name text,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_name text:=lower(trim(coalesce(p_event_name,'')));
begin
  if v_actor is null then return; end if;
  if v_name not in ('contribution_card_viewed','increase_share_opened','qualification_completed','mission_completed','level_changed',
    'estimated_share_viewed','settlement_finalized','boost_created','premium_creator_started','quota_reached') then return; end if;
  insert into private.buklod_community_economy_analytics(user_id,event_name,metadata)
  values(v_actor,v_name,coalesce(p_metadata,'{}'::jsonb)-'amount_minor'-'exact_earnings');
end;
$$;
revoke all on function public.record_buklod_community_economy_analytics_v1(text,jsonb) from public,anon;
grant execute on function public.record_buklod_community_economy_analytics_v1(text,jsonb) to authenticated;

create or replace function public.admin_record_buklod_community_wall_financial_entry_v1(
  p_period_key text,p_direction text,p_amount numeric,p_category text,p_source_system text,
  p_external_reference text,p_reconciliation_state text default 'ESTIMATED',
  p_user_pool_designated boolean default false,p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_key text:=coalesce(nullif(trim(p_idempotency_key),''),'community-wall:'||gen_random_uuid()::text);
  v_meta jsonb;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if lower(trim(p_direction)) not in ('revenue','cost') then raise exception 'Direction must be revenue or cost'; end if;
  if lower(trim(p_direction))='cost' and coalesce(p_user_pool_designated,false) then raise exception 'Costs cannot be designated into the User Revenue Pool'; end if;
  v_meta:=jsonb_build_object('entered_from','community_wall_fbc','feature_key','COMMUNITY_WALL_VIDEO',
    'wall_category',upper(left(trim(coalesce(p_category,'OTHER')),60)),
    'user_pool_designated',case when lower(trim(p_direction))='revenue' then coalesce(p_user_pool_designated,false) else false end);
  return public.admin_add_buklod_r38_financial_entry_v1(
    p_period_key,case when lower(trim(p_direction))='revenue' then 'REVENUE' else 'OPERATIONAL_COST' end,
    lower(trim(p_direction)),p_amount,coalesce(nullif(trim(p_source_system),''),'community_wall'),p_external_reference,v_key,
    upper(trim(coalesce(p_reconciliation_state,'ESTIMATED'))),v_meta);
end;
$$;
revoke all on function public.admin_record_buklod_community_wall_financial_entry_v1(text,text,numeric,text,text,text,text,boolean,text) from public,anon;
grant execute on function public.admin_record_buklod_community_wall_financial_entry_v1(text,text,numeric,text,text,text,text,boolean,text) to authenticated;

create or replace function public.admin_get_buklod_community_economy_v1(p_period_key text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid()); v_qperiod private.buklod_community_settlement_periods; v_r38 private.buklod_r38_economic_periods;
  v_revenue bigint:=0; v_cost bigint:=0; v_designated bigint:=0; v_qmp bigint:=0; v_users bigint:=0; v_held bigint:=0;
  v_reversed bigint:=0; v_top bigint:=0; v_pool private.buklod_community_user_pool_periods; v_uploaded bigint:=0; v_creators bigint:=0;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if nullif(trim(coalesce(p_period_key,'')),'') is null then v_qperiod:=private.buklod_community_qmp_ensure_period_v1();
  else select * into v_qperiod from private.buklod_community_settlement_periods where period_key=trim(p_period_key); end if;
  if v_qperiod.id is null then raise exception 'Community settlement period not found'; end if;
  select * into v_r38 from private.buklod_r38_economic_periods where period_key=upper(v_qperiod.period_key) limit 1;
  if v_r38.id is not null then
    select
      coalesce(sum(round(e.amount*100)) filter(where e.direction='revenue'),0)::bigint,
      coalesce(sum(round(e.amount*100)) filter(where e.direction='cost'),0)::bigint,
      coalesce(sum(round(e.amount*100)) filter(where e.direction='revenue' and coalesce((e.metadata->>'user_pool_designated')::boolean,false)=true),0)::bigint
    into v_revenue,v_cost,v_designated
    from private.buklod_r38_financial_entries e where e.period_id=v_r38.id and e.reconciliation_state='RECONCILED'
      and e.metadata->>'feature_key'='COMMUNITY_WALL_VIDEO';
  end if;
  select coalesce(sum(a.qualified_qmp),0)::bigint,count(*) filter(where a.qualified_qmp>0)::bigint,
    coalesce(sum(a.held_qmp),0)::bigint,coalesce(sum(a.reversed_qmp),0)::bigint,coalesce(max(a.qualified_qmp),0)::bigint
  into v_qmp,v_users,v_held,v_reversed,v_top from private.buklod_community_qmp_accounts a where a.settlement_period_id=v_qperiod.id;
  select * into v_pool from private.buklod_community_user_pool_periods where settlement_period_id=v_qperiod.id;
  select coalesce(sum(coalesce(p.media_size_bytes,0)),0)::bigint,count(distinct p.user_id)::bigint into v_uploaded,v_creators
  from public.community_posts p where p.created_at>=v_qperiod.starts_at and p.created_at<v_qperiod.ends_at
    and p.deleted_at is null and p.is_reel=false and lower(coalesce(p.media_mime_type,'')) like 'video/%';
  return jsonb_build_object(
    'period_key',v_qperiod.period_key,'settlement_status',v_qperiod.status,
    'video_wall',jsonb_build_object('revenue_minor',v_revenue,'cost_minor',v_cost,'contribution_minor',v_revenue-v_cost,
      'margin',case when v_revenue>0 then (v_revenue-v_cost)::numeric/v_revenue::numeric else null end,
      'management_target','40-50% mature margin target; actual margin only, never fabricated','uploaded_bytes',v_uploaded,
      'creator_count',v_creators,'delivery_gb',null,'watched_minutes',null,
      'note','Delivery GB and watched minutes remain unavailable until provider telemetry is connected.'),
    'community_contribution',jsonb_build_object('designated_revenue_minor',v_designated,'pool_percentage_bps',coalesce(v_pool.pool_percentage_bps,3000),
      'user_pool_minor',coalesce(v_pool.user_pool_minor,0),'total_qualified_qmp',v_qmp,'qualified_users',v_users,
      'average_qmp',case when v_users>0 then v_qmp::numeric/v_users::numeric else 0 end,
      'top_user_concentration',case when v_qmp>0 then v_top::numeric/v_qmp::numeric else 0 end,
      'fraud_held_qmp',v_held,'reversed_qmp',v_reversed,'rounding_residue_minor',coalesce(v_pool.rounding_residue_minor,0),
      'pool_status',v_pool.status));
end;
$$;
revoke all on function public.admin_get_buklod_community_economy_v1(text) from public,anon;
grant execute on function public.admin_get_buklod_community_economy_v1(text) to authenticated;

create or replace function public.admin_review_buklod_community_qmp_event_v1(p_event_id uuid,p_approve boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_event private.buklod_community_qmp_events; v_amount bigint;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  select * into v_event from private.buklod_community_qmp_events where id=p_event_id for update;
  if v_event.id is null then raise exception 'Contribution event not found'; end if;
  if v_event.state not in ('HELD','PENDING','DISQUALIFIED') then raise exception 'Contribution event is not reviewable'; end if;
  v_amount:=v_event.total_qmp;
  if p_approve then
    if v_event.state='HELD' then
      update private.buklod_community_qmp_accounts set held_qmp=greatest(held_qmp-v_amount,0),qualified_qmp=qualified_qmp+v_amount,updated_at=now()
      where user_id=v_event.user_id and settlement_period_id=v_event.settlement_period_id;
    elsif v_amount>0 then
      insert into private.buklod_community_qmp_accounts(user_id,settlement_period_id,qualified_qmp,updated_at)
      values(v_event.user_id,v_event.settlement_period_id,v_amount,now())
      on conflict(user_id,settlement_period_id) do update set qualified_qmp=private.buklod_community_qmp_accounts.qualified_qmp+v_amount,updated_at=now();
    end if;
    update private.buklod_community_qmp_events set state='QUALIFIED',qualification_state='QUALIFIED',reason_code='ADMIN_REVIEW_APPROVED' where id=v_event.id;
  else
    if v_event.state='HELD' then update private.buklod_community_qmp_accounts set held_qmp=greatest(held_qmp-v_amount,0),updated_at=now()
      where user_id=v_event.user_id and settlement_period_id=v_event.settlement_period_id; end if;
    update private.buklod_community_qmp_events set state='DISQUALIFIED',qualification_state='DISQUALIFIED',reason_code='ADMIN_REVIEW_REJECTED' where id=v_event.id;
  end if;
  update private.buklod_community_qmp_review_requests set status=case when p_approve then 'APPROVED' else 'REJECTED' end,
    reviewer_note=nullif(left(trim(coalesce(p_reason,'')),500),''),reviewed_by=v_actor,reviewed_at=now()
  where event_id=v_event.id and status in ('REQUESTED','UNDER_REVIEW');
  return jsonb_build_object('event_id',v_event.id,'approved',p_approve);
end;
$$;
revoke all on function public.admin_review_buklod_community_qmp_event_v1(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_buklod_community_qmp_event_v1(uuid,boolean,text) to authenticated;

create or replace function public.admin_finalize_buklod_community_user_pool_v1(p_period_key text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid()); v_qperiod private.buklod_community_settlement_periods;
  v_r38 private.buklod_r38_economic_periods; v_rule private.buklod_community_qmp_rule_versions;
  v_designated bigint:=0; v_pool_bps integer:=3000; v_pool_minor bigint:=0; v_total bigint:=0; v_pool_id uuid; v_residue bigint:=0;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  select * into v_qperiod from private.buklod_community_settlement_periods where period_key=trim(p_period_key) for update;
  if v_qperiod.id is null then raise exception 'Community settlement period not found'; end if;
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_qperiod.rule_version;
  if not coalesce((v_rule.config#>>'{activation,financial_finalization_enabled}')::boolean,false) then
    raise exception 'Community financial finalization gate is OFF';
  end if;
  if exists(select 1 from private.buklod_community_user_pool_periods where settlement_period_id=v_qperiod.id) then
    return (select jsonb_build_object('id',id,'status',status,'idempotent_replay',true)
      from private.buklod_community_user_pool_periods where settlement_period_id=v_qperiod.id);
  end if;
  if exists(select 1 from private.buklod_community_qmp_events where settlement_period_id=v_qperiod.id and state='HELD' and total_qmp>0) then
    raise exception 'Held QMP must be resolved before settlement finalization';
  end if;
  select * into v_r38 from private.buklod_r38_economic_periods where period_key=upper(v_qperiod.period_key) for update;
  if v_r38.id is null then raise exception 'Matching funded R38 economic period not found'; end if;
  if v_r38.status not in ('FINALIZED','PAYOUT_READY','CLOSED') then raise exception 'Only finalized funded revenue may enter the Community User Revenue Pool'; end if;
  if exists(select 1 from private.buklod_r38_user_period_shares s where s.period_id=v_r38.id and s.pool_key='BAYANIHAN') then
    raise exception 'Double-count guard: this R38 period already has BAYANIHAN user-share allocations';
  end if;
  v_pool_bps:=coalesce((v_rule.config->>'pool_bps')::integer,3000);
  select coalesce(sum(round(e.amount*100)),0)::bigint into v_designated
  from private.buklod_r38_financial_entries e where e.period_id=v_r38.id and e.direction='revenue'
    and e.reconciliation_state='RECONCILED' and coalesce((e.metadata->>'user_pool_designated')::boolean,false)=true;
  select coalesce(sum(a.qualified_qmp),0)::bigint into v_total from private.buklod_community_qmp_accounts a where a.settlement_period_id=v_qperiod.id;
  v_pool_minor:=floor(v_designated::numeric*v_pool_bps/10000)::bigint;
  insert into private.buklod_community_user_pool_periods(settlement_period_id,r38_period_id,designated_revenue_minor,pool_percentage_bps,
    user_pool_minor,total_qualified_qmp,status,rule_version,finalized_by,finalized_at)
  values(v_qperiod.id,v_r38.id,v_designated,v_pool_bps,v_pool_minor,v_total,'FINALIZED',v_qperiod.rule_version,v_actor,now()) returning id into v_pool_id;
  if v_total>0 and v_pool_minor>0 then
    with weights as (
      select a.user_id,a.qualified_qmp,
        (v_pool_minor::numeric*a.qualified_qmp::numeric/v_total::numeric) raw_amount,
        floor(v_pool_minor::numeric*a.qualified_qmp::numeric/v_total::numeric)::bigint base_amount
      from private.buklod_community_qmp_accounts a where a.settlement_period_id=v_qperiod.id and a.qualified_qmp>0
    ), ranked as (
      select w.*,(w.raw_amount-w.base_amount::numeric) remainder,
        row_number() over(order by (w.raw_amount-w.base_amount::numeric) desc,w.user_id) rn,
        sum(w.base_amount) over() base_total from weights w
    )
    insert into private.buklod_community_user_share_allocations(pool_period_id,user_id,qualified_qmp,total_period_qmp,share_weight,
      amount_minor,status,rule_version,idempotency_key,finalized_at)
    select v_pool_id,r.user_id,r.qualified_qmp,v_total,r.qualified_qmp::numeric/v_total::numeric,
      r.base_amount+case when r.rn<=greatest(v_pool_minor-r.base_total,0) then 1 else 0 end,
      'FINALIZED',v_qperiod.rule_version,'community-qmp:'||v_qperiod.id::text||':'||r.user_id::text,now() from ranked r;
    select v_pool_minor-coalesce(sum(amount_minor),0) into v_residue from private.buklod_community_user_share_allocations where pool_period_id=v_pool_id;
  end if;
  update private.buklod_community_user_pool_periods set rounding_residue_minor=coalesce(v_residue,0),updated_at=now() where id=v_pool_id;
  update private.buklod_community_qmp_events set state='FINALIZED',finalized_at=now() where settlement_period_id=v_qperiod.id and state='QUALIFIED';
  update private.buklod_community_settlement_periods set status='FINALIZED',finalized_at=now(),updated_at=now() where id=v_qperiod.id;
  return jsonb_build_object('id',v_pool_id,'status','FINALIZED','designated_revenue_minor',v_designated,'user_pool_minor',v_pool_minor,
    'total_qualified_qmp',v_total,'rounding_residue_minor',coalesce(v_residue,0),'idempotent_replay',false);
end;
$$;
revoke all on function public.admin_finalize_buklod_community_user_pool_v1(text,text) from public,anon;
grant execute on function public.admin_finalize_buklod_community_user_pool_v1(text,text) to authenticated;

create or replace function public.admin_set_buklod_community_user_pool_status_v1(p_period_key text,p_status text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_next text:=upper(trim(coalesce(p_status,''))); v_pool private.buklod_community_user_pool_periods;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  select pp.* into v_pool from private.buklod_community_user_pool_periods pp
  join private.buklod_community_settlement_periods p on p.id=pp.settlement_period_id where p.period_key=trim(p_period_key) for update;
  if v_pool.id is null then raise exception 'Community User Revenue Pool not found'; end if;
  if not ((v_pool.status='FINALIZED' and v_next='PAYABLE') or (v_pool.status='PAYABLE' and v_next='PAID') or
          (v_pool.status='PAID' and v_next='LOCKED')) then raise exception 'Invalid forward-only Community User Pool transition'; end if;
  update private.buklod_community_user_pool_periods set status=v_next,updated_at=now() where id=v_pool.id;
  update private.buklod_community_user_share_allocations set status=v_next where pool_period_id=v_pool.id and status in ('FINALIZED','PAYABLE','PAID');
  update private.buklod_community_settlement_periods set status=v_next,updated_at=now() where id=v_pool.settlement_period_id;
  return jsonb_build_object('id',v_pool.id,'status',v_next);
end;
$$;
revoke all on function public.admin_set_buklod_community_user_pool_status_v1(text,text) from public,anon;
grant execute on function public.admin_set_buklod_community_user_pool_status_v1(text,text) to authenticated;

comment on table private.buklod_community_qmp_events is 'Monthly Community contribution weight ledger. QMP is not money and has no fixed PHP value.';
comment on table private.buklod_community_user_pool_periods is 'Explicitly designated finalized Community User Revenue Pool using integer minor units.';
comment on table private.buklod_community_user_share_allocations is 'Final proportional allocations. Raw views, ad clicks, self-engagement and Lifetime Points cannot create these rows.';
