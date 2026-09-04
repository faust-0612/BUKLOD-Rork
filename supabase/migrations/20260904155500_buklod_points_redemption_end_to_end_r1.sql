-- BUKLOD Points Redemption End-to-End R1
-- Permanent lifetime points, spendable available points, real Bayanihan transfer,
-- cash reward request/approval/paid lifecycle, and auditable history.

create table if not exists public.buklod_points_redemption_config (
  singleton boolean primary key default true,
  bayanihan_enabled boolean not null default true,
  bayanihan_units_per_point numeric(12,4) not null default 1,
  cash_reward_enabled boolean not null default false,
  cash_php_per_point numeric(12,4),
  cash_min_points integer not null default 1,
  cash_max_points integer,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint buklod_points_redemption_config_singleton_check check (singleton = true),
  constraint buklod_points_redemption_config_bayanihan_rate_check check (bayanihan_units_per_point > 0),
  constraint buklod_points_redemption_config_cash_rate_check check (cash_php_per_point is null or cash_php_per_point > 0),
  constraint buklod_points_redemption_config_cash_min_check check (cash_min_points >= 1),
  constraint buklod_points_redemption_config_cash_max_check check (
    cash_max_points is null or cash_max_points >= cash_min_points
  )
);

insert into public.buklod_points_redemption_config (
  singleton,
  bayanihan_enabled,
  bayanihan_units_per_point,
  cash_reward_enabled,
  cash_php_per_point,
  cash_min_points,
  cash_max_points
)
values (true, true, 1, false, null, 1, null)
on conflict (singleton) do nothing;

create table if not exists public.buklod_points_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  redemption_type text not null,
  points_spent integer not null,
  conversion_rate numeric(12,4) not null,
  destination_amount numeric(18,4) not null,
  destination_unit text not null,
  status text not null,
  client_request_key text not null default gen_random_uuid()::text,
  payout_method text,
  payout_account text,
  points_ledger_id uuid references public.buklod_points_ledger(id) on delete set null,
  bayanihan_ledger_id uuid references public.bayanihan_ledger(id) on delete set null,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  payout_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_points_redemptions_type_check check (
    redemption_type in ('bayanihan','cash_reward')
  ),
  constraint buklod_points_redemptions_points_check check (points_spent > 0),
  constraint buklod_points_redemptions_rate_check check (conversion_rate > 0),
  constraint buklod_points_redemptions_amount_check check (destination_amount > 0),
  constraint buklod_points_redemptions_unit_check check (
    destination_unit in ('BAYANIHAN_CREDIT','PHP')
  ),
  constraint buklod_points_redemptions_status_check check (
    status in ('pending','approved','completed','paid','rejected','cancelled')
  ),
  constraint buklod_points_redemptions_destination_check check (
    (redemption_type = 'bayanihan' and destination_unit = 'BAYANIHAN_CREDIT')
    or
    (redemption_type = 'cash_reward' and destination_unit = 'PHP')
  ),
  constraint buklod_points_redemptions_user_request_key_key unique (
    user_id,
    client_request_key
  )
);

create index if not exists buklod_points_redemptions_user_created_idx
  on public.buklod_points_redemptions (user_id, created_at desc);

create index if not exists buklod_points_redemptions_cash_status_created_idx
  on public.buklod_points_redemptions (status, created_at)
  where redemption_type = 'cash_reward';

alter table public.buklod_points_redemption_config enable row level security;
alter table public.buklod_points_redemptions enable row level security;

revoke all on table public.buklod_points_redemption_config from anon, authenticated;
revoke all on table public.buklod_points_redemptions from anon, authenticated;

create or replace function public.buklod_points_cash_reserved_for(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.points_spent),0)::bigint
  from public.buklod_points_redemptions r
  where r.user_id = p_user_id
    and r.redemption_type = 'cash_reward'
    and r.status in ('pending','approved');
$$;

revoke all on function public.buklod_points_cash_reserved_for(uuid) from public, anon, authenticated;

