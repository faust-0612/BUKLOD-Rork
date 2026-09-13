-- R38 safety cutover: BUKLOD Points are progression only, never money.
-- Historical schemas/rows remain intact. New point-derived monetary writes are blocked.

update public.buklod_points_redemption_config
set bayanihan_enabled = false,
    cash_reward_enabled = false,
    cash_php_per_point = null,
    updated_at = now()
where singleton = true;

create or replace function public.convert_my_buklod_points_to_bayanihan_v1(
  p_points integer,
  p_request_key text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  raise exception 'Legacy BUKLOD Points to Bayanihan conversion is disabled. BUKLOD Points are progression and are not money.';
end;
$function$;

create or replace function public.request_my_buklod_cash_reward_v1(
  p_points integer,
  p_payout_method text,
  p_payout_account text,
  p_request_key text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  raise exception 'Legacy point-based Cash Reward is disabled. Cash may only come from finalized funded BUKLOD revenue pools.';
end;
$function$;

create or replace function public.admin_review_buklod_cash_reward_v1(
  p_redemption_id uuid,
  p_approve boolean,
  p_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  raise exception 'Legacy point-based Cash Reward review is disabled. Use the finalized revenue-funded economy workflow.';
end;
$function$;

create or replace function public.admin_mark_buklod_cash_reward_paid_v1(
  p_redemption_id uuid,
  p_payout_reference text,
  p_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  raise exception 'Legacy point-based Cash Reward payout is disabled. Use the finalized revenue-funded economy workflow.';
end;
$function$;

create or replace function public.admin_set_buklod_points_redemption_config_v1(
  p_bayanihan_enabled boolean,
  p_bayanihan_units_per_point numeric,
  p_cash_reward_enabled boolean,
  p_cash_php_per_point numeric,
  p_cash_min_points integer,
  p_cash_max_points integer default null::integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if coalesce(p_bayanihan_enabled,false)
     or coalesce(p_cash_reward_enabled,false)
     or p_cash_php_per_point is not null then
    raise exception 'Point-derived money is permanently disabled by the current BUKLOD economic invariant.';
  end if;

  update public.buklod_points_redemption_config
  set bayanihan_enabled = false,
      cash_reward_enabled = false,
      cash_php_per_point = null,
      cash_min_points = greatest(coalesce(p_cash_min_points, cash_min_points, 1), 1),
      cash_max_points = case
        when p_cash_max_points is null then cash_max_points
        else greatest(p_cash_max_points, greatest(coalesce(p_cash_min_points, cash_min_points, 1), 1))
      end,
      updated_by = actor,
      updated_at = now()
  where singleton = true;

  return public.admin_get_buklod_points_redemption_center_v1(100);
end;
$function$;

create or replace function public.get_my_buklod_redemption_center_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  v_lifetime bigint := 0;
  v_available bigint := 0;
  v_history jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  v_lifetime := public.buklod_lifetime_points_for(uid);
  v_available := public.buklod_available_points_for(uid);

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
      ) order by x.created_at desc
    ),
    '[]'::jsonb
  ) into v_history
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
    'reserved_points', 0,
    'spendable_points', v_available,
    'bayanihan', jsonb_build_object(
      'enabled', false,
      'units_per_point', null,
      'legacy_disabled', true
    ),
    'cash_reward', jsonb_build_object(
      'enabled', false,
      'php_per_point', null,
      'min_points', null,
      'max_points', null,
      'legacy_disabled', true
    ),
    'history', v_history
  );
end;
$function$;

create or replace function public.admin_get_buklod_points_redemption_center_v1(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_requests jsonb := '[]'::jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

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
      ) order by q.created_at desc
    ),
    '[]'::jsonb
  ) into v_requests
  from (
    select r.*, coalesce(nullif(trim(p.full_name),''),'BUKLOD Member')::text as full_name
    from public.buklod_points_redemptions r
    join public.profiles p on p.id = r.user_id
    where r.redemption_type = 'cash_reward'
    order by r.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'config', jsonb_build_object(
      'legacy_point_money_disabled', true,
      'bayanihan_enabled', false,
      'bayanihan_units_per_point', null,
      'cash_reward_enabled', false,
      'cash_php_per_point', null,
      'cash_min_points', null,
      'cash_max_points', null
    ),
    'requests', v_requests
  );
end;
$function$;

comment on function public.convert_my_buklod_points_to_bayanihan_v1(integer,text)
is 'LEGACY DISABLED R38: BUKLOD Points are not money and cannot fund Bayanihan cash value.';
comment on function public.request_my_buklod_cash_reward_v1(integer,text,text,text)
is 'LEGACY DISABLED R38: point-to-PHP Cash Reward is prohibited; cash requires finalized funded platform revenue.';