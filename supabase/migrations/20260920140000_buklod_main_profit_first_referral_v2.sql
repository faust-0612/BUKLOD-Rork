-- BUKLOD_MAIN_PROFIT_FIRST_REFERRAL_V2
-- Durable person identity + immutable first-line referral + finalized-value allocations.
-- This is additive. Legacy R38 remains for compatibility until V2 cutover is verified.

create table if not exists private.buklod_pf_config (
  singleton boolean primary key default true check(singleton),
  policy_version text not null default 'profit_first_v2',
  user_share_pct numeric(7,6) not null default 0.30 check(user_share_pct between 0 and 1),
  first_line_share_pct numeric(7,6) not null default 0.10 check(first_line_share_pct between 0 and 1),
  one_time_referral_php numeric(14,2) not null default 20.00 check(one_time_referral_php >= 0),
  referred_qualification_php numeric(14,2) not null default 40.00 check(referred_qualification_php >= 0),
  no_referrer_qualification_php numeric(14,2) not null default 60.00 check(no_referrer_qualification_php >= 0),
  referral_months integer not null default 6 check(referral_months between 1 and 24),
  manual_referral_window_days integer not null default 7 check(manual_referral_window_days between 1 and 30),
  minimum_withdrawal_php numeric(14,2) not null default 200.00 check(minimum_withdrawal_php >= 0),
  economics_enabled boolean not null default false,
  withdrawal_enabled boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into private.buklod_pf_config(singleton)
values(true)
on conflict(singleton) do nothing;

create table if not exists private.buklod_pf_persons (
  person_id uuid primary key default gen_random_uuid(),
  current_user_id uuid unique,
  created_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  recreation_count integer not null default 0 check(recreation_count >= 0),
  qualified_at timestamptz,
  qualification_kind text check(qualification_kind in ('REFERRED','NO_REFERRER')),
  user_share_activated_at timestamptz,
  risk_status text not null default 'CLEAR' check(risk_status in ('CLEAR','REVIEW','BLOCKED')),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists private.buklod_pf_user_links (
  user_id uuid primary key,
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  linked_at timestamptz not null default now(),
  retired_at timestamptz,
  link_reason text not null default 'SIGNUP',
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_buklod_pf_user_links_person
  on private.buklod_pf_user_links(person_id,linked_at desc);

create table if not exists private.buklod_pf_identity_signals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  signal_type text not null check(signal_type in ('AUTH_EMAIL','LOGIN_IDENTIFIER','MOBILE','USERNAME','NAME_BIRTH','DEVICE_RISK','NETWORK_RISK')),
  signal_hash text not null check(char_length(signal_hash) between 32 and 128),
  confidence text not null default 'STRONG' check(confidence in ('STRONG','SUPPORTING','RISK_ONLY')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(signal_type,signal_hash)
);
create index if not exists idx_buklod_pf_identity_person
  on private.buklod_pf_identity_signals(person_id);

create table if not exists public.buklod_referral_codes_v2 (
  person_id uuid primary key references private.buklod_pf_persons(person_id) on delete restrict,
  referral_code text not null unique check(referral_code ~ '^[A-Z0-9]{8,16}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.buklod_referral_codes_v2 enable row level security;
revoke all on public.buklod_referral_codes_v2 from anon,authenticated;

create table if not exists private.buklod_pf_referrals (
  referral_id uuid primary key default gen_random_uuid(),
  referrer_person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  referred_person_id uuid not null unique references private.buklod_pf_persons(person_id) on delete restrict,
  original_referral_code text not null,
  status text not null default 'PENDING' check(status in ('PENDING','QUALIFIED','REVIEW','BLOCKED')),
  one_time_reward_php numeric(14,2) not null,
  qualification_threshold_php numeric(14,2) not null,
  qualification_value_php numeric(14,2) not null default 0 check(qualification_value_php >= 0),
  relationship_locked_at timestamptz not null default now(),
  pending_reward_at timestamptz not null default now(),
  qualified_at timestamptz,
  reward_withdrawable_at timestamptz,
  referral_share_started_at timestamptz,
  referral_share_ends_at timestamptz,
  policy_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(referrer_person_id <> referred_person_id)
);
create index if not exists idx_buklod_pf_referrals_referrer
  on private.buklod_pf_referrals(referrer_person_id,status,created_at desc);
create unique index if not exists idx_buklod_pf_referral_pair
  on private.buklod_pf_referrals(referrer_person_id,referred_person_id);

create table if not exists private.buklod_pf_finalized_value_ledger (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  user_id_at_event uuid,
  provider text not null,
  feature_key text not null,
  placement_id text,
  gross_value_php numeric(16,6) not null check(gross_value_php > 0),
  external_reference text,
  idempotency_key text not null unique,
  finalized_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_buklod_pf_value_person
  on private.buklod_pf_finalized_value_ledger(person_id,finalized_at,id);

create table if not exists private.buklod_pf_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  bucket text not null check(bucket in ('USER_ALLOCATION','REFERRAL_REWARD','REFERRAL_SHARE','AVAILABLE','RESERVED','PAID')),
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount_php numeric(14,2) not null check(amount_php > 0),
  entry_type text not null,
  event_key text not null,
  source_value_id uuid references private.buklod_pf_finalized_value_ledger(id) on delete restrict,
  referral_id uuid references private.buklod_pf_referrals(referral_id) on delete restrict,
  withdrawal_id uuid,
  policy_version text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(person_id,event_key)
);
create index if not exists idx_buklod_pf_cash_person_bucket
  on private.buklod_pf_cash_ledger(person_id,bucket,created_at);

create table if not exists private.buklod_pf_referral_events (
  id bigint generated always as identity primary key,
  actor_person_id uuid references private.buklod_pf_persons(person_id) on delete restrict,
  referral_id uuid references private.buklod_pf_referrals(referral_id) on delete restrict,
  event_type text not null,
  event_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_buklod_pf_events_referral
  on private.buklod_pf_referral_events(referral_id,created_at);

create table if not exists private.buklod_pf_referral_funnel_daily (
  event_date date not null,
  event_type text not null,
  source text not null default 'APP',
  event_count bigint not null default 0 check(event_count >= 0),
  primary key(event_date,event_type,source)
);

alter table private.buklod_r38_referral_withdrawals
  add column if not exists person_id uuid references private.buklod_pf_persons(person_id) on delete restrict;

create index if not exists idx_buklod_r38_withdrawals_person
  on private.buklod_r38_referral_withdrawals(person_id,requested_at desc);

create or replace function private.buklod_pf_config_v2()
returns private.buklod_pf_config
language sql
stable
security definer
set search_path=''
as $$
  select c from private.buklod_pf_config c where c.singleton=true
$$;

create or replace function private.buklod_pf_person_for_user_v2(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select l.person_id
  from private.buklod_pf_user_links l
  where l.user_id=p_user_id
    and l.retired_at is null
  limit 1
$$;

create or replace function private.buklod_pf_cash_balance_v2(
  p_person_id uuid,
  p_bucket text
)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(case when l.direction='CREDIT' then l.amount_php else -l.amount_php end),0)::numeric
  from private.buklod_pf_cash_ledger l
  where l.person_id=p_person_id
    and l.bucket=upper(trim(p_bucket))
$$;

create or replace function private.buklod_pf_ensure_code_v2(p_person_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_code text;
begin
  select referral_code into v_code
  from public.buklod_referral_codes_v2
  where person_id=p_person_id and is_active=true;
  if found then return v_code; end if;

  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    begin
      insert into public.buklod_referral_codes_v2(person_id,referral_code)
      values(p_person_id,v_code);
      return v_code;
    exception when unique_violation then null;
    end;
  end loop;
end
$$;

create or replace function private.buklod_pf_link_identity_v2(
  p_user_id uuid,
  p_signals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_person uuid;
  v_existing uuid;
  v_candidates uuid[];
  v_candidate_count integer:=0;
  v_row jsonb;
  v_type text;
  v_hash text;
  v_conf text;
  v_old_user uuid;
  v_recreated boolean:=false;
begin
  if p_user_id is null then raise exception 'user_id required'; end if;
  if jsonb_typeof(p_signals)<>'array' then raise exception 'signals must be an array'; end if;

  select person_id into v_existing
  from private.buklod_pf_user_links
  where user_id=p_user_id and retired_at is null;

  if v_existing is not null then
    v_person:=v_existing;
  else
    select array_agg(distinct s.person_id)
      into v_candidates
    from private.buklod_pf_identity_signals s
    join jsonb_array_elements(p_signals) x
      on upper(trim(x->>'type'))=s.signal_type
     and trim(x->>'hash')=s.signal_hash
    where coalesce(upper(trim(x->>'confidence')),'STRONG')='STRONG'
      and s.confidence='STRONG';

    v_candidate_count:=coalesce(array_length(v_candidates,1),0);

    if v_candidate_count>1 then
      foreach v_person in array v_candidates loop
        update private.buklod_pf_persons
        set risk_status='REVIEW',
            metadata=metadata||jsonb_build_object('identity_conflict_at',now()),
            last_seen_at=now()
        where person_id=v_person;
      end loop;
      return jsonb_build_object('ok',false,'status','REVIEW_REQUIRED','reason','IDENTITY_CONFLICT');
    elsif v_candidate_count=1 then
      v_person:=v_candidates[1];
      select current_user_id into v_old_user
      from private.buklod_pf_persons where person_id=v_person for update;
      v_recreated:=v_old_user is not null and v_old_user<>p_user_id;
      if v_recreated then
        update private.buklod_pf_user_links
        set retired_at=coalesce(retired_at,now())
        where person_id=v_person and user_id<>p_user_id and retired_at is null;
      end if;
    else
      insert into private.buklod_pf_persons(current_user_id)
      values(p_user_id)
      returning person_id into v_person;
    end if;

    insert into private.buklod_pf_user_links(user_id,person_id,link_reason,metadata)
    values(
      p_user_id,v_person,
      case when v_recreated then 'RECREATED_ACCOUNT' else 'SIGNUP_OR_EXISTING' end,
      jsonb_build_object('linked_at',now())
    )
    on conflict(user_id) do update
      set person_id=excluded.person_id,
          retired_at=null,
          link_reason=excluded.link_reason,
          metadata=private.buklod_pf_user_links.metadata||excluded.metadata;
  end if;

  update private.buklod_pf_persons
  set current_user_id=p_user_id,
      last_seen_at=now(),
      recreation_count=recreation_count+case when v_recreated then 1 else 0 end
  where person_id=v_person;

  for v_row in select * from jsonb_array_elements(p_signals)
  loop
    v_type:=upper(trim(v_row->>'type'));
    v_hash:=trim(v_row->>'hash');
    v_conf:=coalesce(upper(trim(v_row->>'confidence')),'SUPPORTING');

    if v_type not in ('AUTH_EMAIL','LOGIN_IDENTIFIER','MOBILE','USERNAME','NAME_BIRTH','DEVICE_RISK','NETWORK_RISK')
       or char_length(v_hash)<32 then
      continue;
    end if;
    if v_conf not in ('STRONG','SUPPORTING','RISK_ONLY') then v_conf:='SUPPORTING'; end if;

    insert into private.buklod_pf_identity_signals(
      person_id,signal_type,signal_hash,confidence,last_seen_at
    ) values(v_person,v_type,v_hash,v_conf,now())
    on conflict(signal_type,signal_hash) do update
      set last_seen_at=now();
  end loop;

  return jsonb_build_object(
    'ok',true,
    'status',case when v_recreated then 'RELINKED' else 'LINKED' end,
    'person_id',v_person,
    'referral_code',private.buklod_pf_ensure_code_v2(v_person),
    'recreated',v_recreated
  );
end
$$;

create or replace function public.resolve_buklod_referral_code_v2(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_code text:=upper(regexp_replace(trim(coalesce(p_code,'')),'[^A-Z0-9]','','g'));
  v_person uuid;
  v_name text;
begin
  if v_code='' then return jsonb_build_object('found',false); end if;

  select c.person_id into v_person
  from public.buklod_referral_codes_v2 c
  where c.referral_code=v_code and c.is_active=true;

  if v_person is null then
    return jsonb_build_object('found',false,'message','Referral not found');
  end if;

  select coalesce(nullif(trim(p.first_name),''),split_part(trim(p.full_name),' ',1),'BUKLOD member')
    into v_name
  from private.buklod_pf_persons person
  left join public.profiles p on p.id=person.current_user_id
  where person.person_id=v_person;

  return jsonb_build_object('found',true,'code',v_code,'referrer_label',coalesce(v_name,'BUKLOD member'));
end
$$;

create or replace function private.buklod_pf_attach_referral_v2(
  p_referred_person uuid,
  p_referral_code text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cfg private.buklod_pf_config%rowtype;
  v_code text:=upper(regexp_replace(trim(coalesce(p_referral_code,'')),'[^A-Z0-9]','','g'));
  v_referrer uuid;
  v_existing private.buklod_pf_referrals%rowtype;
  v_created private.buklod_pf_referrals%rowtype;
  v_cursor uuid;
  v_referrer_user uuid;
begin
  select * into v_cfg from private.buklod_pf_config where singleton=true for share;

  if v_code='' then raise exception 'Referral code required'; end if;

  select * into v_existing
  from private.buklod_pf_referrals
  where referred_person_id=p_referred_person
  for update;

  if found then
    if v_existing.original_referral_code=v_code then
      return jsonb_build_object('ok',true,'idempotent',true,'referral_id',v_existing.referral_id,'status',v_existing.status);
    end if;
    raise exception 'Referrer is already locked for this person';
  end if;

  select c.person_id into v_referrer
  from public.buklod_referral_codes_v2 c
  where c.referral_code=v_code and c.is_active=true;

  if v_referrer is null then raise exception 'Referral not found'; end if;
  if v_referrer=p_referred_person then raise exception 'Self-referral is not allowed'; end if;

  if exists(
    select 1 from private.buklod_pf_persons p
    where p.person_id=p_referred_person
      and p.qualified_at is not null
  ) then
    raise exception 'Referral entry period has ended';
  end if;

  if exists(
    select 1
    from private.buklod_pf_persons p
    where p.person_id=p_referred_person
      and p.created_at < now()-(v_cfg.manual_referral_window_days||' days')::interval
  ) then
    raise exception 'Referral entry period has ended';
  end if;

  -- Walk the proposed referrer's ancestors. The referred person may never appear.
  v_cursor:=v_referrer;
  for i in 1..32 loop
    if v_cursor=p_referred_person then
      raise exception 'Circular referral relationship is not allowed';
    end if;
    select r.referrer_person_id into v_cursor
    from private.buklod_pf_referrals r
    where r.referred_person_id=v_cursor;
    exit when v_cursor is null;
  end loop;

  insert into private.buklod_pf_referrals(
    referrer_person_id,referred_person_id,original_referral_code,status,
    one_time_reward_php,qualification_threshold_php,policy_version,metadata
  ) values(
    v_referrer,p_referred_person,v_code,'PENDING',
    v_cfg.one_time_referral_php,v_cfg.referred_qualification_php,v_cfg.policy_version,
    jsonb_build_object('relationship_immutable',true)
  )
  returning * into v_created;

  insert into private.buklod_pf_referral_events(
    actor_person_id,referral_id,event_type,event_key,metadata
  ) values(
    p_referred_person,v_created.referral_id,'REFERRAL_ATTRIBUTED',
    'referral-attributed:'||v_created.referral_id::text,
    jsonb_build_object('pending_reward_php',v_created.one_time_reward_php)
  ) on conflict(event_key) do nothing;

  insert into private.buklod_pf_referral_funnel_daily(event_date,event_type,source,event_count)
  values((now() at time zone 'Asia/Manila')::date,'ATTRIBUTED','APP',1)
  on conflict(event_date,event_type,source) do update
    set event_count=private.buklod_pf_referral_funnel_daily.event_count+1;

  select current_user_id into v_referrer_user
  from private.buklod_pf_persons where person_id=v_referrer;

  if v_referrer_user is not null then
    perform public.queue_notification(
      v_referrer_user,
      'Referral joined',
      'Your referral has joined BUKLOD. ₱20 reward is pending qualification.',
      'referral_joined',
      jsonb_build_object('referral_id',v_created.referral_id,'reward_status','PENDING')
    );
  end if;

  return jsonb_build_object(
    'ok',true,'idempotent',false,'referral_id',v_created.referral_id,
    'status','PENDING','pending_reward_php',v_created.one_time_reward_php
  );
end
$$;

create or replace function private.buklod_pf_allocate_finalized_value_v2(
  p_value_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cfg private.buklod_pf_config%rowtype;
  v_value private.buklod_pf_finalized_value_ledger%rowtype;
  v_person private.buklod_pf_persons%rowtype;
  v_ref private.buklod_pf_referrals%rowtype;
  v_before numeric:=0;
  v_threshold numeric:=0;
  v_qualifying numeric:=0;
  v_eligible numeric:=0;
  v_user_share numeric:=0;
  v_referrer_share numeric:=0;
  v_referrer_user uuid;
  v_now timestamptz;
begin
  select * into v_cfg from private.buklod_pf_config where singleton=true for share;
  if not v_cfg.economics_enabled then
    return jsonb_build_object('processed',false,'reason','ECONOMICS_DISABLED');
  end if;

  select * into v_value
  from private.buklod_pf_finalized_value_ledger
  where id=p_value_id for update;
  if not found then raise exception 'Finalized value entry not found'; end if;

  select * into v_person
  from private.buklod_pf_persons
  where person_id=v_value.person_id for update;

  select * into v_ref
  from private.buklod_pf_referrals
  where referred_person_id=v_person.person_id
  for update;

  select coalesce(sum(gross_value_php),0)-v_value.gross_value_php
    into v_before
  from private.buklod_pf_finalized_value_ledger
  where person_id=v_person.person_id
    and (finalized_at<v_value.finalized_at or (finalized_at=v_value.finalized_at and id<=v_value.id));

  if v_person.user_share_activated_at is null then
    v_threshold:=case when v_ref.referral_id is not null
      then v_cfg.referred_qualification_php else v_cfg.no_referrer_qualification_php end;
    v_qualifying:=greatest(least(v_value.gross_value_php,v_threshold-v_before),0);
    v_eligible:=greatest(v_value.gross_value_php-v_qualifying,0);

    if v_before+v_value.gross_value_php>=v_threshold then
      v_now:=v_value.finalized_at;
      update private.buklod_pf_persons
      set qualified_at=coalesce(qualified_at,v_now),
          qualification_kind=coalesce(qualification_kind,case when v_ref.referral_id is not null then 'REFERRED' else 'NO_REFERRER' end),
          user_share_activated_at=coalesce(user_share_activated_at,v_now),
          last_seen_at=greatest(last_seen_at,v_now)
      where person_id=v_person.person_id;

      if v_ref.referral_id is not null and v_ref.qualified_at is null then
        update private.buklod_pf_referrals
        set status='QUALIFIED',
            qualification_value_php=v_threshold,
            qualified_at=v_now,
            reward_withdrawable_at=v_now,
            referral_share_started_at=v_now,
            referral_share_ends_at=v_now+make_interval(months=>v_cfg.referral_months),
            updated_at=now()
        where referral_id=v_ref.referral_id
        returning * into v_ref;

        insert into private.buklod_pf_cash_ledger(
          person_id,bucket,direction,amount_php,entry_type,event_key,referral_id,
          policy_version,description,metadata
        ) values(
          v_ref.referrer_person_id,'AVAILABLE','CREDIT',v_ref.one_time_reward_php,
          'REFERRAL_ONE_TIME_REWARD','referral-one-time:'||v_ref.referral_id::text,v_ref.referral_id,
          v_cfg.policy_version,'One-time qualified first-line referral reward',
          jsonb_build_object('source_bucket','REFERRAL_REWARD')
        ) on conflict(person_id,event_key) do nothing;

        insert into private.buklod_pf_referral_events(
          actor_person_id,referral_id,event_type,event_key,metadata
        ) values(
          v_ref.referrer_person_id,v_ref.referral_id,'QUALIFIED',
          'referral-qualified:'||v_ref.referral_id::text,
          jsonb_build_object(
            'reward_php',v_ref.one_time_reward_php,
            'share_started_at',v_ref.referral_share_started_at,
            'share_ends_at',v_ref.referral_share_ends_at
          )
        ) on conflict(event_key) do nothing;

        select current_user_id into v_referrer_user
        from private.buklod_pf_persons where person_id=v_ref.referrer_person_id;
        if v_referrer_user is not null then
          perform public.queue_notification(
            v_referrer_user,
            'Referral qualified',
            'Your referral has qualified. ₱20 is now withdrawable and the six-month first-line share period is active.',
            'referral_qualified',
            jsonb_build_object('referral_id',v_ref.referral_id,'reward_php',v_ref.one_time_reward_php)
          );
        end if;
      end if;
    end if;
  else
    v_eligible:=v_value.gross_value_php;
  end if;

  if v_ref.referral_id is not null then
    update private.buklod_pf_referrals
    set qualification_value_php=least(
      qualification_threshold_php,
      greatest(qualification_value_php,v_before+v_qualifying)
    ),updated_at=now()
    where referral_id=v_ref.referral_id;
  end if;

  if v_eligible>0 then
    v_user_share:=round(v_eligible*v_cfg.user_share_pct,2);
    if v_user_share>0 then
      insert into private.buklod_pf_cash_ledger(
        person_id,bucket,direction,amount_php,entry_type,event_key,source_value_id,referral_id,
        policy_version,description,metadata
      ) values(
        v_person.person_id,'AVAILABLE','CREDIT',v_user_share,'USER_ALLOCATION',
        'user-allocation:'||v_value.id::text,v_value.id,v_ref.referral_id,
        v_cfg.policy_version,'Finalized user allocation after qualification',
        jsonb_build_object('source_bucket','USER_ALLOCATION','eligible_value_php',v_eligible,'share_pct',v_cfg.user_share_pct)
      ) on conflict(person_id,event_key) do nothing;
    end if;

    if v_ref.referral_id is not null
       and v_ref.referral_share_started_at is not null
       and v_value.finalized_at>=v_ref.referral_share_started_at
       and v_value.finalized_at<v_ref.referral_share_ends_at then
      v_referrer_share:=round(v_eligible*v_cfg.first_line_share_pct,2);
      if v_referrer_share>0 then
        insert into private.buklod_pf_cash_ledger(
          person_id,bucket,direction,amount_php,entry_type,event_key,source_value_id,referral_id,
          policy_version,description,metadata
        ) values(
          v_ref.referrer_person_id,'AVAILABLE','CREDIT',v_referrer_share,'FIRST_LINE_SHARE',
          'first-line-share:'||v_value.id::text,v_value.id,v_ref.referral_id,
          v_cfg.policy_version,'First-line referral share during immutable six-month window',
          jsonb_build_object('source_bucket','REFERRAL_SHARE','eligible_value_php',v_eligible,'share_pct',v_cfg.first_line_share_pct)
        ) on conflict(person_id,event_key) do nothing;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'processed',true,'value_id',v_value.id,'qualifying_value_php',v_qualifying,
    'eligible_post_qualification_php',v_eligible,'user_share_php',v_user_share,
    'referrer_share_php',v_referrer_share
  );
end
$$;

create or replace function public.record_buklod_finalized_value_v2(
  p_user_id uuid,
  p_provider text,
  p_feature_key text,
  p_placement_id text,
  p_gross_value_php numeric,
  p_external_reference text,
  p_idempotency_key text,
  p_finalized_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_person uuid;
  v_row private.buklod_pf_finalized_value_ledger%rowtype;
begin
  if current_user not in ('service_role','supabase_admin') then
    raise exception 'Service role required';
  end if;
  if p_gross_value_php is null or p_gross_value_php<=0 then raise exception 'Positive finalized value required'; end if;
  if trim(coalesce(p_idempotency_key,''))='' then raise exception 'Idempotency key required'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(p_user_id);
  if v_person is null then raise exception 'Profit-First identity not linked'; end if;

  insert into private.buklod_pf_finalized_value_ledger(
    person_id,user_id_at_event,provider,feature_key,placement_id,gross_value_php,
    external_reference,idempotency_key,finalized_at,metadata
  ) values(
    v_person,p_user_id,upper(trim(p_provider)),lower(trim(p_feature_key)),nullif(trim(p_placement_id),''),
    round(p_gross_value_php,6),nullif(trim(p_external_reference),''),trim(p_idempotency_key),
    coalesce(p_finalized_at,now()),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(idempotency_key) do update
    set idempotency_key=excluded.idempotency_key
  returning * into v_row;

  return private.buklod_pf_allocate_finalized_value_v2(v_row.id);
end
$$;

create or replace function public.get_my_buklod_referral_summary_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_cfg private.buklod_pf_config%rowtype;
  v_code text;
  v_ref private.buklod_pf_referrals%rowtype;
  v_total numeric:=0;
  v_threshold numeric:=0;
  v_items jsonb;
begin
  if v_uid is null then return null; end if;
  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then
    return jsonb_build_object('identity_ready',false);
  end if;

  select * into v_cfg from private.buklod_pf_config where singleton=true;
  v_code:=private.buklod_pf_ensure_code_v2(v_person);

  select * into v_ref from private.buklod_pf_referrals where referred_person_id=v_person;

  select coalesce(sum(gross_value_php),0) into v_total
  from private.buklod_pf_finalized_value_ledger where person_id=v_person;

  v_threshold:=case when v_ref.referral_id is not null
    then v_cfg.referred_qualification_php else v_cfg.no_referrer_qualification_php end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'referral_id',r.referral_id,
    'status',r.status,
    'pending_reward_php',case when r.qualified_at is null then r.one_time_reward_php else 0 end,
    'reward_withdrawable_php',case when r.reward_withdrawable_at is not null then r.one_time_reward_php else 0 end,
    'qualification_value_php',r.qualification_value_php,
    'qualification_threshold_php',r.qualification_threshold_php,
    'qualification_pct',least(100,round(100*r.qualification_value_php/nullif(r.qualification_threshold_php,0),1)),
    'share_started_at',r.referral_share_started_at,
    'share_ends_at',r.referral_share_ends_at,
    'referred_label',coalesce(nullif(trim(p.first_name),''),'BUKLOD member')
  ) order by r.created_at desc),'[]'::jsonb)
  into v_items
  from private.buklod_pf_referrals r
  left join private.buklod_pf_persons rp on rp.person_id=r.referred_person_id
  left join public.profiles p on p.id=rp.current_user_id
  where r.referrer_person_id=v_person;

  return jsonb_build_object(
    'identity_ready',true,
    'policy_version',v_cfg.policy_version,
    'referral_code',v_code,
    'share_url','https://buklod.expo.app/register?ref='||v_code,
    'one_time_reward_php',v_cfg.one_time_referral_php,
    'referred_qualification_php',v_cfg.referred_qualification_php,
    'no_referrer_qualification_php',v_cfg.no_referrer_qualification_php,
    'user_share_pct',v_cfg.user_share_pct,
    'first_line_share_pct',v_cfg.first_line_share_pct,
    'referral_months',v_cfg.referral_months,
    'economics_enabled',v_cfg.economics_enabled,
    'withdrawal_enabled',v_cfg.withdrawal_enabled,
    'was_referred',v_ref.referral_id is not null,
    'my_qualification_value_php',least(v_total,v_threshold),
    'my_qualification_threshold_php',v_threshold,
    'my_qualification_pct',least(100,round(100*least(v_total,v_threshold)/nullif(v_threshold,0),1)),
    'my_user_share_active',(select user_share_activated_at is not null from private.buklod_pf_persons where person_id=v_person),
    'available_cash_php',greatest(private.buklod_pf_cash_balance_v2(v_person,'AVAILABLE'),0),
    'reserved_cash_php',greatest(private.buklod_pf_cash_balance_v2(v_person,'RESERVED'),0),
    'paid_cash_php',greatest(private.buklod_pf_cash_balance_v2(v_person,'PAID'),0),
    'invited_count',(select count(*) from private.buklod_pf_referrals where referrer_person_id=v_person),
    'qualified_count',(select count(*) from private.buklod_pf_referrals where referrer_person_id=v_person and qualified_at is not null),
    'referrals',v_items
  );
end
$$;

create or replace function public.record_buklod_referral_funnel_event_v2(
  p_event_type text,
  p_source text default 'APP'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_type text:=upper(trim(coalesce(p_event_type,'')));
  v_source text:=upper(trim(coalesce(p_source,'APP')));
begin
  if auth.uid() is null then return; end if;
  if v_type not in (
    'SHARE_TAP','COPY_LINK','COPY_CODE','NATIVE_SHARE_OPEN','LINK_OPEN',
    'SIGNUP_STARTED','SIGNUP_COMPLETED','ATTRIBUTED','QUALIFICATION_STARTED',
    'QUALIFIED','REWARD_WITHDRAWABLE','SIX_MONTH_SHARE_ACTIVE'
  ) then return; end if;

  insert into private.buklod_pf_referral_funnel_daily(event_date,event_type,source,event_count)
  values((now() at time zone 'Asia/Manila')::date,v_type,left(v_source,32),1)
  on conflict(event_date,event_type,source) do update
    set event_count=private.buklod_pf_referral_funnel_daily.event_count+1;
end
$$;

revoke all on function private.buklod_pf_link_identity_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.buklod_pf_link_identity_v2(uuid,jsonb) to service_role;
revoke all on function private.buklod_pf_attach_referral_v2(uuid,text) from public,anon,authenticated;
grant execute on function private.buklod_pf_attach_referral_v2(uuid,text) to service_role;
revoke all on function public.record_buklod_finalized_value_v2(uuid,text,text,text,numeric,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.record_buklod_finalized_value_v2(uuid,text,text,text,numeric,text,text,timestamptz,jsonb) to service_role;

grant execute on function public.resolve_buklod_referral_code_v2(text) to anon,authenticated;
grant execute on function public.get_my_buklod_referral_summary_v2() to authenticated;
grant execute on function public.record_buklod_referral_funnel_event_v2(text,text) to authenticated;