create or replace function public.get_my_buklod_redemption_center_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.buklod_points_redemption_config%rowtype;
  v_lifetime bigint := 0;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_history jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select *
  into cfg
  from public.buklod_points_redemption_config
  where singleton = true;

  v_lifetime := public.buklod_lifetime_points_for(uid);
  v_available := public.buklod_available_points_for(uid);
  v_reserved := public.buklod_points_cash_reserved_for(uid);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'redemption_type', x.redemption_type,
        'points_spent', x.points_spent,
        'conversion_rate', x.conversion_rate,
        'destination_amount', x.destination_amount,
        'destination_unit', x.destination_unit,
        'status', x.status,
        'payout_method', x.payout_method,
        'payout_account', x.payout_account,
        'admin_note', x.admin_note,
        'payout_reference', x.payout_reference,
        'reviewed_at', x.reviewed_at,
        'fulfilled_at', x.fulfilled_at,
        'created_at', x.created_at
      )
      order by x.created_at desc
    ),
    '[]'::jsonb
  )
  into v_history
  from (
    select r.*
    from public.buklod_points_redemptions r
    where r.user_id = uid
    order by r.created_at desc
    limit 30
  ) x;

  return jsonb_build_object(
    'lifetime_points', v_lifetime,
    'available_points', v_available,
    'reserved_points', v_reserved,
    'spendable_points', greatest(v_available - v_reserved, 0),
    'bayanihan', jsonb_build_object(
      'enabled', coalesce(cfg.bayanihan_enabled, true),
      'units_per_point', coalesce(cfg.bayanihan_units_per_point, 1)
    ),
    'cash_reward', jsonb_build_object(
      'enabled',
        coalesce(cfg.cash_reward_enabled, false)
        and cfg.cash_php_per_point is not null
        and cfg.cash_php_per_point > 0,
      'php_per_point', cfg.cash_php_per_point,
      'min_points', coalesce(cfg.cash_min_points, 1),
      'max_points', cfg.cash_max_points
    ),
    'history', v_history
  );
end;
$$;

revoke all on function public.get_my_buklod_redemption_center_v1() from public, anon;
grant execute on function public.get_my_buklod_redemption_center_v1() to authenticated;

