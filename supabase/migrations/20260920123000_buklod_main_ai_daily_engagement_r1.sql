-- BUKLOD_MAIN_AI_DAILY_ENGAGEMENT_R1
-- Shared once-per-day AI-assisted Community Wall content.
-- No user-specific generation. No fabricated real-world/community events.

create table if not exists public.buklod_daily_engagement_items (
  id uuid primary key default gen_random_uuid(),
  publish_date date not null,
  slot smallint not null check (slot between 1 and 8),
  item_type text not null check (item_type in (
    'QUESTION','POLL','CHALLENGE','CONVERSATION_STARTER','TRIVIA','WOULD_YOU_RATHER','TRENDING_SUMMARY','MANUAL'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 700),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options)='array'),
  category text not null check (category in (
    'family','food','work','school','hobbies','relationships','pets','local_life',
    'practical_life','aspirations','entertainment','community','light_humor','wellness','learning'
  )),
  source_kind text not null check (source_kind in (
    'AI_GENERIC','REAL_TRENDING','CURATED_FALLBACK','MANUAL'
  )),
  source_post_ids uuid[] not null default '{}'::uuid[],
  ai_model text,
  ai_version text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  similarity_hash text,
  previous_similarity_ref uuid references public.buklod_daily_engagement_items(id) on delete set null,
  engagement_count bigint not null default 0 check (engagement_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publish_date, slot)
);

create index if not exists idx_buklod_daily_engagement_publish_active
  on public.buklod_daily_engagement_items(publish_date desc, slot)
  where status='ACTIVE';

create index if not exists idx_buklod_daily_engagement_similarity
  on public.buklod_daily_engagement_items(similarity_hash)
  where similarity_hash is not null;

alter table public.buklod_daily_engagement_items enable row level security;
revoke all on public.buklod_daily_engagement_items from anon, authenticated;

create table if not exists private.buklod_daily_engagement_generation_runs (
  publish_date date primary key,
  status text not null check (status in ('CLAIMED','COMPLETE','FAILED')),
  claim_token uuid not null default gen_random_uuid() unique,
  claimed_by uuid,
  claimed_at timestamptz not null default now(),
  attempts smallint not null default 1 check (attempts between 1 and 3),
  ai_model text,
  error_summary text,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists private.buklod_daily_engagement_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  ai_enabled boolean not null default true,
  cards_per_day smallint not null default 3 check (cards_per_day between 1 and 5),
  categories jsonb not null default '["family","food","work","school","hobbies","relationships","pets","local_life","practical_life","aspirations","entertainment","community","light_humor","wellness","learning"]'::jsonb,
  min_trending_signal integer not null default 3 check (min_trending_signal between 1 and 1000),
  generation_frequency text not null default 'DAILY' check (generation_frequency='DAILY'),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into private.buklod_daily_engagement_config(singleton)
values(true)
on conflict(singleton) do nothing;

create table if not exists private.buklod_daily_engagement_metrics (
  event_date date not null,
  item_id uuid not null references public.buklod_daily_engagement_items(id) on delete cascade,
  event_type text not null check (event_type in ('VIEW','ENGAGE')),
  event_count bigint not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now(),
  primary key(event_date,item_id,event_type)
);

create or replace function public.get_buklod_today_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_publish date;
  v_items jsonb;
  v_cfg private.buklod_daily_engagement_config%rowtype;
begin
  select * into v_cfg
  from private.buklod_daily_engagement_config
  where singleton=true;

  select max(i.publish_date) into v_publish
  from public.buklod_daily_engagement_items i
  where i.status='ACTIVE'
    and i.publish_date between v_today - 7 and v_today;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',i.id,
      'publish_date',i.publish_date,
      'slot',i.slot,
      'item_type',i.item_type,
      'title',i.title,
      'body',i.body,
      'options',i.options,
      'category',i.category,
      'source_kind',i.source_kind,
      'source_post_ids',i.source_post_ids,
      'generated_at',i.generated_at
    )
    order by i.slot
  ),'[]'::jsonb)
  into v_items
  from public.buklod_daily_engagement_items i
  where i.status='ACTIVE'
    and i.publish_date=v_publish;

  return jsonb_build_object(
    'today',v_today,
    'content_date',v_publish,
    'is_fallback',coalesce(v_publish<>v_today,true),
    'generation_needed',
      coalesce(v_cfg.enabled,true)
      and coalesce(v_cfg.ai_enabled,true)
      and not exists(
        select 1 from public.buklod_daily_engagement_items i
        where i.publish_date=v_today and i.status='ACTIVE'
      ),
    'items',v_items
  );
end;
$$;

create or replace function public.claim_buklod_today_generation_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_token uuid;
  v_cfg private.buklod_daily_engagement_config%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select * into v_cfg
  from private.buklod_daily_engagement_config
  where singleton=true;

  if not coalesce(v_cfg.enabled,true) or not coalesce(v_cfg.ai_enabled,true) then
    return jsonb_build_object('claimed',false,'reason','DISABLED');
  end if;

  if exists(
    select 1 from public.buklod_daily_engagement_items
    where publish_date=v_today and status='ACTIVE'
  ) then
    return jsonb_build_object('claimed',false,'reason','ALREADY_READY');
  end if;

  insert into private.buklod_daily_engagement_generation_runs(
    publish_date,status,claimed_by,claimed_at,attempts,updated_at
  ) values (
    v_today,'CLAIMED',v_user,now(),1,now()
  )
  on conflict(publish_date) do update set
    status='CLAIMED',
    claim_token=gen_random_uuid(),
    claimed_by=v_user,
    claimed_at=now(),
    attempts=private.buklod_daily_engagement_generation_runs.attempts+1,
    error_summary=null,
    updated_at=now()
  where private.buklod_daily_engagement_generation_runs.status='FAILED'
    and private.buklod_daily_engagement_generation_runs.attempts < 3
    and private.buklod_daily_engagement_generation_runs.updated_at < now() - interval '10 minutes';

  select claim_token into v_token
  from private.buklod_daily_engagement_generation_runs
  where publish_date=v_today
    and status='CLAIMED'
    and claimed_by=v_user
    and claimed_at > now() - interval '2 minutes';

  return jsonb_build_object(
    'claimed',v_token is not null,
    'claim_token',v_token,
    'publish_date',v_today
  );
