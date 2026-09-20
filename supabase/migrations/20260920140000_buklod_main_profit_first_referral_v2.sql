-- BUKLOD_CANONICAL_FINANCIAL_ENGINE_V3
-- CANONICAL OVERRIDE:
--   1) Points are never money.
--   2) 30% is ONE monthly User Revenue Pool distributed by Qualified Monthly Points.
--   3) Referral is one-time PHP 20 + first-line 10% for six months only.
--   4) Community allocation is exactly one destination: Cluster 5% OR Organization 7%.
--   5) All money is centavo-safe, revenue-backed, idempotent and auditable.
-- This migration is unreleased and supersedes the earlier draft Profit-First V2 semantics.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- CENTRAL VERSIONED POLICY
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_config (
  singleton boolean primary key default true check(singleton),
  policy_version text not null default 'canonical_finance_v3',

  user_pool_bps integer not null default 3000 check(user_pool_bps between 0 and 10000),
  first_line_bps integer not null default 1000 check(first_line_bps between 0 and 10000),
  cluster_fund_bps integer not null default 500 check(cluster_fund_bps between 0 and 10000),
  organization_fund_bps integer not null default 700 check(organization_fund_bps between 0 and 10000),

  one_time_referral_centavos bigint not null default 2000 check(one_time_referral_centavos >= 0),
  referred_qualification_centavos bigint not null default 4000 check(referred_qualification_centavos >= 0),
  no_referrer_qualification_centavos bigint not null default 6000 check(no_referrer_qualification_centavos >= 0),
  referral_months integer not null default 6 check(referral_months between 1 and 24),
  manual_referral_window_days integer not null default 7 check(manual_referral_window_days between 1 and 30),

  organization_contributor_threshold integer not null default 30 check(organization_contributor_threshold >= 1),
  active_contributor_window_days integer not null default 30 check(active_contributor_window_days between 1 and 365),
  organization_grace_days integer not null default 30 check(organization_grace_days between 0 and 365),
  community_switch_lock_days integer not null default 30 check(community_switch_lock_days between 0 and 365),

  vote_quorum_bps integer not null default 2000 check(vote_quorum_bps between 0 and 10000),
  vote_approval_bps integer not null default 6000 check(vote_approval_bps between 0 and 10000),
  community_cooling_hours integer not null default 0 check(community_cooling_hours between 0 and 720),

  minimum_withdrawal_centavos bigint not null default 20000 check(minimum_withdrawal_centavos >= 0),

  qualified_point_excluded_activity_types text[] not null default array[
    'admin_bonus',
    'admin_manual_award'
  ]::text[],

  economics_enabled boolean not null default false,
  settlement_enabled boolean not null default false,
  withdrawal_enabled boolean not null default false,
  payout_processing_enabled boolean not null default false,

  rounding_residue_destination text not null default 'USER_POOL_LARGEST_REMAINDER'
    check(rounding_residue_destination in ('USER_POOL_LARGEST_REMAINDER')),

  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into private.buklod_pf_config(singleton)
values(true)
on conflict(singleton) do nothing;

-- ---------------------------------------------------------------------------
-- DURABLE PERSON IDENTITY / ANTI-RESET
-- ---------------------------------------------------------------------------
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
  signal_type text not null check(signal_type in (
    'AUTH_EMAIL','LOGIN_IDENTIFIER','MOBILE','USERNAME','NAME_BIRTH',
    'DEVICE_RISK','NETWORK_RISK'
  )),
  signal_hash text not null check(char_length(signal_hash) between 32 and 128),
  confidence text not null default 'STRONG' check(confidence in ('STRONG','SUPPORTING','RISK_ONLY')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(signal_type,signal_hash)
);
create index if not exists idx_buklod_pf_identity_person
  on private.buklod_pf_identity_signals(person_id);

-- ---------------------------------------------------------------------------
-- REFERRAL: ONE PERSON, ONE IMMUTABLE FIRST-LINE RELATIONSHIP
-- ---------------------------------------------------------------------------
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
  status text not null default 'PENDING'
    check(status in ('PENDING','QUALIFYING','QUALIFIED','WITHDRAWABLE','PAID','REVIEW','BLOCKED','REJECTED')),
  one_time_reward_centavos bigint not null check(one_time_reward_centavos >= 0),
  qualification_threshold_centavos bigint not null check(qualification_threshold_centavos >= 0),
  qualification_value_centavos bigint not null default 0 check(qualification_value_centavos >= 0),
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

create table if not exists private.buklod_pf_referral_events (
  id bigint generated always as identity primary key,
  actor_person_id uuid references private.buklod_pf_persons(person_id) on delete restrict,
  referral_id uuid references private.buklod_pf_referrals(referral_id) on delete restrict,
  event_type text not null,
  event_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.buklod_pf_referral_funnel_daily (
  event_date date not null,
  event_type text not null,
  source text not null default 'APP',
  event_count bigint not null default 0 check(event_count >= 0),
  primary key(event_date,event_type,source)
);

-- ---------------------------------------------------------------------------
-- FINALIZED USER-ATTRIBUTED PLATFORM VALUE
-- Used for qualification and monthly settlement base. Never awards points for ads.
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_finalized_value_ledger (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  user_id_at_event uuid,
  provider text not null,
  feature_key text not null,
  placement_id text,
  gross_value_centavos bigint not null check(gross_value_centavos > 0),
  qualification_value_centavos bigint not null default 0 check(qualification_value_centavos >= 0),
  post_qualification_value_centavos bigint not null default 0 check(post_qualification_value_centavos >= 0),
  external_reference text,
  idempotency_key text not null unique,
  finalized_at timestamptz not null,
  policy_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(qualification_value_centavos + post_qualification_value_centavos = gross_value_centavos)
);
create index if not exists idx_buklod_pf_value_person
  on private.buklod_pf_finalized_value_ledger(person_id,finalized_at,id);
create index if not exists idx_buklod_pf_value_finalized_at
  on private.buklod_pf_finalized_value_ledger(finalized_at,id);

-- ---------------------------------------------------------------------------
-- QUALIFICATION RESERVE CARRY
-- Cross-month qualification revenue remains reserved until qualification closes.
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_qualification_fund_ledger (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount_centavos bigint not null check(amount_centavos > 0),
  entry_type text not null check(entry_type in (
    'QUALIFICATION_REVENUE',
    'REFERRAL_REWARD_FUNDING',
    'BUKLOD_RETAINED_TRANSFER'
  )),
  event_key text not null unique,
  source_value_id uuid references private.buklod_pf_finalized_value_ledger(id) on delete restrict,
  referral_id uuid references private.buklod_pf_referrals(referral_id) on delete restrict,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_buklod_pf_qualification_fund_person
  on private.buklod_pf_qualification_fund_ledger(person_id,created_at);

create or replace function private.buklod_pf_qualification_balance_centavos_v3(
  p_person_id uuid
)
returns bigint
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  from private.buklod_pf_qualification_fund_ledger
  where person_id=p_person_id
$function$;

-- ---------------------------------------------------------------------------
-- PERSONAL CASH LEDGER. POINTS NEVER ENTER THIS TABLE.
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  bucket text not null check(bucket in ('AVAILABLE','RESERVED','PAID')),
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount_centavos bigint not null check(amount_centavos > 0),
  entry_type text not null check(entry_type in (
    'REFERRAL_ONE_TIME_REWARD',
    'USER_POOL_SETTLEMENT',
    'FIRST_LINE_SETTLEMENT',
    'WITHDRAWAL_RESERVE',
    'WITHDRAWAL_RELEASE',
    'PAYOUT_PAID',
    'ADMIN_CORRECTION'
  )),
  event_key text not null,
  source_value_id uuid references private.buklod_pf_finalized_value_ledger(id) on delete restrict,
  referral_id uuid references private.buklod_pf_referrals(referral_id) on delete restrict,
  settlement_id uuid,
  withdrawal_id uuid,
  policy_version text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(person_id,event_key)
);
create index if not exists idx_buklod_pf_cash_person_bucket
  on private.buklod_pf_cash_ledger(person_id,bucket,created_at);

-- ---------------------------------------------------------------------------
-- ONE ACTIVE COMMUNITY FUND DESTINATION PER DURABLE PERSON
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_community_designations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  locked_until timestamptz not null,
  close_reason text,
  previous_designation_id uuid references private.buklod_pf_community_designations(id) on delete restrict,
  policy_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(effective_to is null or effective_to >= effective_from)
);
create unique index if not exists idx_buklod_pf_one_active_community_destination
  on private.buklod_pf_community_designations(person_id)
  where effective_to is null;
create index if not exists idx_buklod_pf_community_designation_scope
  on private.buklod_pf_community_designations(scope_id,effective_from,effective_to);

create table if not exists private.buklod_pf_community_tiers (
  scope_id uuid primary key references public.buklod_scopes(id) on delete restrict,
  current_tier text not null check(current_tier in ('CLUSTER','ORGANIZATION')),
  active_contributor_count integer not null default 0 check(active_contributor_count >= 0),
  below_threshold_since timestamptz,
  last_evaluated_at timestamptz not null default now(),
  policy_version text not null
);

create table if not exists private.buklod_pf_community_tier_history (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
  tier text not null check(tier in ('CLUSTER','ORGANIZATION')),
  active_contributor_count integer not null default 0 check(active_contributor_count >= 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  policy_version text not null,
  created_at timestamptz not null default now(),
  check(effective_to is null or effective_to >= effective_from)
);
create unique index if not exists idx_buklod_pf_community_tier_one_open
  on private.buklod_pf_community_tier_history(scope_id)
  where effective_to is null;
create index if not exists idx_buklod_pf_community_tier_history_range
  on private.buklod_pf_community_tier_history(scope_id,effective_from,effective_to);

-- ---------------------------------------------------------------------------
-- PERIOD FINANCE / COSTS / TAX (SEPARATE FROM USER POINTS)
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_financial_entries (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check(period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  entry_type text not null check(entry_type in (
    'UNATTRIBUTED_ELIGIBLE_REVENUE',
    'REVENUE_REVERSAL',
    'OPERATING_COST',
    'INFRASTRUCTURE_COST',
    'PAYOUT_COST',
    'PAYMENT_PROCESSING_COST',
    'TAX_RESERVE',
    'OTHER_COST'
  )),
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount_centavos bigint not null check(amount_centavos >= 0),
  reconciliation_state text not null default 'ESTIMATED'
    check(reconciliation_state in ('ESTIMATED','RECONCILED','REVERSED')),
  source_system text,
  external_reference text,
  idempotency_key text not null unique,
  notes text,
  recorded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_buklod_pf_financial_entries_period
  on private.buklod_pf_financial_entries(period_key,reconciliation_state,entry_type);

-- ---------------------------------------------------------------------------
-- AUTHORITATIVE MONTHLY SETTLEMENT
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_settlements (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique check(period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'PREPARING' check(status in ('PREPARING','FINALIZED')),
  policy_version text not null,

  prequalification_revenue_centavos bigint not null default 0,
  qualification_reserve_opening_centavos bigint not null default 0,
  qualification_reserve_closing_centavos bigint not null default 0,
  one_time_referral_rewards_centavos bigint not null default 0,
  prequalification_retained_transfer_centavos bigint not null default 0,
  normal_eligible_revenue_centavos bigint not null default 0,

  user_pool_centavos bigint not null default 0,
  user_pool_distributed_centavos bigint not null default 0,
  user_pool_reserved_centavos bigint not null default 0,

  first_line_centavos bigint not null default 0,
  community_fund_centavos bigint not null default 0,
  retained_allocation_centavos bigint not null default 0,

  operating_cost_centavos bigint not null default 0,
  tax_reserve_centavos bigint not null default 0,
  estimated_final_net_centavos bigint not null default 0,

  total_qualified_monthly_points bigint not null default 0,
  rounding_residue_centavos bigint not null default 0,

  idempotency_key text not null unique,
  finalized_by uuid,
  finalized_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.buklod_pf_user_settlements (
  settlement_id uuid not null references private.buklod_pf_settlements(id) on delete restrict,
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  qualified_monthly_points bigint not null default 0 check(qualified_monthly_points >= 0),
  total_qualified_monthly_points bigint not null default 0 check(total_qualified_monthly_points >= 0),
  raw_share_numerator numeric not null default 0,
  remainder_numerator numeric not null default 0,
  user_pool_share_centavos bigint not null default 0 check(user_pool_share_centavos >= 0),
  policy_version text not null,
  created_at timestamptz not null default now(),
  primary key(settlement_id,person_id)
);

create table if not exists private.buklod_pf_referral_settlements (
  settlement_id uuid not null references private.buklod_pf_settlements(id) on delete restrict,
  referral_id uuid not null references private.buklod_pf_referrals(referral_id) on delete restrict,
  referrer_person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  referred_person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  source_revenue_centavos bigint not null default 0 check(source_revenue_centavos >= 0),
  allocation_centavos bigint not null default 0 check(allocation_centavos >= 0),
  policy_version text not null,
  created_at timestamptz not null default now(),
  primary key(settlement_id,referral_id)
);

create table if not exists private.buklod_pf_community_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references private.buklod_pf_settlements(id) on delete restrict,
  scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
  tier text not null check(tier in ('CLUSTER','ORGANIZATION')),
  active_contributor_count integer not null default 0,
  source_revenue_centavos bigint not null default 0 check(source_revenue_centavos >= 0),
  allocation_bps integer not null check(allocation_bps between 0 and 10000),
  allocation_centavos bigint not null default 0 check(allocation_centavos >= 0),
  policy_version text not null,
  created_at timestamptz not null default now(),
  unique(settlement_id,scope_id,tier)
);

create table if not exists private.buklod_pf_user_pool_reserve (
  settlement_id uuid primary key references private.buklod_pf_settlements(id) on delete restrict,
  amount_centavos bigint not null check(amount_centavos >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- COMMUNITY FUND LEDGER / MEMBER GOVERNANCE
-- ---------------------------------------------------------------------------
create table if not exists private.buklod_pf_community_fund_ledger (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
  bucket text not null check(bucket in ('AVAILABLE','RESERVED','SPENT')),
  direction text not null check(direction in ('CREDIT','DEBIT')),
  amount_centavos bigint not null check(amount_centavos > 0),
  entry_type text not null check(entry_type in (
    'SETTLEMENT_ALLOCATION',
    'REQUEST_RESERVE',
    'REQUEST_RELEASE',
    'REQUEST_CANCEL_RELEASE',
    'PROJECT_SPEND',
    'ADMIN_CORRECTION'
  )),
  event_key text not null unique,
  settlement_id uuid references private.buklod_pf_settlements(id) on delete restrict,
  request_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_buklod_pf_community_fund_scope
  on private.buklod_pf_community_fund_ledger(scope_id,bucket,created_at);

create table if not exists private.buklod_pf_community_fund_requests (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
  requested_by uuid not null,
  title text not null,
  purpose text not null,
  amount_centavos bigint not null check(amount_centavos > 0),
  project_date date,
  benefits_requester boolean not null default false,
  status text not null default 'VOTING'
    check(status in ('VOTING','APPROVED','COOLING','READY_TO_RELEASE','REJECTED','RELEASED','FAILED','CANCELLED')),
  eligible_voter_count integer not null default 0 check(eligible_voter_count >= 0),
  quorum_bps integer not null,
  approval_bps integer not null,
  cooling_until timestamptz,
  release_reference text,
  proof_url text,
  liquidation_status text not null default 'PENDING'
    check(liquidation_status in ('PENDING','SUBMITTED','VERIFIED')),
  policy_version text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_buklod_pf_fund_requests_scope
  on private.buklod_pf_community_fund_requests(scope_id,status,created_at desc);

create table if not exists private.buklod_pf_community_fund_votes (
  request_id uuid not null references private.buklod_pf_community_fund_requests(id) on delete restrict,
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  vote text not null check(vote in ('YES','NO')),
  voter_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(request_id,person_id)
);

-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------
create or replace function private.buklod_pf_config_v3()
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

create or replace function private.buklod_pf_cash_balance_centavos_v3(
  p_person_id uuid,
  p_bucket text
)
returns bigint
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(
    case when l.direction='CREDIT' then l.amount_centavos else -l.amount_centavos end
  ),0)::bigint
  from private.buklod_pf_cash_ledger l
  where l.person_id=p_person_id
    and l.bucket=upper(trim(p_bucket))
$$;

create or replace function private.buklod_pf_community_balance_centavos_v3(
  p_scope_id uuid,
  p_bucket text
)
returns bigint
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(
    case when l.direction='CREDIT' then l.amount_centavos else -l.amount_centavos end
  ),0)::bigint
  from private.buklod_pf_community_fund_ledger l
  where l.scope_id=p_scope_id
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
      return jsonb_build_object(
        'ok',false,
        'status','REVIEW_REQUIRED',
        'reason','IDENTITY_CONFLICT'
      );
    elsif v_candidate_count=1 then
      v_person:=v_candidates[1];

      select current_user_id into v_old_user
      from private.buklod_pf_persons
      where person_id=v_person
      for update;

      v_recreated:=v_old_user is not null and v_old_user<>p_user_id;

      if v_recreated then
        update private.buklod_pf_user_links
        set retired_at=coalesce(retired_at,now())
        where person_id=v_person
          and user_id<>p_user_id
          and retired_at is null;
      end if;
    else
      insert into private.buklod_pf_persons(current_user_id)
      values(p_user_id)
      returning person_id into v_person;
    end if;

    insert into private.buklod_pf_user_links(
      user_id,person_id,link_reason,metadata
    )
    values(
      p_user_id,
      v_person,
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

    if v_type not in (
      'AUTH_EMAIL','LOGIN_IDENTIFIER','MOBILE','USERNAME','NAME_BIRTH',
      'DEVICE_RISK','NETWORK_RISK'
    ) or char_length(v_hash)<32 then
      continue;
    end if;

    if v_conf not in ('STRONG','SUPPORTING','RISK_ONLY') then
      v_conf:='SUPPORTING';
    end if;

    insert into private.buklod_pf_identity_signals(
      person_id,signal_type,signal_hash,confidence,last_seen_at
    )
    values(v_person,v_type,v_hash,v_conf,now())
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

-- ---------------------------------------------------------------------------
-- REFERRAL LOOKUP / ATTRIBUTION
-- ---------------------------------------------------------------------------
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

  select coalesce(
    nullif(trim(p.first_name),''),
    split_part(trim(p.full_name),' ',1),
    'BUKLOD member'
  )
  into v_name
  from private.buklod_pf_persons person
  left join public.profiles p on p.id=person.current_user_id
  where person.person_id=v_person;

  return jsonb_build_object(
    'found',true,
    'code',v_code,
    'referrer_label',coalesce(v_name,'BUKLOD member')
  );
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
  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true
  for share;

  if v_code='' then raise exception 'Referral code required'; end if;

  select * into v_existing
  from private.buklod_pf_referrals
  where referred_person_id=p_referred_person
  for update;

  if found then
    if v_existing.original_referral_code=v_code then
      return jsonb_build_object(
        'ok',true,
        'idempotent',true,
        'referral_id',v_existing.referral_id,
        'status',v_existing.status
      );
    end if;
    raise exception 'Referrer is already locked for this person';
  end if;

  select c.person_id into v_referrer
  from public.buklod_referral_codes_v2 c
  where c.referral_code=v_code and c.is_active=true;

  if v_referrer is null then raise exception 'Referral not found'; end if;
  if v_referrer=p_referred_person then raise exception 'Self-referral is not allowed'; end if;

  if exists(
    select 1
    from private.buklod_pf_persons p
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
    referrer_person_id,
    referred_person_id,
    original_referral_code,
    status,
    one_time_reward_centavos,
    qualification_threshold_centavos,
    policy_version,
    metadata
  )
  values(
    v_referrer,
    p_referred_person,
    v_code,
    'PENDING',
    v_cfg.one_time_referral_centavos,
    v_cfg.referred_qualification_centavos,
    v_cfg.policy_version,
    jsonb_build_object('relationship_immutable',true)
  )
  returning * into v_created;

  insert into private.buklod_pf_referral_events(
    actor_person_id,referral_id,event_type,event_key,metadata
  )
  values(
    p_referred_person,
    v_created.referral_id,
    'REFERRAL_ATTRIBUTED',
    'referral-attributed:'||v_created.referral_id::text,
    jsonb_build_object(
      'pending_reward_centavos',v_created.one_time_reward_centavos
    )
  )
  on conflict(event_key) do nothing;

  insert into private.buklod_pf_referral_funnel_daily(
    event_date,event_type,source,event_count
  )
  values(
    (now() at time zone 'Asia/Manila')::date,
    'ATTRIBUTED',
    'APP',
    1
  )
  on conflict(event_date,event_type,source) do update
    set event_count=private.buklod_pf_referral_funnel_daily.event_count+1;

  select current_user_id into v_referrer_user
  from private.buklod_pf_persons
  where person_id=v_referrer;

  if v_referrer_user is not null then
    perform public.queue_notification(
      v_referrer_user,
      'Referral joined',
      'Your referral has joined BUKLOD. The one-time referral reward is pending qualification.',
      'referral_joined',
      jsonb_build_object(
        'referral_id',v_created.referral_id,
        'reward_status','PENDING'
      )
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'referral_id',v_created.referral_id,
    'status','PENDING',
    'pending_reward_php',round(v_created.one_time_reward_centavos::numeric/100,2)
  );
end
$$;

-- ---------------------------------------------------------------------------
-- COMMUNITY ACTIVE-CONTRIBUTOR / TIER ENGINE
-- ---------------------------------------------------------------------------
create or replace function private.buklod_pf_active_contributor_count_v3(
  p_scope_id uuid,
  p_at timestamptz default now()
)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select count(distinct d.person_id)::integer
  from private.buklod_pf_community_designations d
  join private.buklod_pf_persons p
    on p.person_id=d.person_id
  join public.profiles pr
    on pr.id=p.current_user_id
  join private.buklod_pf_config cfg
    on cfg.singleton=true
  where d.scope_id=p_scope_id
    and d.effective_from<=p_at
    and (d.effective_to is null or d.effective_to>p_at)
    and p.qualified_at is not null
    and p.qualified_at<=p_at
    and p.user_share_activated_at is not null
    and p.user_share_activated_at<=p_at
    and p.risk_status='CLEAR'
    and pr.is_active=true
    and pr.user_deactivated_at is null
    and p.last_seen_at>=p_at-(cfg.active_contributor_window_days||' days')::interval
$$;

create or replace function private.buklod_pf_evaluate_community_tier_v3(
  p_scope_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_cfg private.buklod_pf_config%rowtype;
  v_count integer;
  v_current private.buklod_pf_community_tiers%rowtype;
  v_next text;
  v_below timestamptz;
begin
  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true;

  select private.buklod_pf_active_contributor_count_v3(p_scope_id,p_at)
  into v_count;

  select * into v_current
  from private.buklod_pf_community_tiers
  where scope_id=p_scope_id
  for update;

  if not found then
    v_next:=case
      when v_count>=v_cfg.organization_contributor_threshold then 'ORGANIZATION'
      else 'CLUSTER'
    end;

    insert into private.buklod_pf_community_tiers(
      scope_id,current_tier,active_contributor_count,below_threshold_since,
      last_evaluated_at,policy_version
    )
    values(
      p_scope_id,
      v_next,
      v_count,
      null,
      p_at,
      v_cfg.policy_version
    );

    insert into private.buklod_pf_community_tier_history(
      scope_id,tier,active_contributor_count,effective_from,policy_version
    )
    values(
      p_scope_id,
      v_next,
      v_count,
      p_at,
      v_cfg.policy_version
    );

    return jsonb_build_object(
      'tier',v_next,
      'active_contributors',v_count,
      'changed',true
    );
  end if;

  v_next:=v_current.current_tier;
  v_below:=v_current.below_threshold_since;

  if v_count>=v_cfg.organization_contributor_threshold then
    v_next:='ORGANIZATION';
    v_below:=null;
  elsif v_current.current_tier='ORGANIZATION' then
    if v_below is null then
      v_below:=p_at;
    elsif p_at>=v_below+(v_cfg.organization_grace_days||' days')::interval then
      v_next:='CLUSTER';
      v_below:=null;
    end if;
  else
    v_next:='CLUSTER';
    v_below:=null;
  end if;

  if v_next<>v_current.current_tier then
    update private.buklod_pf_community_tier_history
    set effective_to=p_at
    where scope_id=p_scope_id
      and effective_to is null;

    insert into private.buklod_pf_community_tier_history(
      scope_id,tier,active_contributor_count,effective_from,policy_version
    )
    values(
      p_scope_id,
      v_next,
      v_count,
      p_at,
      v_cfg.policy_version
    );
  else
    update private.buklod_pf_community_tier_history
    set active_contributor_count=v_count
    where scope_id=p_scope_id
      and effective_to is null;
  end if;

  update private.buklod_pf_community_tiers
  set current_tier=v_next,
      active_contributor_count=v_count,
      below_threshold_since=v_below,
      last_evaluated_at=p_at,
      policy_version=v_cfg.policy_version
  where scope_id=p_scope_id;

  return jsonb_build_object(
    'tier',v_next,
    'active_contributors',v_count,
    'changed',v_next<>v_current.current_tier,
    'below_threshold_since',v_below
  );
end
$$;

create or replace function public.set_my_buklod_community_destination_v3(
  p_scope_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_cfg private.buklod_pf_config%rowtype;
  v_scope public.buklod_scopes%rowtype;
  v_current private.buklod_pf_community_designations%rowtype;
  v_new private.buklod_pf_community_designations%rowtype;
  v_tier jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then raise exception 'Profit-First identity is not linked'; end if;

  if not exists(
    select 1
    from private.buklod_pf_persons p
    join public.profiles pr
      on pr.id=p.current_user_id
    where p.person_id=v_person
      and p.user_share_activated_at is not null
      and p.user_share_activated_at<=now()
      and p.risk_status='CLEAR'
      and pr.is_active=true
      and pr.user_deactivated_at is null
  ) then
    raise exception 'Earning qualification is required before selecting a Community Fund destination';
  end if;

  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true;

  select * into v_scope
  from public.buklod_scopes
  where id=p_scope_id
    and status='ACTIVE';

  if not found or v_scope.scope_type not in ('CLUSTER','ORGANIZATION') then
    raise exception 'Select an active Cluster or Organization';
  end if;

  if not exists(
    select 1
    from public.buklod_scope_memberships m
    where m.scope_id=p_scope_id
      and m.user_id=v_uid
      and m.membership_status='ACTIVE'
      and m.left_at is null
  ) then
    raise exception 'Active membership in this community is required';
  end if;

  select * into v_current
  from private.buklod_pf_community_designations
  where person_id=v_person
    and effective_to is null
  for update;

  if found and v_current.scope_id=p_scope_id then
    v_tier:=private.buklod_pf_evaluate_community_tier_v3(p_scope_id,now());
    return jsonb_build_object(
      'idempotent',true,
      'designation_id',v_current.id,
      'scope_id',p_scope_id,
      'locked_until',v_current.locked_until,
      'tier',v_tier
    );
  end if;

  if found and now()<v_current.locked_until then
    raise exception 'Community destination is locked until %',v_current.locked_until;
  end if;

  if found then
    update private.buklod_pf_community_designations
    set effective_to=now(),
        close_reason='SWITCHED'
    where id=v_current.id;
  end if;

  insert into private.buklod_pf_community_designations(
    person_id,scope_id,effective_from,locked_until,previous_designation_id,
    policy_version,metadata
  )
  values(
    v_person,
    p_scope_id,
    now(),
    now()+(v_cfg.community_switch_lock_days||' days')::interval,
    case when found then v_current.id else null end,
    v_cfg.policy_version,
    jsonb_build_object('selected_by_user_id',v_uid)
  )
  returning * into v_new;

  if found then
    perform private.buklod_pf_evaluate_community_tier_v3(v_current.scope_id,now());
  end if;

  v_tier:=private.buklod_pf_evaluate_community_tier_v3(p_scope_id,now());

  return jsonb_build_object(
    'idempotent',false,
    'designation_id',v_new.id,
    'scope_id',p_scope_id,
    'locked_until',v_new.locked_until,
    'tier',v_tier
  );
end
$$;

-- ---------------------------------------------------------------------------
-- FINALIZED VALUE INGESTION: QUALIFICATION ONLY.
-- NO 30% PERSONAL CREDIT HERE. NO RECURRING 10% CREDIT HERE.
-- ---------------------------------------------------------------------------
create or replace function private.buklod_pf_allocate_finalized_value_v3(
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
  v_before bigint:=0;
  v_threshold bigint:=0;
  v_qualifying bigint:=0;
  v_post bigint:=0;
  v_now timestamptz;
  v_referrer_user uuid;
begin
  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true
  for share;

  select * into v_value
  from private.buklod_pf_finalized_value_ledger
  where id=p_value_id
  for update;

  if not found then raise exception 'Finalized value entry not found'; end if;

  select * into v_person
  from private.buklod_pf_persons
  where person_id=v_value.person_id
  for update;

  select * into v_ref
  from private.buklod_pf_referrals
  where referred_person_id=v_person.person_id
  for update;

  v_threshold:=case
    when v_ref.referral_id is not null then v_cfg.referred_qualification_centavos
    else v_cfg.no_referrer_qualification_centavos
  end;

  if v_person.user_share_activated_at is null then
    select coalesce(sum(x.qualification_value_centavos),0)::bigint
    into v_before
    from private.buklod_pf_finalized_value_ledger x
    where x.person_id=v_person.person_id
      and x.id<>v_value.id;

    v_qualifying:=greatest(
      least(v_value.gross_value_centavos,greatest(v_threshold-v_before,0)),
      0
    );
    v_post:=greatest(v_value.gross_value_centavos-v_qualifying,0);

    update private.buklod_pf_finalized_value_ledger
    set qualification_value_centavos=v_qualifying,
        post_qualification_value_centavos=v_post
    where id=v_value.id;

    if v_qualifying>0 then
      insert into private.buklod_pf_qualification_fund_ledger(
        person_id,direction,amount_centavos,entry_type,event_key,
        source_value_id,policy_version,created_at
      )
      values(
        v_person.person_id,
        'CREDIT',
        v_qualifying,
        'QUALIFICATION_REVENUE',
        'qualification-revenue:'||v_value.id::text,
        v_value.id,
        v_cfg.policy_version,
        v_value.finalized_at
      )
      on conflict(event_key) do nothing;
    end if;

    if v_before+v_qualifying>=v_threshold then
      v_now:=v_value.finalized_at;

      update private.buklod_pf_persons
      set qualified_at=coalesce(qualified_at,v_now),
          qualification_kind=coalesce(
            qualification_kind,
            case when v_ref.referral_id is not null then 'REFERRED' else 'NO_REFERRER' end
          ),
          user_share_activated_at=coalesce(user_share_activated_at,v_now),
          last_seen_at=greatest(last_seen_at,v_now)
      where person_id=v_person.person_id;

      if v_ref.referral_id is not null and v_ref.qualified_at is null then
        update private.buklod_pf_referrals
        set status='WITHDRAWABLE',
            qualification_value_centavos=v_threshold,
            qualified_at=v_now,
            reward_withdrawable_at=v_now,
            referral_share_started_at=v_now,
            referral_share_ends_at=v_now+make_interval(months=>v_cfg.referral_months),
            updated_at=now()
        where referral_id=v_ref.referral_id
        returning * into v_ref;

        if private.buklod_pf_qualification_balance_centavos_v3(
          v_person.person_id
        )<v_ref.one_time_reward_centavos then
          raise exception 'Qualification reserve is insufficient for the referral reward';
        end if;

        insert into private.buklod_pf_qualification_fund_ledger(
          person_id,direction,amount_centavos,entry_type,event_key,
          source_value_id,referral_id,policy_version,created_at
        )
        values(
          v_person.person_id,
          'DEBIT',
          v_ref.one_time_reward_centavos,
          'REFERRAL_REWARD_FUNDING',
          'qualification-referral-funding:'||v_ref.referral_id::text,
          v_value.id,
          v_ref.referral_id,
          v_cfg.policy_version,
          v_value.finalized_at
        )
        on conflict(event_key) do nothing;

        insert into private.buklod_pf_cash_ledger(
          person_id,bucket,direction,amount_centavos,entry_type,event_key,
          source_value_id,referral_id,policy_version,description,metadata,created_at
        )
        values(
          v_ref.referrer_person_id,
          'AVAILABLE',
          'CREDIT',
          v_ref.one_time_reward_centavos,
          'REFERRAL_ONE_TIME_REWARD',
          'referral-one-time:'||v_ref.referral_id::text,
          v_value.id,
          v_ref.referral_id,
          v_cfg.policy_version,
          'One-time qualified first-line referral reward',
          jsonb_build_object('qualification_revenue_backed',true),
          v_value.finalized_at
        )
        on conflict(person_id,event_key) do nothing;

        insert into private.buklod_pf_referral_events(
          actor_person_id,referral_id,event_type,event_key,metadata
        )
        values(
          v_ref.referrer_person_id,
          v_ref.referral_id,
          'QUALIFIED',
          'referral-qualified:'||v_ref.referral_id::text,
          jsonb_build_object(
            'reward_centavos',v_ref.one_time_reward_centavos,
            'share_started_at',v_ref.referral_share_started_at,
            'share_ends_at',v_ref.referral_share_ends_at
          )
        )
        on conflict(event_key) do nothing;

        select current_user_id into v_referrer_user
        from private.buklod_pf_persons
        where person_id=v_ref.referrer_person_id;

        if v_referrer_user is not null then
          perform public.queue_notification(
            v_referrer_user,
            'Referral qualified',
            'Your one-time referral reward is now withdrawable. The six-month first-line share period is active.',
            'referral_qualified',
            jsonb_build_object(
              'referral_id',v_ref.referral_id,
              'reward_php',round(v_ref.one_time_reward_centavos::numeric/100,2)
            )
          );
        end if;
      end if;

      if private.buklod_pf_qualification_balance_centavos_v3(v_person.person_id)>0 then
        insert into private.buklod_pf_qualification_fund_ledger(
          person_id,direction,amount_centavos,entry_type,event_key,
          source_value_id,referral_id,policy_version,created_at
        )
        values(
          v_person.person_id,
          'DEBIT',
          private.buklod_pf_qualification_balance_centavos_v3(v_person.person_id),
          'BUKLOD_RETAINED_TRANSFER',
          'qualification-retained-transfer:'||v_person.person_id::text,
          v_value.id,
          v_ref.referral_id,
          v_cfg.policy_version,
          v_value.finalized_at
        )
        on conflict(event_key) do nothing;
      end if;
    elsif v_ref.referral_id is not null then
      update private.buklod_pf_referrals
      set status='QUALIFYING',
          qualification_value_centavos=least(
            qualification_threshold_centavos,
            v_before+v_qualifying
          ),
          updated_at=now()
      where referral_id=v_ref.referral_id;
    end if;
  else
    v_qualifying:=0;
    v_post:=v_value.gross_value_centavos;

    update private.buklod_pf_finalized_value_ledger
    set qualification_value_centavos=0,
        post_qualification_value_centavos=v_post
    where id=v_value.id;
  end if;

  return jsonb_build_object(
    'processed',true,
    'value_id',v_value.id,
    'qualification_value_php',round(v_qualifying::numeric/100,2),
    'post_qualification_value_php',round(v_post::numeric/100,2),
    'user_pool_cash_credited_now',false,
    'first_line_cash_credited_now',false,
    'monthly_settlement_required',true
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
  v_cfg private.buklod_pf_config%rowtype;
  v_row private.buklod_pf_finalized_value_ledger%rowtype;
  v_centavos bigint;
begin
  if coalesce(p_gross_value_php,0)<=0 then
    raise exception 'Positive finalized value required';
  end if;

  if trim(coalesce(p_idempotency_key,''))='' then
    raise exception 'Idempotency key required';
  end if;

  v_person:=private.buklod_pf_person_for_user_v2(p_user_id);
  if v_person is null then raise exception 'Profit-First identity not linked'; end if;

  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true;

  v_centavos:=round(p_gross_value_php*100)::bigint;
  if v_centavos<=0 then raise exception 'Finalized value is below one centavo'; end if;

  insert into private.buklod_pf_finalized_value_ledger(
    person_id,user_id_at_event,provider,feature_key,placement_id,
    gross_value_centavos,qualification_value_centavos,post_qualification_value_centavos,
    external_reference,idempotency_key,finalized_at,policy_version,metadata
  )
  values(
    v_person,
    p_user_id,
    upper(trim(p_provider)),
    lower(trim(p_feature_key)),
    nullif(trim(p_placement_id),''),
    v_centavos,
    v_centavos,
    0,
    nullif(trim(p_external_reference),''),
    trim(p_idempotency_key),
    coalesce(p_finalized_at,now()),
    v_cfg.policy_version,
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(idempotency_key) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from private.buklod_pf_finalized_value_ledger
    where idempotency_key=trim(p_idempotency_key);

    if v_row.person_id<>v_person
       or v_row.gross_value_centavos<>v_centavos
       or v_row.provider<>upper(trim(p_provider))
       or v_row.feature_key<>lower(trim(p_feature_key)) then
      raise exception 'Idempotency key was already used for a different finalized revenue event';
    end if;

    return jsonb_build_object(
      'processed',true,
      'idempotent_replay',true,
      'value_id',v_row.id,
      'qualification_value_php',round(v_row.qualification_value_centavos::numeric/100,2),
      'post_qualification_value_php',round(v_row.post_qualification_value_centavos::numeric/100,2),
      'user_pool_cash_credited_now',false,
      'first_line_cash_credited_now',false,
      'monthly_settlement_required',true
    );
  end if;

  return private.buklod_pf_allocate_finalized_value_v3(v_row.id)
    || jsonb_build_object('idempotent_replay',false);
end
$$;

-- ---------------------------------------------------------------------------
-- MONTHLY QUALIFIED POINTS
-- ---------------------------------------------------------------------------
create or replace function private.buklod_pf_monthly_points_v3(
  p_person_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns bigint
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(l.points),0)::bigint
  from public.buklod_points_ledger l
  join private.buklod_pf_user_links ul
    on ul.user_id=l.user_id
   and ul.person_id=p_person_id
  join public.buklod_point_rules pr
    on pr.activity_type=l.activity_type
   and pr.is_active=true
  join private.buklod_pf_persons p
    on p.person_id=p_person_id
  join private.buklod_pf_config cfg
    on cfg.singleton=true
  where l.direction='credit'
    and l.points>0
    and l.created_at>=greatest(p_start,coalesce(p.user_share_activated_at,p_end))
    and l.created_at<p_end
    and not (l.activity_type=any(cfg.qualified_point_excluded_activity_types))
    and lower(l.activity_type) not like '%ad%'
$$;

-- ---------------------------------------------------------------------------
-- PERIOD INPUTS: UNATTRIBUTED REVENUE + COSTS + TAX
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_buklod_pf_financial_entry_v3(
  p_period_key text,
  p_entry_type text,
  p_direction text,
  p_amount_php numeric,
  p_reconciliation_state text,
  p_source_system text,
  p_external_reference text,
  p_idempotency_key text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_type text:=upper(trim(coalesce(p_entry_type,'')));
  v_direction text:=upper(trim(coalesce(p_direction,'')));
  v_state text:=upper(trim(coalesce(p_reconciliation_state,'')));
  v_amount bigint;
  v_row private.buklod_pf_financial_entries%rowtype;
begin
  if v_actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if trim(coalesce(p_period_key,'')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Period key must be YYYY-MM';
  end if;

  if v_type not in (
    'UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL','OPERATING_COST',
    'INFRASTRUCTURE_COST','PAYOUT_COST','PAYMENT_PROCESSING_COST',
    'TAX_RESERVE','OTHER_COST'
  ) then
    raise exception 'Invalid entry type';
  end if;

  if v_direction not in ('CREDIT','DEBIT') then raise exception 'Invalid direction'; end if;
  if v_state not in ('ESTIMATED','RECONCILED','REVERSED') then raise exception 'Invalid reconciliation state'; end if;

  v_amount:=round(coalesce(p_amount_php,0)*100)::bigint;
  if v_amount<0 then raise exception 'Amount cannot be negative'; end if;
  if trim(coalesce(p_idempotency_key,''))='' then raise exception 'Idempotency key required'; end if;

  insert into private.buklod_pf_financial_entries(
    period_key,entry_type,direction,amount_centavos,reconciliation_state,
    source_system,external_reference,idempotency_key,notes,recorded_by
  )
  values(
    p_period_key,v_type,v_direction,v_amount,v_state,
    nullif(trim(coalesce(p_source_system,'')),''),
    nullif(trim(coalesce(p_external_reference,'')),''),
    trim(p_idempotency_key),
    nullif(trim(coalesce(p_notes,'')),''),
    v_actor
  )
  on conflict(idempotency_key) do update
    set idempotency_key=excluded.idempotency_key
  returning * into v_row;

  return to_jsonb(v_row);
end
$$;

-- ---------------------------------------------------------------------------
-- AUTHORITATIVE IDEMPOTENT MONTHLY SETTLEMENT
-- ---------------------------------------------------------------------------
create or replace function public.admin_finalize_buklod_pf_month_v3(
  p_period_key text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_start_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_settlement private.buklod_pf_settlements%rowtype;

  v_prequal bigint:=0;
  v_qual_reserve_open bigint:=0;
  v_qual_reserve_close bigint:=0;
  v_one_time bigint:=0;
  v_prequal_retained bigint:=0;
  v_postqual bigint:=0;
  v_unattributed bigint:=0;
  v_normal bigint:=0;

  v_user_pool bigint:=0;
  v_total_points bigint:=0;
  v_user_distributed bigint:=0;
  v_user_reserve bigint:=0;
  v_user_residue bigint:=0;

  v_first_line bigint:=0;
  v_community bigint:=0;
  v_retained bigint:=0;

  v_operating bigint:=0;
  v_tax bigint:=0;
  v_net bigint:=0;

  v_row record;
  v_residue bigint;
begin
  if v_actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if trim(coalesce(p_period_key,'')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Period key must be YYYY-MM';
  end if;

  if trim(coalesce(p_idempotency_key,''))='' then
    raise exception 'Idempotency key required';
  end if;

  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true
  for share;

  if not v_cfg.economics_enabled or not v_cfg.settlement_enabled then
    raise exception 'Canonical financial settlement is disabled';
  end if;

  v_start_date:=to_date(p_period_key||'-01','YYYY-MM-DD');
  if to_char(v_start_date,'YYYY-MM')<>p_period_key then
    raise exception 'Invalid period key';
  end if;

  v_start:=v_start_date::timestamp at time zone 'Asia/Manila';
  v_end:=(v_start_date+interval '1 month')::timestamp at time zone 'Asia/Manila';

  insert into private.buklod_pf_settlements(
    period_key,period_start,period_end,status,policy_version,idempotency_key,finalized_by
  )
  values(
    p_period_key,v_start,v_end,'PREPARING',v_cfg.policy_version,trim(p_idempotency_key),v_actor
  )
  on conflict(period_key) do nothing;

  select * into v_settlement
  from private.buklod_pf_settlements
  where period_key=p_period_key
  for update;

  if v_settlement.status='FINALIZED' then
    return jsonb_build_object(
      'idempotent_replay',true,
      'settlement',to_jsonb(v_settlement)
    );
  end if;

  if v_settlement.idempotency_key<>trim(p_idempotency_key) then
    raise exception 'Period is already being prepared under a different idempotency key';
  end if;

  delete from private.buklod_pf_user_settlements where settlement_id=v_settlement.id;
  delete from private.buklod_pf_referral_settlements where settlement_id=v_settlement.id;
  delete from private.buklod_pf_community_settlements where settlement_id=v_settlement.id;
  delete from private.buklod_pf_user_pool_reserve where settlement_id=v_settlement.id;

  select coalesce(sum(qualification_value_centavos),0)::bigint,
         coalesce(sum(post_qualification_value_centavos),0)::bigint
  into v_prequal,v_postqual
  from private.buklod_pf_finalized_value_ledger
  where finalized_at>=v_start
    and finalized_at<v_end;

  select coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_qual_reserve_open
  from private.buklod_pf_qualification_fund_ledger
  where created_at<v_start;

  select coalesce(sum(amount_centavos),0)::bigint
  into v_one_time
  from private.buklod_pf_qualification_fund_ledger
  where entry_type='REFERRAL_REWARD_FUNDING'
    and direction='DEBIT'
    and created_at>=v_start
    and created_at<v_end;

  select coalesce(sum(amount_centavos),0)::bigint
  into v_prequal_retained
  from private.buklod_pf_qualification_fund_ledger
  where entry_type='BUKLOD_RETAINED_TRANSFER'
    and direction='DEBIT'
    and created_at>=v_start
    and created_at<v_end;

  select coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_qual_reserve_close
  from private.buklod_pf_qualification_fund_ledger
  where created_at<v_end;

  select coalesce(sum(
    case
      when direction='CREDIT' then amount_centavos
      else -amount_centavos
    end
  ),0)::bigint
  into v_unattributed
  from private.buklod_pf_financial_entries
  where period_key=p_period_key
    and reconciliation_state='RECONCILED'
    and entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL');

  if v_unattributed<0 then
    raise exception 'Unattributed eligible revenue cannot be negative';
  end if;

  v_normal:=v_postqual+v_unattributed;
  v_user_pool:=floor(v_normal::numeric*v_cfg.user_pool_bps/10000)::bigint;

  -- Resolve a period-end tier only when immutable history does not already
  -- cover the period. Never rewrite an existing historical tier from today's clock.
  for v_row in
    select distinct d.scope_id
    from private.buklod_pf_community_designations d
    where d.effective_from<v_end
      and (d.effective_to is null or d.effective_to>v_start)
      and not exists(
        select 1
        from private.buklod_pf_community_tier_history h
        where h.scope_id=d.scope_id
          and h.effective_from<=v_end-interval '1 microsecond'
          and (h.effective_to is null or h.effective_to>v_end-interval '1 microsecond')
      )
  loop
    perform private.buklod_pf_evaluate_community_tier_v3(
      v_row.scope_id,
      v_end-interval '1 microsecond'
    );
  end loop;

  -- Qualified Monthly Points are weights only. They never create cash.
  insert into private.buklod_pf_user_settlements(
    settlement_id,person_id,qualified_monthly_points,total_qualified_monthly_points,
    raw_share_numerator,remainder_numerator,user_pool_share_centavos,policy_version
  )
  select
    v_settlement.id,
    p.person_id,
    private.buklod_pf_monthly_points_v3(p.person_id,v_start,v_end),
    0,
    0,
    0,
    0,
    v_cfg.policy_version
  from private.buklod_pf_persons p
  where p.user_share_activated_at is not null
    and p.user_share_activated_at<v_end
    and p.risk_status='CLEAR';

  select coalesce(sum(qualified_monthly_points),0)::bigint
  into v_total_points
  from private.buklod_pf_user_settlements
  where settlement_id=v_settlement.id;

  if v_user_pool>0 and v_total_points>0 then
    update private.buklod_pf_user_settlements u
    set total_qualified_monthly_points=v_total_points,
        raw_share_numerator=(v_user_pool::numeric*u.qualified_monthly_points::numeric),
        user_pool_share_centavos=floor(
          (v_user_pool::numeric*u.qualified_monthly_points::numeric)
          /v_total_points::numeric
        )::bigint,
        remainder_numerator=mod(
          (v_user_pool::numeric*u.qualified_monthly_points::numeric),
          v_total_points::numeric
        )
    where u.settlement_id=v_settlement.id
      and u.qualified_monthly_points>0;

    select coalesce(sum(user_pool_share_centavos),0)::bigint
    into v_user_distributed
    from private.buklod_pf_user_settlements
    where settlement_id=v_settlement.id;

    v_residue:=v_user_pool-v_user_distributed;

    if v_residue>0 then
      with ranked as (
        select person_id,
               row_number() over(
                 order by remainder_numerator desc,person_id
               ) as rn
        from private.buklod_pf_user_settlements
        where settlement_id=v_settlement.id
          and qualified_monthly_points>0
      )
      update private.buklod_pf_user_settlements u
      set user_pool_share_centavos=u.user_pool_share_centavos+1
      from ranked r
      where u.settlement_id=v_settlement.id
        and u.person_id=r.person_id
        and r.rn<=v_residue;
    end if;

    select coalesce(sum(user_pool_share_centavos),0)::bigint
    into v_user_distributed
    from private.buklod_pf_user_settlements
    where settlement_id=v_settlement.id;

    if v_user_distributed<>v_user_pool then
      raise exception 'User pool allocation does not reconcile';
    end if;

    insert into private.buklod_pf_cash_ledger(
      person_id,bucket,direction,amount_centavos,entry_type,event_key,
      settlement_id,policy_version,description,metadata
    )
    select
      person_id,
      'AVAILABLE',
      'CREDIT',
      user_pool_share_centavos,
      'USER_POOL_SETTLEMENT',
      'user-pool-settlement:'||v_settlement.id::text||':'||person_id::text,
      v_settlement.id,
      v_cfg.policy_version,
      'Monthly 30% User Revenue Pool share distributed by Qualified Monthly Points',
      jsonb_build_object(
        'qualified_monthly_points',qualified_monthly_points,
        'total_qualified_monthly_points',v_total_points
      )
    from private.buklod_pf_user_settlements
    where settlement_id=v_settlement.id
      and user_pool_share_centavos>0
    on conflict(person_id,event_key) do nothing;
  elsif v_user_pool>0 then
    v_user_reserve:=v_user_pool;

    insert into private.buklod_pf_user_pool_reserve(
      settlement_id,amount_centavos,reason
    )
    values(
      v_settlement.id,
      v_user_pool,
      'No qualified monthly points were available. User Pool held as an undistributed reserve.'
    );
  end if;

  -- First-line only: 10% of the referred person's post-qualification revenue
  -- that falls inside the immutable six-month window.
  insert into private.buklod_pf_referral_settlements(
    settlement_id,referral_id,referrer_person_id,referred_person_id,
    source_revenue_centavos,allocation_centavos,policy_version
  )
  select
    v_settlement.id,
    r.referral_id,
    r.referrer_person_id,
    r.referred_person_id,
    coalesce(sum(v.post_qualification_value_centavos),0)::bigint,
    floor(
      coalesce(sum(v.post_qualification_value_centavos),0)::numeric
      *v_cfg.first_line_bps/10000
    )::bigint,
    v_cfg.policy_version
  from private.buklod_pf_referrals r
  join private.buklod_pf_finalized_value_ledger v
    on v.person_id=r.referred_person_id
   and v.finalized_at>=v_start
   and v.finalized_at<v_end
   and v.post_qualification_value_centavos>0
   and r.referral_share_started_at is not null
   and v.finalized_at>=r.referral_share_started_at
   and v.finalized_at<r.referral_share_ends_at
  group by
    r.referral_id,r.referrer_person_id,r.referred_person_id;

  select coalesce(sum(allocation_centavos),0)::bigint
  into v_first_line
  from private.buklod_pf_referral_settlements
  where settlement_id=v_settlement.id;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_centavos,entry_type,event_key,
    referral_id,settlement_id,policy_version,description,metadata
  )
  select
    rs.referrer_person_id,
    'AVAILABLE',
    'CREDIT',
    rs.allocation_centavos,
    'FIRST_LINE_SETTLEMENT',
    'first-line-settlement:'||rs.settlement_id::text||':'||rs.referral_id::text,
    rs.referral_id,
    rs.settlement_id,
    rs.policy_version,
    'First-line referral share for the active six-month period',
    jsonb_build_object(
      'source_revenue_centavos',rs.source_revenue_centavos,
      'first_line_bps',v_cfg.first_line_bps
    )
  from private.buklod_pf_referral_settlements rs
  where rs.settlement_id=v_settlement.id
    and rs.allocation_centavos>0
  on conflict(person_id,event_key) do nothing;

  -- Exactly one community destination per person and one tier per event timestamp.
  insert into private.buklod_pf_community_settlements(
    settlement_id,scope_id,tier,active_contributor_count,
    source_revenue_centavos,allocation_bps,allocation_centavos,policy_version
  )
  select
    v_settlement.id,
    d.scope_id,
    h.tier,
    max(h.active_contributor_count),
    sum(v.post_qualification_value_centavos)::bigint,
    case when h.tier='ORGANIZATION'
      then v_cfg.organization_fund_bps
      else v_cfg.cluster_fund_bps
    end,
    floor(
      sum(v.post_qualification_value_centavos)::numeric
      *case when h.tier='ORGANIZATION'
        then v_cfg.organization_fund_bps
        else v_cfg.cluster_fund_bps
      end
      /10000
    )::bigint,
    v_cfg.policy_version
  from private.buklod_pf_finalized_value_ledger v
  join private.buklod_pf_community_designations d
    on d.person_id=v.person_id
   and d.effective_from<=v.finalized_at
   and (d.effective_to is null or d.effective_to>v.finalized_at)
  join private.buklod_pf_community_tier_history h
    on h.scope_id=d.scope_id
   and h.effective_from<=v.finalized_at
   and (h.effective_to is null or h.effective_to>v.finalized_at)
  where v.finalized_at>=v_start
    and v.finalized_at<v_end
    and v.post_qualification_value_centavos>0
  group by d.scope_id,h.tier;

  select coalesce(sum(allocation_centavos),0)::bigint
  into v_community
  from private.buklod_pf_community_settlements
  where settlement_id=v_settlement.id;

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    settlement_id,description,metadata
  )
  select
    cs.scope_id,
    'AVAILABLE',
    'CREDIT',
    cs.allocation_centavos,
    'SETTLEMENT_ALLOCATION',
    'community-settlement:'||cs.id::text,
    cs.settlement_id,
    'Bayanihan Community Fund allocation',
    jsonb_build_object(
      'tier',cs.tier,
      'active_contributors',cs.active_contributor_count,
      'allocation_bps',cs.allocation_bps
    )
  from private.buklod_pf_community_settlements cs
  where cs.settlement_id=v_settlement.id
    and cs.allocation_centavos>0
  on conflict(event_key) do nothing;

  select coalesce(sum(
    case when direction='DEBIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_operating
  from private.buklod_pf_financial_entries
  where period_key=p_period_key
    and reconciliation_state='RECONCILED'
    and entry_type in (
      'OPERATING_COST','INFRASTRUCTURE_COST','PAYOUT_COST',
      'PAYMENT_PROCESSING_COST','OTHER_COST'
    );

  select coalesce(sum(
    case when direction='DEBIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_tax
  from private.buklod_pf_financial_entries
  where period_key=p_period_key
    and reconciliation_state='RECONCILED'
    and entry_type='TAX_RESERVE';

  if v_qual_reserve_open+v_prequal
     <>v_one_time+v_prequal_retained+v_qual_reserve_close then
    raise exception 'Profit guard failed: qualification reserve does not reconcile';
  end if;

  v_retained:=
    v_prequal_retained
    +(v_normal-v_user_pool-v_first_line-v_community);

  if v_normal<v_user_pool+v_first_line+v_community then
    raise exception 'Profit guard failed: normal allocations exceed eligible finalized revenue';
  end if;

  if v_retained<0 then
    raise exception 'Profit guard failed: negative BUKLOD retained allocation';
  end if;

  v_net:=v_retained-v_operating-v_tax;

  if v_net<0 then
    raise exception 'Profit guard failed: operating costs and tax reserve exceed BUKLOD retained allocation';
  end if;

  if v_user_pool>0 and v_total_points>0 and v_user_distributed<>v_user_pool then
    raise exception 'Profit guard failed: User Pool does not reconcile';
  end if;

  v_user_residue:=v_user_pool-v_user_distributed-v_user_reserve;
  if v_user_residue<>0 then
    raise exception 'Profit guard failed: unexplained User Pool rounding residue';
  end if;

  update private.buklod_pf_settlements
  set status='FINALIZED',
      prequalification_revenue_centavos=v_prequal,
      qualification_reserve_opening_centavos=v_qual_reserve_open,
      qualification_reserve_closing_centavos=v_qual_reserve_close,
      one_time_referral_rewards_centavos=v_one_time,
      prequalification_retained_transfer_centavos=v_prequal_retained,
      normal_eligible_revenue_centavos=v_normal,
      user_pool_centavos=v_user_pool,
      user_pool_distributed_centavos=v_user_distributed,
      user_pool_reserved_centavos=v_user_reserve,
      first_line_centavos=v_first_line,
      community_fund_centavos=v_community,
      retained_allocation_centavos=v_retained,
      operating_cost_centavos=v_operating,
      tax_reserve_centavos=v_tax,
      estimated_final_net_centavos=v_net,
      total_qualified_monthly_points=v_total_points,
      rounding_residue_centavos=0,
      finalized_by=v_actor,
      finalized_at=now(),
      metadata=jsonb_build_object(
        'points_are_money',false,
        'user_pool_is_monthly_shared_pool',true,
        'first_line_only',true,
        'community_5_or_7_never_both',true,
        'centavo_safe',true,
        'profit_guard_passed',true
      )
  where id=v_settlement.id
  returning * into v_settlement;

  return jsonb_build_object(
    'idempotent_replay',false,
    'settlement',to_jsonb(v_settlement)
  );
end
$$;

-- ---------------------------------------------------------------------------
-- COMMUNITY GOVERNANCE
-- ---------------------------------------------------------------------------
create or replace function private.buklod_pf_is_eligible_community_voter_v3(
  p_person_id uuid,
  p_scope_id uuid,
  p_excluded_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from private.buklod_pf_community_designations d
    join private.buklod_pf_persons p
      on p.person_id=d.person_id
    join public.profiles pr
      on pr.id=p.current_user_id
    join private.buklod_pf_config cfg
      on cfg.singleton=true
    where d.person_id=p_person_id
      and d.scope_id=p_scope_id
      and d.effective_to is null
      and p.qualified_at is not null
      and p.qualified_at<=now()
      and p.user_share_activated_at is not null
      and p.user_share_activated_at<=now()
      and p.risk_status='CLEAR'
      and pr.is_active=true
      and pr.user_deactivated_at is null
      and p.last_seen_at>=now()-(cfg.active_contributor_window_days||' days')::interval
      and (p_excluded_user_id is null or p.current_user_id<>p_excluded_user_id)
  )
$$;

create or replace function public.create_buklod_community_fund_request_v3(
  p_scope_id uuid,
  p_title text,
  p_purpose text,
  p_amount_php numeric,
  p_project_date date,
  p_benefits_requester boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_amount bigint;
  v_available bigint;
  v_eligible integer;
  v_row private.buklod_pf_community_fund_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.buklod_actor_can_manage_scope_v1(p_scope_id) then
    raise exception 'Scope admin permission required';
  end if;

  if not exists(
    select 1 from public.buklod_scopes
    where id=p_scope_id
      and status='ACTIVE'
      and scope_type in ('CLUSTER','ORGANIZATION')
  ) then
    raise exception 'Active Cluster or Organization required';
  end if;

  if trim(coalesce(p_title,''))='' or trim(coalesce(p_purpose,''))='' then
    raise exception 'Project title and purpose are required';
  end if;

  v_amount:=round(coalesce(p_amount_php,0)*100)::bigint;
  if v_amount<=0 then raise exception 'Positive request amount required'; end if;

  select * into v_cfg from private.buklod_pf_config where singleton=true;
  v_available:=greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'AVAILABLE'),0);

  if v_amount>v_available then
    raise exception 'Community Fund balance is insufficient';
  end if;

  select count(*)::integer
  into v_eligible
  from private.buklod_pf_persons p
  where private.buklod_pf_is_eligible_community_voter_v3(
    p.person_id,
    p_scope_id,
    case when coalesce(p_benefits_requester,false) then v_uid else null end
  );

  insert into private.buklod_pf_community_fund_requests(
    scope_id,requested_by,title,purpose,amount_centavos,project_date,
    benefits_requester,status,eligible_voter_count,quorum_bps,approval_bps,
    policy_version
  )
  values(
    p_scope_id,
    v_uid,
    left(trim(p_title),180),
    left(trim(p_purpose),2000),
    v_amount,
    p_project_date,
    coalesce(p_benefits_requester,false),
    'VOTING',
    v_eligible,
    v_cfg.vote_quorum_bps,
    v_cfg.vote_approval_bps,
    v_cfg.policy_version
  )
  returning * into v_row;

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    request_id,description,metadata
  )
  values(
    p_scope_id,
    'AVAILABLE',
    'DEBIT',
    v_amount,
    'REQUEST_RESERVE',
    'fund-request-available:'||v_row.id::text,
    v_row.id,
    'Reserve Community Fund for member-governed request',
    jsonb_build_object('title',v_row.title)
  );

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    request_id,description,metadata
  )
  values(
    p_scope_id,
    'RESERVED',
    'CREDIT',
    v_amount,
    'REQUEST_RESERVE',
    'fund-request-reserved:'||v_row.id::text,
    v_row.id,
    'Reserved Community Fund for member-governed request',
    jsonb_build_object('title',v_row.title)
  );

  return to_jsonb(v_row);
end
$$;

create or replace function public.vote_buklod_community_fund_request_v3(
  p_request_id uuid,
  p_vote text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_vote text:=upper(trim(coalesce(p_vote,'')));
  v_request private.buklod_pf_community_fund_requests%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_vote not in ('YES','NO') then raise exception 'Vote must be YES or NO'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then raise exception 'Profit-First identity is not linked'; end if;

  select * into v_request
  from private.buklod_pf_community_fund_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Fund request not found'; end if;
  if v_request.status<>'VOTING' then raise exception 'Voting is closed'; end if;

  if not private.buklod_pf_is_eligible_community_voter_v3(
    v_person,
    v_request.scope_id,
    case when v_request.benefits_requester then v_request.requested_by else null end
  ) then
    raise exception 'You are not an eligible voter for this Community Fund request';
  end if;

  insert into private.buklod_pf_community_fund_votes(
    request_id,person_id,vote,voter_user_id
  )
  values(p_request_id,v_person,v_vote,v_uid)
  on conflict(request_id,person_id) do update
    set vote=excluded.vote,
        voter_user_id=excluded.voter_user_id,
        updated_at=now();

  return jsonb_build_object(
    'request_id',p_request_id,
    'vote',v_vote,
    'saved',true
  );
end
$$;

create or replace function public.close_buklod_community_fund_vote_v3(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_request private.buklod_pf_community_fund_requests%rowtype;
  v_yes integer:=0;
  v_no integer:=0;
  v_participating integer:=0;
  v_quorum_required integer:=0;
  v_pass boolean:=false;
  v_status text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_request
  from private.buklod_pf_community_fund_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Fund request not found'; end if;
  if not public.buklod_actor_can_manage_scope_v1(v_request.scope_id) then
    raise exception 'Scope admin permission required';
  end if;
  if v_request.status<>'VOTING' then
    return to_jsonb(v_request);
  end if;

  select * into v_cfg from private.buklod_pf_config where singleton=true;

  select
    count(*) filter(where vote='YES')::integer,
    count(*) filter(where vote='NO')::integer
  into v_yes,v_no
  from private.buklod_pf_community_fund_votes
  where request_id=p_request_id;

  v_participating:=v_yes+v_no;
  v_quorum_required:=ceil(
    v_request.eligible_voter_count::numeric*v_request.quorum_bps/10000
  )::integer;

  v_pass:=
    v_participating>=v_quorum_required
    and v_participating>0
    and (v_yes::numeric*10000)>=
      (v_participating::numeric*v_request.approval_bps);

  if v_pass then
    v_status:=case
      when v_cfg.community_cooling_hours>0 then 'COOLING'
      else 'READY_TO_RELEASE'
    end;

    update private.buklod_pf_community_fund_requests
    set status=v_status,
        cooling_until=case
          when v_cfg.community_cooling_hours>0
            then now()+(v_cfg.community_cooling_hours||' hours')::interval
          else now()
        end,
        closed_at=now(),
        updated_at=now()
    where id=p_request_id
    returning * into v_request;
  else
    update private.buklod_pf_community_fund_requests
    set status='REJECTED',
        closed_at=now(),
        updated_at=now()
    where id=p_request_id
    returning * into v_request;

    insert into private.buklod_pf_community_fund_ledger(
      scope_id,bucket,direction,amount_centavos,entry_type,event_key,
      request_id,description
    )
    values(
      v_request.scope_id,
      'RESERVED',
      'DEBIT',
      v_request.amount_centavos,
      'REQUEST_CANCEL_RELEASE',
      'fund-request-reject-reserved:'||v_request.id::text,
      v_request.id,
      'Release rejected Community Fund reserve'
    )
    on conflict(event_key) do nothing;

    insert into private.buklod_pf_community_fund_ledger(
      scope_id,bucket,direction,amount_centavos,entry_type,event_key,
      request_id,description
    )
    values(
      v_request.scope_id,
      'AVAILABLE',
      'CREDIT',
      v_request.amount_centavos,
      'REQUEST_CANCEL_RELEASE',
      'fund-request-reject-available:'||v_request.id::text,
      v_request.id,
      'Return rejected Community Fund request to available balance'
    )
    on conflict(event_key) do nothing;
  end if;

  return jsonb_build_object(
    'request',to_jsonb(v_request),
    'yes_votes',v_yes,
    'no_votes',v_no,
    'participating',v_participating,
    'quorum_required',v_quorum_required,
    'passed',v_pass
  );
end
$$;

create or replace function public.release_buklod_community_fund_request_v3(
  p_request_id uuid,
  p_release_reference text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_request private.buklod_pf_community_fund_requests%rowtype;
  v_reference text:=nullif(left(trim(coalesce(p_release_reference,'')),180),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_request
  from private.buklod_pf_community_fund_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Fund request not found'; end if;
  if not public.buklod_actor_can_manage_scope_v1(v_request.scope_id) then
    raise exception 'Scope admin permission required';
  end if;
  if v_reference is null then raise exception 'Release reference is required'; end if;

  if v_request.status='COOLING'
     and v_request.cooling_until is not null
     and now()>=v_request.cooling_until then
    update private.buklod_pf_community_fund_requests
    set status='READY_TO_RELEASE',
        updated_at=now()
    where id=v_request.id
    returning * into v_request;
  end if;

  if v_request.status='RELEASED' then
    return jsonb_build_object('idempotent_replay',true,'request',to_jsonb(v_request));
  end if;

  if v_request.status<>'READY_TO_RELEASE' then
    raise exception 'Fund request is not ready for release';
  end if;

  if private.buklod_pf_community_balance_centavos_v3(
    v_request.scope_id,'RESERVED'
  )<v_request.amount_centavos then
    raise exception 'Reserved Community Fund is insufficient';
  end if;

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    request_id,description,metadata
  )
  values(
    v_request.scope_id,
    'RESERVED',
    'DEBIT',
    v_request.amount_centavos,
    'PROJECT_SPEND',
    'fund-request-spend-reserved:'||v_request.id::text,
    v_request.id,
    'Consume approved Community Fund reserve',
    jsonb_build_object('release_reference',v_reference)
  )
  on conflict(event_key) do nothing;

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    request_id,description,metadata
  )
  values(
    v_request.scope_id,
    'SPENT',
    'CREDIT',
    v_request.amount_centavos,
    'PROJECT_SPEND',
    'fund-request-spend-history:'||v_request.id::text,
    v_request.id,
    'Released approved Community Fund project amount',
    jsonb_build_object('release_reference',v_reference)
  )
  on conflict(event_key) do nothing;

  update private.buklod_pf_community_fund_requests
  set status='RELEASED',
      release_reference=v_reference,
      released_at=now(),
      updated_at=now()
  where id=v_request.id
  returning * into v_request;

  return jsonb_build_object(
    'idempotent_replay',false,
    'request',to_jsonb(v_request)
  );
end
$$;

create or replace function public.submit_buklod_community_fund_proof_v3(
  p_request_id uuid,
  p_proof_url text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_request private.buklod_pf_community_fund_requests%rowtype;
  v_url text:=nullif(left(trim(coalesce(p_proof_url,'')),1000),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_url is null then raise exception 'Proof URL is required'; end if;

  select * into v_request
  from private.buklod_pf_community_fund_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Fund request not found'; end if;
  if not public.buklod_actor_can_manage_scope_v1(v_request.scope_id) then
    raise exception 'Scope admin permission required';
  end if;
  if v_request.status<>'RELEASED' then
    raise exception 'Proof may be submitted only after release';
  end if;

  update private.buklod_pf_community_fund_requests
  set proof_url=v_url,
      liquidation_status='SUBMITTED',
      updated_at=now()
  where id=v_request.id
  returning * into v_request;

  return to_jsonb(v_request);
end
$$;

-- ---------------------------------------------------------------------------
-- USER SUMMARY: PROGRESS / EARNINGS / REFERRAL / COMMUNITY SEPARATED
-- ---------------------------------------------------------------------------
create or replace function public.get_my_buklod_financial_summary_v3()
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
  v_now timestamptz:=now();
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_points bigint:=0;
  v_total_points bigint:=0;
  v_current_revenue bigint:=0;
  v_est_pool bigint:=0;
  v_est_share bigint:=0;
  v_lifetime bigint:=0;
  v_ref private.buklod_pf_referrals%rowtype;
  v_referrals jsonb;
  v_designation private.buklod_pf_community_designations%rowtype;
  v_scope_name text;
  v_tier text;
  v_active_count integer:=0;
  v_latest_user_share bigint:=0;
  v_available bigint:=0;
  v_reserved bigint:=0;
  v_paid bigint:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then
    return jsonb_build_object('identity_ready',false);
  end if;

  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true;

  v_month_start:=date_trunc('month',v_now at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  v_month_end:=(date_trunc('month',v_now at time zone 'Asia/Manila')+interval '1 month') at time zone 'Asia/Manila';

  select coalesce(b.lifetime_points,0)::bigint
  into v_lifetime
  from public.buklod_user_points_balances b
  where b.user_id=v_uid;

  v_points:=private.buklod_pf_monthly_points_v3(v_person,v_month_start,v_month_end);

  select coalesce(sum(
    private.buklod_pf_monthly_points_v3(
      p.person_id,v_month_start,v_month_end
    )
  ),0)::bigint
  into v_total_points
  from private.buklod_pf_persons p
  where p.user_share_activated_at is not null
    and p.user_share_activated_at<v_month_end
    and p.risk_status='CLEAR';

  select coalesce(sum(post_qualification_value_centavos),0)::bigint
  into v_current_revenue
  from private.buklod_pf_finalized_value_ledger
  where finalized_at>=v_month_start
    and finalized_at<v_month_end;

  select v_current_revenue+coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_current_revenue
  from private.buklod_pf_financial_entries
  where period_key=to_char(v_month_start at time zone 'Asia/Manila','YYYY-MM')
    and reconciliation_state='RECONCILED'
    and entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL');

  v_current_revenue:=greatest(v_current_revenue,0);
  v_est_pool:=floor(v_current_revenue::numeric*v_cfg.user_pool_bps/10000)::bigint;

  if v_total_points>0 and v_points>0 then
    v_est_share:=floor(v_est_pool::numeric*v_points::numeric/v_total_points::numeric)::bigint;
  end if;

  select * into v_ref
  from private.buklod_pf_referrals
  where referred_person_id=v_person;

  select coalesce(jsonb_agg(jsonb_build_object(
    'referral_id',r.referral_id,
    'status',r.status,
    'pending_reward_php',case
      when r.reward_withdrawable_at is null then round(r.one_time_reward_centavos::numeric/100,2)
      else 0
    end,
    'reward_withdrawable_php',case
      when r.reward_withdrawable_at is not null then round(r.one_time_reward_centavos::numeric/100,2)
      else 0
    end,
    'qualification_value_php',round(r.qualification_value_centavos::numeric/100,2),
    'qualification_threshold_php',round(r.qualification_threshold_centavos::numeric/100,2),
    'qualification_pct',least(
      100,
      round(
        100*r.qualification_value_centavos::numeric
        /nullif(r.qualification_threshold_centavos,0),
        1
      )
    ),
    'share_started_at',r.referral_share_started_at,
    'share_ends_at',r.referral_share_ends_at,
    'referred_label',coalesce(nullif(trim(p.first_name),''),'BUKLOD member')
  ) order by r.created_at desc),'[]'::jsonb)
  into v_referrals
  from private.buklod_pf_referrals r
  left join private.buklod_pf_persons rp
    on rp.person_id=r.referred_person_id
  left join public.profiles p
    on p.id=rp.current_user_id
  where r.referrer_person_id=v_person;

  select * into v_designation
  from private.buklod_pf_community_designations
  where person_id=v_person
    and effective_to is null;

  if found then
    select s.name into v_scope_name
    from public.buklod_scopes s
    where s.id=v_designation.scope_id;

    select current_tier,active_contributor_count
    into v_tier,v_active_count
    from private.buklod_pf_community_tiers
    where scope_id=v_designation.scope_id;
  end if;

  select coalesce(us.user_pool_share_centavos,0)::bigint
  into v_latest_user_share
  from private.buklod_pf_user_settlements us
  join private.buklod_pf_settlements st
    on st.id=us.settlement_id
  where us.person_id=v_person
    and st.status='FINALIZED'
  order by st.period_end desc
  limit 1;

  v_available:=greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'AVAILABLE'),0);
  v_reserved:=greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'RESERVED'),0);
  v_paid:=greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'PAID'),0);

  return jsonb_build_object(
    'identity_ready',true,
    'policy_version',v_cfg.policy_version,

    'progress',jsonb_build_object(
      'lifetime_points',v_lifetime,
      'qualified_monthly_points',v_points,
      'total_qualified_monthly_points',v_total_points
    ),

    'earnings',jsonb_build_object(
      'estimated_pool_share_pct',case
        when v_total_points>0 then round(100*v_points::numeric/v_total_points::numeric,4)
        else 0
      end,
      'estimated_user_pool_php',round(v_est_pool::numeric/100,2),
      'estimated_earnings_php',round(v_est_share::numeric/100,2),
      'latest_finalized_user_share_php',round(v_latest_user_share::numeric/100,2),
      'withdrawable_php',round(v_available::numeric/100,2),
      'reserved_php',round(v_reserved::numeric/100,2),
      'paid_php',round(v_paid::numeric/100,2),
      'user_pool_eligibility_active',(
        select user_share_activated_at is not null
        from private.buklod_pf_persons
        where person_id=v_person
      )
    ),

    'referral',jsonb_build_object(
      'referral_code',private.buklod_pf_ensure_code_v2(v_person),
      'share_url','https://buklod.expo.app/register?ref='||private.buklod_pf_ensure_code_v2(v_person),
      'one_time_reward_php',round(v_cfg.one_time_referral_centavos::numeric/100,2),
      'referred_qualification_php',round(v_cfg.referred_qualification_centavos::numeric/100,2),
      'no_referrer_qualification_php',round(v_cfg.no_referrer_qualification_centavos::numeric/100,2),
      'first_line_pct',v_cfg.first_line_bps::numeric/100,
      'referral_months',v_cfg.referral_months,
      'was_referred',v_ref.referral_id is not null,
      'invited_count',(select count(*) from private.buklod_pf_referrals where referrer_person_id=v_person),
      'qualified_count',(select count(*) from private.buklod_pf_referrals where referrer_person_id=v_person and qualified_at is not null),
      'items',v_referrals
    ),

    'community',case
      when v_designation.id is null then jsonb_build_object(
        'selected',false
      )
      else jsonb_build_object(
        'selected',true,
        'scope_id',v_designation.scope_id,
        'scope_name',v_scope_name,
        'tier',coalesce(v_tier,'CLUSTER'),
        'allocation_pct',case
          when coalesce(v_tier,'CLUSTER')='ORGANIZATION'
            then v_cfg.organization_fund_bps::numeric/100
          else v_cfg.cluster_fund_bps::numeric/100
        end,
        'active_contributors',v_active_count,
        'organization_threshold',v_cfg.organization_contributor_threshold,
        'locked_until',v_designation.locked_until,
        'available_fund_php',round(
          greatest(
            private.buklod_pf_community_balance_centavos_v3(v_designation.scope_id,'AVAILABLE'),
            0
          )::numeric/100,
          2
        ),
        'reserved_fund_php',round(
          greatest(
            private.buklod_pf_community_balance_centavos_v3(v_designation.scope_id,'RESERVED'),
            0
          )::numeric/100,
          2
        ),
        'spent_fund_php',round(
          greatest(
            private.buklod_pf_community_balance_centavos_v3(v_designation.scope_id,'SPENT'),
            0
          )::numeric/100,
          2
        )
      )
    end
  );
end
$$;

-- Compatibility summary used by the existing referral card while UI migrates.
create or replace function public.get_my_buklod_referral_summary_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_full jsonb;
begin
  v_full:=public.get_my_buklod_financial_summary_v3();

  if coalesce((v_full->>'identity_ready')::boolean,false)=false then
    return v_full;
  end if;

  return jsonb_build_object(
    'identity_ready',true,
    'policy_version',v_full->>'policy_version',
    'referral_code',v_full->'referral'->>'referral_code',
    'share_url',v_full->'referral'->>'share_url',
    'one_time_reward_php',(v_full->'referral'->>'one_time_reward_php')::numeric,
    'referred_qualification_php',(v_full->'referral'->>'referred_qualification_php')::numeric,
    'no_referrer_qualification_php',(v_full->'referral'->>'no_referrer_qualification_php')::numeric,
    'user_share_pct',30,
    'first_line_share_pct',(v_full->'referral'->>'first_line_pct')::numeric,
    'referral_months',(v_full->'referral'->>'referral_months')::integer,
    'economics_enabled',(select economics_enabled from private.buklod_pf_config where singleton=true),
    'withdrawal_enabled',(select withdrawal_enabled from private.buklod_pf_config where singleton=true),
    'was_referred',(v_full->'referral'->>'was_referred')::boolean,
    'my_qualification_value_php',case
      when (v_full->'referral'->>'was_referred')::boolean then
        coalesce((select round(qualification_value_centavos::numeric/100,2)
          from private.buklod_pf_referrals
          where referred_person_id=private.buklod_pf_person_for_user_v2(auth.uid())),0)
      else
        coalesce((select round(least(
          (select coalesce(sum(qualification_value_centavos),0)
           from private.buklod_pf_finalized_value_ledger
           where person_id=private.buklod_pf_person_for_user_v2(auth.uid())),
          (select no_referrer_qualification_centavos from private.buklod_pf_config where singleton=true)
        )::numeric/100,2)),0)
    end,
    'my_qualification_threshold_php',case
      when (v_full->'referral'->>'was_referred')::boolean
        then (v_full->'referral'->>'referred_qualification_php')::numeric
      else (v_full->'referral'->>'no_referrer_qualification_php')::numeric
    end,
    'my_qualification_pct',case
      when (v_full->'earnings'->>'user_pool_eligibility_active')::boolean then 100
      else 0
    end,
    'my_user_share_active',(v_full->'earnings'->>'user_pool_eligibility_active')::boolean,
    'available_cash_php',(v_full->'earnings'->>'withdrawable_php')::numeric,
    'reserved_cash_php',(v_full->'earnings'->>'reserved_php')::numeric,
    'paid_cash_php',(v_full->'earnings'->>'paid_php')::numeric,
    'invited_count',(v_full->'referral'->>'invited_count')::integer,
    'qualified_count',(v_full->'referral'->>'qualified_count')::integer,
    'referrals',v_full->'referral'->'items'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- ADMIN / COMMUNITY REPORTS
-- ---------------------------------------------------------------------------
create or replace function public.get_my_buklod_community_fund_v3(
  p_scope_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_tier text;
  v_count integer:=0;
  v_requests jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then raise exception 'Profit-First identity is not linked'; end if;

  if not exists(
    select 1
    from private.buklod_pf_community_designations d
    where d.person_id=v_person
      and d.scope_id=p_scope_id
      and d.effective_to is null
  ) and not public.buklod_actor_can_manage_scope_v1(p_scope_id) then
    raise exception 'Community Fund access requires an active designation or scope admin authority';
  end if;

  select current_tier,active_contributor_count
  into v_tier,v_count
  from private.buklod_pf_community_tiers
  where scope_id=p_scope_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'title',r.title,
    'purpose',r.purpose,
    'amount_php',round(r.amount_centavos::numeric/100,2),
    'project_date',r.project_date,
    'status',r.status,
    'benefits_requester',r.benefits_requester,
    'eligible_voter_count',r.eligible_voter_count,
    'yes_votes',(select count(*) from private.buklod_pf_community_fund_votes v where v.request_id=r.id and v.vote='YES'),
    'no_votes',(select count(*) from private.buklod_pf_community_fund_votes v where v.request_id=r.id and v.vote='NO'),
    'quorum_pct',r.quorum_bps::numeric/100,
    'approval_pct',r.approval_bps::numeric/100,
    'released_at',r.released_at,
    'proof_url',r.proof_url,
    'liquidation_status',r.liquidation_status
  ) order by r.created_at desc),'[]'::jsonb)
  into v_requests
  from private.buklod_pf_community_fund_requests r
  where r.scope_id=p_scope_id;

  return jsonb_build_object(
    'scope_id',p_scope_id,
    'tier',coalesce(v_tier,'CLUSTER'),
    'active_contributors',v_count,
    'available_php',round(
      greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'AVAILABLE'),0)::numeric/100,2
    ),
    'reserved_php',round(
      greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'RESERVED'),0)::numeric/100,2
    ),
    'spent_php',round(
      greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'SPENT'),0)::numeric/100,2
    ),
    'requests',v_requests
  );
end
$$;

create or replace function public.admin_get_buklod_pf_financial_report_v3(
  p_period_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_settlement private.buklod_pf_settlements%rowtype;
begin
  if v_uid is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if nullif(trim(coalesce(p_period_key,'')),'') is null then
    select * into v_settlement
    from private.buklod_pf_settlements
    order by period_start desc
    limit 1;
  else
    select * into v_settlement
    from private.buklod_pf_settlements
    where period_key=p_period_key;
  end if;

  return jsonb_build_object(
    'policy',jsonb_build_object(
      'version',(select policy_version from private.buklod_pf_config where singleton=true),
      'user_pool_pct',(select user_pool_bps::numeric/100 from private.buklod_pf_config where singleton=true),
      'first_line_pct',(select first_line_bps::numeric/100 from private.buklod_pf_config where singleton=true),
      'cluster_pct',(select cluster_fund_bps::numeric/100 from private.buklod_pf_config where singleton=true),
      'organization_pct',(select organization_fund_bps::numeric/100 from private.buklod_pf_config where singleton=true),
      'organization_threshold',(select organization_contributor_threshold from private.buklod_pf_config where singleton=true)
    ),
    'settlement',case when v_settlement.id is null then null else jsonb_build_object(
      'id',v_settlement.id,
      'period_key',v_settlement.period_key,
      'status',v_settlement.status,
      'prequalification_revenue_php',round(v_settlement.prequalification_revenue_centavos::numeric/100,2),
      'qualification_reserve_opening_php',round(v_settlement.qualification_reserve_opening_centavos::numeric/100,2),
      'qualification_reserve_closing_php',round(v_settlement.qualification_reserve_closing_centavos::numeric/100,2),
      'one_time_referral_rewards_php',round(v_settlement.one_time_referral_rewards_centavos::numeric/100,2),
      'prequalification_retained_transfer_php',round(v_settlement.prequalification_retained_transfer_centavos::numeric/100,2),
      'normal_eligible_revenue_php',round(v_settlement.normal_eligible_revenue_centavos::numeric/100,2),
      'user_pool_php',round(v_settlement.user_pool_centavos::numeric/100,2),
      'user_pool_distributed_php',round(v_settlement.user_pool_distributed_centavos::numeric/100,2),
      'user_pool_reserved_php',round(v_settlement.user_pool_reserved_centavos::numeric/100,2),
      'first_line_php',round(v_settlement.first_line_centavos::numeric/100,2),
      'community_fund_php',round(v_settlement.community_fund_centavos::numeric/100,2),
      'buklod_retained_php',round(v_settlement.retained_allocation_centavos::numeric/100,2),
      'operating_cost_php',round(v_settlement.operating_cost_centavos::numeric/100,2),
      'tax_reserve_php',round(v_settlement.tax_reserve_centavos::numeric/100,2),
      'estimated_final_net_php',round(v_settlement.estimated_final_net_centavos::numeric/100,2),
      'qualified_monthly_points',v_settlement.total_qualified_monthly_points,
      'finalized_at',v_settlement.finalized_at,
      'policy_version',v_settlement.policy_version
    ) end,
    'user_shares',coalesce((
      select jsonb_agg(jsonb_build_object(
        'person_id',u.person_id,
        'qualified_monthly_points',u.qualified_monthly_points,
        'share_php',round(u.user_pool_share_centavos::numeric/100,2)
      ) order by u.user_pool_share_centavos desc)
      from private.buklod_pf_user_settlements u
      where u.settlement_id=v_settlement.id
    ),'[]'::jsonb),
    'community_allocations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope_id',c.scope_id,
        'tier',c.tier,
        'active_contributors',c.active_contributor_count,
        'source_revenue_php',round(c.source_revenue_centavos::numeric/100,2),
        'allocation_pct',c.allocation_bps::numeric/100,
        'allocation_php',round(c.allocation_centavos::numeric/100,2)
      ) order by c.allocation_centavos desc)
      from private.buklod_pf_community_settlements c
      where c.settlement_id=v_settlement.id
    ),'[]'::jsonb)
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
  ) then
    return;
  end if;

  insert into private.buklod_pf_referral_funnel_daily(
    event_date,event_type,source,event_count
  )
  values(
    (now() at time zone 'Asia/Manila')::date,
    v_type,
    left(v_source,32),
    1
  )
  on conflict(event_date,event_type,source) do update
    set event_count=private.buklod_pf_referral_funnel_daily.event_count+1;
end
$$;

-- ---------------------------------------------------------------------------
-- SERVICE-ONLY WRAPPERS FOR THE REFERRAL EDGE FUNCTION
-- ---------------------------------------------------------------------------
create or replace function public.buklod_pf_link_identity_service_v2(
  p_user_id uuid,
  p_signals jsonb
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.buklod_pf_link_identity_v2(p_user_id,p_signals)
$$;

create or replace function public.buklod_pf_attach_referral_service_v2(
  p_referred_person uuid,
  p_referral_code text
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.buklod_pf_attach_referral_v2(p_referred_person,p_referral_code)
$$;

-- ---------------------------------------------------------------------------
-- LEGACY R38 MONEY CREATION IS SUPERSEDED.
-- Keep historical reports, but block conflicting finalization/minting paths.
-- ---------------------------------------------------------------------------
create or replace function public.admin_finalize_buklod_r38_economic_period_v1(
  p_period_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'R38 financial finalization is superseded by admin_finalize_buklod_pf_month_v3';
end
$$;

create or replace function public.request_my_buklod_r38_referral_withdrawal_v1(
  p_payout_method text,
  p_payout_profile_ref text,
  p_destination_masked text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'Legacy R38 withdrawal is superseded by canonical Profit-First payout';
end
$$;

-- ---------------------------------------------------------------------------
-- PRIVILEGES
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_buklod_referral_code_v2(text)
  from public,anon,authenticated;
grant execute on function public.resolve_buklod_referral_code_v2(text)
  to anon,authenticated;

revoke all on function public.get_my_buklod_referral_summary_v2()
  from public,anon,authenticated;
grant execute on function public.get_my_buklod_referral_summary_v2()
  to authenticated;

revoke all on function public.get_my_buklod_financial_summary_v3()
  from public,anon,authenticated;
grant execute on function public.get_my_buklod_financial_summary_v3()
  to authenticated;

revoke all on function public.set_my_buklod_community_destination_v3(uuid)
  from public,anon,authenticated;
grant execute on function public.set_my_buklod_community_destination_v3(uuid)
  to authenticated;

revoke all on function public.get_my_buklod_community_fund_v3(uuid)
  from public,anon,authenticated;
grant execute on function public.get_my_buklod_community_fund_v3(uuid)
  to authenticated;

revoke all on function public.create_buklod_community_fund_request_v3(uuid,text,text,numeric,date,boolean)
  from public,anon,authenticated;
grant execute on function public.create_buklod_community_fund_request_v3(uuid,text,text,numeric,date,boolean)
  to authenticated;

revoke all on function public.vote_buklod_community_fund_request_v3(uuid,text)
  from public,anon,authenticated;
grant execute on function public.vote_buklod_community_fund_request_v3(uuid,text)
  to authenticated;

revoke all on function public.close_buklod_community_fund_vote_v3(uuid)
  from public,anon,authenticated;
grant execute on function public.close_buklod_community_fund_vote_v3(uuid)
  to authenticated;

revoke all on function public.release_buklod_community_fund_request_v3(uuid,text)
  from public,anon,authenticated;
grant execute on function public.release_buklod_community_fund_request_v3(uuid,text)
  to authenticated;

revoke all on function public.submit_buklod_community_fund_proof_v3(uuid,text)
  from public,anon,authenticated;
grant execute on function public.submit_buklod_community_fund_proof_v3(uuid,text)
  to authenticated;

revoke all on function public.record_buklod_referral_funnel_event_v2(text,text)
  from public,anon,authenticated;
grant execute on function public.record_buklod_referral_funnel_event_v2(text,text)
  to authenticated;

revoke all on function public.admin_record_buklod_pf_financial_entry_v3(
  text,text,text,numeric,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.admin_record_buklod_pf_financial_entry_v3(
  text,text,text,numeric,text,text,text,text,text
) to authenticated;

revoke all on function public.admin_finalize_buklod_pf_month_v3(text,text)
  from public,anon,authenticated;
grant execute on function public.admin_finalize_buklod_pf_month_v3(text,text)
  to authenticated;

revoke all on function public.admin_get_buklod_pf_financial_report_v3(text)
  from public,anon,authenticated;
grant execute on function public.admin_get_buklod_pf_financial_report_v3(text)
  to authenticated;

revoke all on function public.buklod_pf_link_identity_service_v2(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.buklod_pf_link_identity_service_v2(uuid,jsonb)
  to service_role;

revoke all on function public.buklod_pf_attach_referral_service_v2(uuid,text)
  from public,anon,authenticated;
grant execute on function public.buklod_pf_attach_referral_service_v2(uuid,text)
  to service_role;

revoke all on function public.record_buklod_finalized_value_v2(
  uuid,text,text,text,numeric,text,text,timestamptz,jsonb
) from public,anon,authenticated;
grant execute on function public.record_buklod_finalized_value_v2(
  uuid,text,text,text,numeric,text,text,timestamptz,jsonb
) to service_role;

-- Direct private-table access remains unavailable to app roles.
revoke all on all tables in schema private from anon,authenticated;