create or replace function public.convert_my_buklod_points_to_bayanihan_v1(
  p_points integer,
  p_request_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.buklod_points_redemption_config%rowtype;
  v_key text;
  v_existing public.buklod_points_redemptions%rowtype;
  v_lifetime bigint := 0;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_rate numeric := 1;
  v_amount numeric := 0;
  v_redemption_id uuid;
  v_points_ledger_id uuid;
  v_bayanihan_ledger_id uuid;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_points, 0) <= 0 then
    raise exception 'Points must be greater than zero';
  end if;

  v_key := nullif(left(trim(coalesce(p_request_key, '')), 120), '');
  if v_key is null then
    v_key := gen_random_uuid()::text;
  end if;

  select *
  into v_existing
  from public.buklod_points_redemptions r
  where r.user_id = uid
    and r.client_request_key = v_key;

  if found then
    return jsonb_build_object(
      'redemption_id', v_existing.id,
      'redemption_type', v_existing.redemption_type,
      'status', v_existing.status,
      'points_spent', v_existing.points_spent,
      'destination_amount', v_existing.destination_amount,
      'destination_unit', v_existing.destination_unit,
      'lifetime_points', public.buklod_lifetime_points_for(uid),
      'available_points', public.buklod_available_points_for(uid),
      'idempotent_replay', true
    );
  end if;

  select *
  into cfg
  from public.buklod_points_redemption_config
  where singleton = true;

  if not coalesce(cfg.bayanihan_enabled, true) then
    raise exception 'BUKLOD Bayanihan point transfer is currently disabled';
  end if;

  v_rate := coalesce(cfg.bayanihan_units_per_point, 1);
  if v_rate <= 0 then
    raise exception 'Invalid Bayanihan conversion rate';
  end if;

  select
    b.lifetime_points,
    b.available_points
  into
    v_lifetime,
    v_available
  from public.buklod_user_points_balances b
  where b.user_id = uid
  for update;

  if not found then
    raise exception 'No claimed BUKLOD Points balance is available';
  end if;

  v_reserved := public.buklod_points_cash_reserved_for(uid);

  if greatest(v_available - v_reserved, 0) < p_points then
    raise exception 'Insufficient spendable points after active cash reward reservations';
  end if;

  v_amount := p_points * v_rate;

  insert into public.buklod_points_redemptions (
    user_id,
    redemption_type,
    points_spent,
    conversion_rate,
    destination_amount,
    destination_unit,
    status,
    client_request_key,
    fulfilled_at
  )
  values (
    uid,
    'bayanihan',
    p_points,
    v_rate,
    v_amount,
    'BAYANIHAN_CREDIT',
    'completed',
    v_key,
    now()
  )
  returning id into v_redemption_id;

  insert into public.buklod_points_ledger (
    user_id,
    direction,
    points,
    activity_type,
    source_key,
    source_id,
    description
  )
  values (
    uid,
    'debit',
    p_points,
    'bayanihan_conversion',
    'points_redemption:' || v_redemption_id::text,
    v_redemption_id,
    'Transferred BUKLOD Points to BUKLOD Bayanihan'
  )
  returning id into v_points_ledger_id;

  insert into public.bayanihan_ledger (
    user_id,
    direction,
    amount,
    source_type,
    source_key,
    source_id,
    description
  )
  values (
    uid,
    'credit',
    v_amount,
    'buklod_points_conversion',
    'buklod_points_redemption:' || v_redemption_id::text,
    v_redemption_id,
    'BUKLOD Points to Bayanihan transfer'
  )
  returning id into v_bayanihan_ledger_id;

  update public.buklod_points_redemptions
  set
    points_ledger_id = v_points_ledger_id,
    bayanihan_ledger_id = v_bayanihan_ledger_id,
    updated_at = now()
  where id = v_redemption_id;

  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'redemption_type', 'bayanihan',
    'status', 'completed',
    'points_spent', p_points,
    'destination_amount', v_amount,
    'destination_unit', 'BAYANIHAN_CREDIT',
    'lifetime_points', v_lifetime,
    'available_points', public.buklod_available_points_for(uid),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.convert_my_buklod_points_to_bayanihan_v1(integer,text) from public, anon;
grant execute on function public.convert_my_buklod_points_to_bayanihan_v1(integer,text) to authenticated;

