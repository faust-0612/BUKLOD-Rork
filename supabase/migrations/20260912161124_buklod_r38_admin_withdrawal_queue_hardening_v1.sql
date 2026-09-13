-- R38 admin withdrawal queue and payout-destination least-privilege hardening.

create or replace function public.admin_list_buklod_r38_referral_withdrawals_v1(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit,100),1),250);
  v_status text := nullif(upper(trim(coalesce(p_status,''))),'');
  v_rows jsonb := '[]'::jsonb;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if v_status is not null and v_status not in ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED','FAILED') then
    raise exception 'Invalid withdrawal status filter';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'user_id',x.user_id,
    'full_name',x.full_name,
    'requested_amount',x.requested_amount,
    'currency',x.currency,
    'status',x.status,
    'payout_method',x.payout_method,
    'payout_destination_masked',x.payout_destination_masked,
    'requested_at',x.requested_at,
    'reviewed_at',x.reviewed_at,
    'approved_at',x.approved_at,
    'paid_at',x.paid_at,
    'payout_transaction_ref',x.payout_transaction_ref,
    'rejection_reason',x.rejection_reason,
    'failure_reason',x.failure_reason
  ) order by x.requested_at desc),'[]'::jsonb)
  into v_rows
  from (
    select w.*,coalesce(nullif(trim(p.full_name),''),'BUKLOD Member')::text as full_name
    from private.buklod_r38_referral_withdrawals w
    join public.profiles p on p.id=w.user_id
    where v_status is null or w.status=v_status
    order by w.requested_at desc
    limit v_limit
  ) x;

  return jsonb_build_object(
    'rows',v_rows,
    'payout_processing_enabled',private.buklod_r38_flag_enabled_v1('payout_processing_enabled'),
    'referral_withdrawal_enabled',private.buklod_r38_flag_enabled_v1('referral_withdrawal_enabled')
  );
end;
$function$;
revoke all on function public.admin_list_buklod_r38_referral_withdrawals_v1(text,integer) from public,anon;
grant execute on function public.admin_list_buklod_r38_referral_withdrawals_v1(text,integer) to authenticated;

create or replace function public.admin_get_buklod_r38_withdrawal_payout_details_v1(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_w private.buklod_r38_referral_withdrawals%rowtype;
  v_p private.buklod_r38_payout_profiles%rowtype;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if not private.buklod_r38_flag_enabled_v1('payout_processing_enabled') then
    raise exception 'Payout destination access is disabled until R38 payout processing is activated';
  end if;

  select * into v_w from private.buklod_r38_referral_withdrawals where id=p_withdrawal_id;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_w.status not in ('APPROVED','PROCESSING') then
    raise exception 'Payout destination may be accessed only after withdrawal approval';
  end if;
  if v_w.payout_profile_ref is null then raise exception 'Withdrawal has no R38 payout profile reference'; end if;

  select * into v_p from private.buklod_r38_payout_profiles
  where id::text=v_w.payout_profile_ref and user_id=v_w.user_id;
  if not found then raise exception 'Referenced payout profile not found'; end if;

  perform private.buklod_r38_audit_v1(
    v_actor,'PAYOUT_DESTINATION_ACCESSED','REFERRAL_WITHDRAWAL',v_w.id::text,null,
    jsonb_build_object('payout_method',v_p.payout_method,'destination_masked',v_p.destination_masked),null,
    'System Admin accessed payout destination for an approved withdrawal while payout processing was enabled.',
    'payout-destination-access:'||v_w.id::text||':'||v_actor::text||':'||extract(epoch from date_trunc('minute',now()))::bigint::text
  );

  return jsonb_build_object(
    'withdrawal_id',v_w.id,
    'user_id',v_w.user_id,
    'requested_amount',v_w.requested_amount,
    'currency',v_w.currency,
    'status',v_w.status,
    'payout_method',v_p.payout_method,
    'account_name',v_p.account_name,
    'destination',v_p.destination_value,
    'destination_masked',v_p.destination_masked
  );
end;
$function$;
revoke all on function public.admin_get_buklod_r38_withdrawal_payout_details_v1(uuid) from public,anon;
grant execute on function public.admin_get_buklod_r38_withdrawal_payout_details_v1(uuid) to authenticated;

comment on function public.admin_list_buklod_r38_referral_withdrawals_v1(text,integer) is
'Admin R38 withdrawal queue. Returns masked payout destinations only.';
comment on function public.admin_get_buklod_r38_withdrawal_payout_details_v1(uuid) is
'Least-privilege full payout destination access: System Admin + payout processing enabled + approved/processing withdrawal only; access is audited.';