end;
$$;

create or replace function public.record_buklod_daily_engagement_v1(
  p_item_id uuid,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_type text := upper(trim(coalesce(p_event_type,'')));
begin
  if auth.uid() is null then return; end if;
  if v_type not in ('VIEW','ENGAGE') then return; end if;
  if not exists(
    select 1 from public.buklod_daily_engagement_items
    where id=p_item_id and status='ACTIVE'
  ) then return; end if;

  insert into private.buklod_daily_engagement_metrics(
    event_date,item_id,event_type,event_count,updated_at
  ) values(v_today,p_item_id,v_type,1,now())
  on conflict(event_date,item_id,event_type) do update
    set event_count=private.buklod_daily_engagement_metrics.event_count+1,
        updated_at=now();

  if v_type='ENGAGE' then
    update public.buklod_daily_engagement_items
    set engagement_count=engagement_count+1,updated_at=now()
    where id=p_item_id;
  end if;
end;
$$;

create or replace function public.admin_get_buklod_daily_engagement_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System admin required';
  end if;

  return jsonb_build_object(
    'config',(select to_jsonb(c) from private.buklod_daily_engagement_config c where c.singleton=true),
    'today',(
      select coalesce(jsonb_agg(to_jsonb(i) order by i.slot),'[]'::jsonb)
      from public.buklod_daily_engagement_items i
      where i.publish_date=v_today
    ),
    'recent',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x.publish_date desc,x.slot),'[]'::jsonb)
      from (
        select * from public.buklod_daily_engagement_items
        where publish_date >= v_today - 14
        order by publish_date desc,slot
        limit 50
      ) x
    )
  );
end;
$$;

create or replace function public.admin_set_buklod_daily_engagement_config_v1(
  p_enabled boolean,
  p_ai_enabled boolean,
  p_cards_per_day integer,
  p_categories jsonb,
  p_min_trending_signal integer
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System admin required';
  end if;

  update private.buklod_daily_engagement_config
  set enabled=coalesce(p_enabled,enabled),
      ai_enabled=coalesce(p_ai_enabled,ai_enabled),
      cards_per_day=least(5,greatest(1,coalesce(p_cards_per_day,cards_per_day))),
      categories=case when jsonb_typeof(p_categories)='array' then p_categories else categories end,
      min_trending_signal=least(1000,greatest(1,coalesce(p_min_trending_signal,min_trending_signal))),
      updated_by=auth.uid(),
      updated_at=now()
  where singleton=true;
end;
$$;

create or replace function public.admin_upsert_buklod_daily_engagement_item_v1(
  p_id uuid,
  p_publish_date date,
  p_slot integer,
  p_item_type text,
  p_title text,
  p_body text,
  p_options jsonb,
  p_category text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid := coalesce(p_id,gen_random_uuid());
begin
  if not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System admin required';
  end if;

  insert into public.buklod_daily_engagement_items(
    id,publish_date,slot,item_type,title,body,options,category,source_kind,status,metadata
  ) values(
    v_id,p_publish_date,p_slot,upper(trim(p_item_type)),left(trim(p_title),120),left(trim(p_body),700),
    coalesce(p_options,'[]'::jsonb),lower(trim(p_category)),'MANUAL',upper(trim(coalesce(p_status,'ACTIVE'))),
    jsonb_build_object('admin_override',true,'admin_id',auth.uid())
  )
  on conflict(id) do update set
    publish_date=excluded.publish_date,
    slot=excluded.slot,
    item_type=excluded.item_type,
    title=excluded.title,
    body=excluded.body,
    options=excluded.options,
    category=excluded.category,
    source_kind='MANUAL',
    status=excluded.status,
    metadata=public.buklod_daily_engagement_items.metadata||excluded.metadata,
    updated_at=now();

  return v_id;
end;
$$;

create or replace function public.admin_regenerate_buklod_daily_engagement_v1()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System admin required';
  end if;

  update public.buklod_daily_engagement_items
  set status='DISABLED',updated_at=now()
  where publish_date=v_today and source_kind<>'MANUAL';

  delete from private.buklod_daily_engagement_generation_runs
  where publish_date=v_today;
end;
$$;

grant execute on function public.get_buklod_today_v1() to authenticated;
grant execute on function public.claim_buklod_today_generation_v1() to authenticated;
grant execute on function public.record_buklod_daily_engagement_v1(uuid,text) to authenticated;
grant execute on function public.admin_get_buklod_daily_engagement_v1() to authenticated;
grant execute on function public.admin_set_buklod_daily_engagement_config_v1(boolean,boolean,integer,jsonb,integer) to authenticated;
grant execute on function public.admin_upsert_buklod_daily_engagement_item_v1(uuid,date,integer,text,text,text,jsonb,text,text) to authenticated;
grant execute on function public.admin_regenerate_buklod_daily_engagement_v1() to authenticated;

revoke all on function public.claim_buklod_today_generation_v1() from anon;
revoke all on function public.record_buklod_daily_engagement_v1(uuid,text) from anon;

-- No cron secret is stored in SQL. Daily generation is single-flight claimed by
-- the first authenticated Wall session when today's cache is absent.