create or replace function public.request_my_buklod_cash_reward_v1(
  p_points integer,
  p_payout_method text,
  p_payout_account text,
  p_request_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.buklod_points_redemption_config%rowtype;
  v_key text;
  v_existing public.buklod_points_redemptions%rowtype;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_rate numeric := 0;
  v_amount numeric := 0;
  v_method text;
  v_account text;
  v_redemption_id uuid;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_points, 0) <= 0 then
    raise exception 'Points must be greater than zero';
  end if;

  v_method := nullif(left(trim(coalesce(p_payout_method, '')), 40), '');
  v_account := nullif(left(trim(coalesce(p_payout_account, '')), 120), '');

  if v_method is null then
    raise exception 'Payout method is required';
  end if;

  if v_account is null then
    raise exception 'Payout account is required';
  end if;

  v_key := nullif(left(trim(coalesce(p_request_key, '')), 120), '');
  if v_key is null then
    v_key := gen_random_uuid()::text;
  end if;

  select *
  into v_existing
  from public.buklod_points_redemptions r
  where r.user_id = uid
    and r.client_request_key = v_key;

  if found then
    return jsonb_build_object(
      'redemption_id', v_existing.id,
      'redemption_type', v_existing.redemption_type,
      'status', v_existing.status,
      'points_spent', v_existing.points_spent,
      'destination_amount', v_existing.destination_amount,
      'destination_unit', v_existing.destination_unit,
      'available_points', public.buklod_available_points_for(uid),
      'reserved_points', public.buklod_points_cash_reserved_for(uid),
      'idempotent_replay', true
    );
  end if;

  select *
  into cfg
  from public.buklod_points_redemption_config
  where singleton = true;

  if not coalesce(cfg.cash_reward_enabled, false)
     or cfg.cash_php_per_point is null
     or cfg.cash_php_per_point <= 0 then
    raise exception 'Cash Reward exchange is not enabled or has no configured PHP conversion rate';
  end if;

  if p_points < coalesce(cfg.cash_min_points, 1) then
    raise exception 'Cash Reward request is below the configured minimum points';
  end if;

  if cfg.cash_max_points is not null and p_points > cfg.cash_max_points then
    raise exception 'Cash Reward request exceeds the configured maximum points';
  end if;

  select b.available_points
  into v_available
  from public.buklod_user_points_balances b
  where b.user_id = uid
  for update;

  if not found then
    raise exception 'No claimed BUKLOD Points balance is available';
  end if;

  v_reserved := public.buklod_points_cash_reserved_for(uid);

  if greatest(v_available - v_reserved, 0) < p_points then
    raise exception 'Insufficient spendable points after active cash reward reservations';
  end if;

  v_rate := cfg.cash_php_per_point;
  v_amount := round((p_points * v_rate)::numeric, 2);

  insert into public.buklod_points_redemptions (
    user_id,
    redemption_type,
    points_spent,
    conversion_rate,
    destination_amount,
    destination_unit,
    status,
    client_request_key,
    payout_method,
    payout_account
  )
  values (
    uid,
    'cash_reward',
    p_points,
    v_rate,
    v_amount,
    'PHP',
    'pending',
    v_key,
    v_method,
    v_account
  )
  returning id into v_redemption_id;

  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'redemption_type', 'cash_reward',
    'status', 'pending',
    'points_spent', p_points,
    'destination_amount', v_amount,
    'destination_unit', 'PHP',
    'available_points', v_available,
    'reserved_points', public.buklod_points_cash_reserved_for(uid),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.request_my_buklod_cash_reward_v1(integer,text,text,text) from public, anon;
grant execute on function public.request_my_buklod_cash_reward_v1(integer,text,text,text) to authenticated;

create or replace function public.cancel_my_buklod_cash_reward_v1(
  p_redemption_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_row public.buklod_points_redemptions%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_row
  from public.buklod_points_redemptions r
  where r.id = p_redemption_id
    and r.user_id = uid
    and r.redemption_type = 'cash_reward'
  for update;

  if not found then
    raise exception 'Cash Reward request not found';
  end if;

  if v_row.status not in ('pending','approved') then
    raise exception 'Only pending or approved Cash Reward requests can be cancelled';
  end if;

  update public.buklod_points_redemptions
  set
    status = 'cancelled',
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'redemption_id', v_row.id,
    'status', 'cancelled',
    'available_points', public.buklod_available_points_for(uid),
    'reserved_points', public.buklod_points_cash_reserved_for(uid)
  );
end;
$$;

revoke all on function public.cancel_my_buklod_cash_reward_v1(uuid) from public, anon;
grant execute on function public.cancel_my_buklod_cash_reward_v1(uuid) to authenticated;

create or replace function public.admin_get_buklod_points_redemption_center_v1(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg public.buklod_points_redemption_config%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_requests jsonb := '[]'::jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  select *
  into cfg
  from public.buklod_points_redemption_config
  where singleton = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'user_id', q.user_id,
        'full_name', q.full_name,
        'points_spent', q.points_spent,
        'conversion_rate', q.conversion_rate,
        'destination_amount', q.destination_amount,
        'status', q.status,
        'payout_method', q.payout_method,
        'payout_account', q.payout_account,
        'admin_note', q.admin_note,
        'payout_reference', q.payout_reference,
        'reviewed_at', q.reviewed_at,
        'fulfilled_at', q.fulfilled_at,
        'created_at', q.created_at
      )
      order by q.created_at desc
    ),
    '[]'::jsonb
  )
  into v_requests
  from (
    select
      r.*,
      coalesce(nullif(trim(p.full_name),''),'BUKLOD Member')::text as full_name
    from public.buklod_points_redemptions r
    join public.profiles p on p.id = r.user_id
    where r.redemption_type = 'cash_reward'
    order by r.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'config', jsonb_build_object(
      'bayanihan_enabled', coalesce(cfg.bayanihan_enabled, true),
      'bayanihan_units_per_point', coalesce(cfg.bayanihan_units_per_point, 1),
      'cash_reward_enabled', coalesce(cfg.cash_reward_enabled, false),
      'cash_php_per_point', cfg.cash_php_per_point,
      'cash_min_points', coalesce(cfg.cash_min_points, 1),
      'cash_max_points', cfg.cash_max_points
    ),
    'requests', v_requests
  );
end;
$$;

revoke all on function public.admin_get_buklod_points_redemption_center_v1(integer) from public, anon;
grant execute on function public.admin_get_buklod_points_redemption_center_v1(integer) to authenticated;

create or replace function public.admin_set_buklod_points_redemption_config_v1(
  p_bayanihan_enabled boolean,
  p_bayanihan_units_per_point numeric,
  p_cash_reward_enabled boolean,
  p_cash_php_per_point numeric,
  p_cash_min_points integer,
  p_cash_max_points integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if coalesce(p_bayanihan_units_per_point,0) <= 0 then
    raise exception 'Bayanihan units per point must be greater than zero';
  end if;

  if coalesce(p_cash_min_points,0) < 1 then
    raise exception 'Cash Reward minimum points must be at least 1';
  end if;

  if p_cash_max_points is not null and p_cash_max_points < p_cash_min_points then
    raise exception 'Cash Reward maximum points cannot be below the minimum';
  end if;

  if coalesce(p_cash_reward_enabled,false)
     and (p_cash_php_per_point is null or p_cash_php_per_point <= 0) then
    raise exception 'Set a positive PHP per point rate before enabling Cash Reward';
  end if;

  insert into public.buklod_points_redemption_config (
    singleton,
    bayanihan_enabled,
    bayanihan_units_per_point,
    cash_reward_enabled,
    cash_php_per_point,
    cash_min_points,
    cash_max_points,
    updated_by,
    updated_at
  )
  values (
    true,
    coalesce(p_bayanihan_enabled,true),
    p_bayanihan_units_per_point,
    coalesce(p_cash_reward_enabled,false),
    p_cash_php_per_point,
    p_cash_min_points,
    p_cash_max_points,
    actor,
    now()
  )
  on conflict (singleton) do update
  set
    bayanihan_enabled = excluded.bayanihan_enabled,
    bayanihan_units_per_point = excluded.bayanihan_units_per_point,
    cash_reward_enabled = excluded.cash_reward_enabled,
    cash_php_per_point = excluded.cash_php_per_point,
    cash_min_points = excluded.cash_min_points,
    cash_max_points = excluded.cash_max_points,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return (select public.admin_get_buklod_points_redemption_center_v1(100));
end;
$$;

revoke all on function public.admin_set_buklod_points_redemption_config_v1(boolean,numeric,boolean,numeric,integer,integer) from public, anon;
grant execute on function public.admin_set_buklod_points_redemption_config_v1(boolean,numeric,boolean,numeric,integer,integer) to authenticated;

create or replace function public.admin_review_buklod_cash_reward_v1(
  p_redemption_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  v_row public.buklod_points_redemptions%rowtype;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_status text;
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  select *
  into v_row
  from public.buklod_points_redemptions r
  where r.id = p_redemption_id
    and r.redemption_type = 'cash_reward'
  for update;

  if not found then
    raise exception 'Cash Reward request not found';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'Only pending Cash Reward requests can be reviewed';
  end if;

  if coalesce(p_approve,false) then
    select b.available_points
    into v_available
    from public.buklod_user_points_balances b
    where b.user_id = v_row.user_id
    for update;

    v_reserved := public.buklod_points_cash_reserved_for(v_row.user_id);

    if v_available < v_reserved then
      raise exception 'Member no longer has enough available points to cover active Cash Reward reservations';
    end if;

    v_status := 'approved';
  else
    v_status := 'rejected';
  end if;

  update public.buklod_points_redemptions
  set
    status = v_status,
    admin_note = nullif(left(trim(coalesce(p_note,'')),500),''),
    reviewed_by = actor,
    reviewed_at = now(),
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'redemption_id', v_row.id,
    'status', v_status,
    'available_points', public.buklod_available_points_for(v_row.user_id),
    'reserved_points', public.buklod_points_cash_reserved_for(v_row.user_id)
  );
end;
$$;

revoke all on function public.admin_review_buklod_cash_reward_v1(uuid,boolean,text) from public, anon;
grant execute on function public.admin_review_buklod_cash_reward_v1(uuid,boolean,text) to authenticated;

create or replace function public.admin_mark_buklod_cash_reward_paid_v1(
  p_redemption_id uuid,
  p_payout_reference text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  v_row public.buklod_points_redemptions%rowtype;
  v_reference text;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_points_ledger_id uuid;
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  v_reference := nullif(left(trim(coalesce(p_payout_reference,'')),120),'');
  if v_reference is null then
    raise exception 'Payout reference is required before marking Cash Reward as paid';
  end if;

  select *
  into v_row
  from public.buklod_points_redemptions r
  where r.id = p_redemption_id
    and r.redemption_type = 'cash_reward'
  for update;

  if not found then
    raise exception 'Cash Reward request not found';
  end if;

  if v_row.status <> 'approved' then
    raise exception 'Only approved Cash Reward requests can be marked paid';
  end if;

  select b.available_points
  into v_available
  from public.buklod_user_points_balances b
  where b.user_id = v_row.user_id
  for update;

  if not found then
    raise exception 'Member points balance not found';
  end if;

  v_reserved := public.buklod_points_cash_reserved_for(v_row.user_id);

  if v_available < v_reserved then
    raise exception 'Member no longer has enough available points to cover active Cash Reward reservations';
  end if;

  insert into public.buklod_points_ledger (
    user_id,
    direction,
    points,
    activity_type,
    source_key,
    source_id,
    description,
    awarded_by
  )
  values (
    v_row.user_id,
    'debit',
    v_row.points_spent,
    'cash_reward_exchange',
    'points_redemption:' || v_row.id::text,
    v_row.id,
    'Cash Reward paid: PHP ' || to_char(v_row.destination_amount, 'FM9999999990.00'),
    actor
  )
  returning id into v_points_ledger_id;

  update public.buklod_points_redemptions
  set
    status = 'paid',
    points_ledger_id = v_points_ledger_id,
    payout_reference = v_reference,
    admin_note = coalesce(
      nullif(left(trim(coalesce(p_note,'')),500),''),
      admin_note
    ),
    fulfilled_at = now(),
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'redemption_id', v_row.id,
    'status', 'paid',
    'points_spent', v_row.points_spent,
    'destination_amount', v_row.destination_amount,
    'destination_unit', 'PHP',
    'lifetime_points', public.buklod_lifetime_points_for(v_row.user_id),
    'available_points', public.buklod_available_points_for(v_row.user_id),
    'payout_reference', v_reference
  );
end;
$$;

revoke all on function public.admin_mark_buklod_cash_reward_paid_v1(uuid,text,text) from public, anon;
grant execute on function public.admin_mark_buklod_cash_reward_paid_v1(uuid,text,text) to authenticated;

-- Retire the old placeholder catalog completely. Existing rows remain for audit.
update public.buklod_redeem_catalog
set
  is_active = false,
  updated_at = now()
where is_active = true;

create or replace function public.get_buklod_redeem_catalog_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select '[]'::jsonb;
$$;

revoke all on function public.get_buklod_redeem_catalog_v1() from public, anon;
grant execute on function public.get_buklod_redeem_catalog_v1() to authenticated;

create or replace function public.redeem_buklod_catalog_item_v1(p_catalog_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Legacy reward catalog is retired. Use the BUKLOD Points Redemption Center.';
end;
$$;

revoke all on function public.redeem_buklod_catalog_item_v1(uuid) from public, anon;
grant execute on function public.redeem_buklod_catalog_item_v1(uuid) to authenticated;
