-- R38 user withdrawal history: own records only, masked destination only.

create or replace function public.get_my_buklod_r38_referral_withdrawals_v1(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  v_rows jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',w.id,
    'requested_amount',w.requested_amount,
    'currency',w.currency,
    'status',w.status,
    'payout_method',w.payout_method,
    'payout_destination_masked',w.payout_destination_masked,
    'requested_at',w.requested_at,
    'reviewed_at',w.reviewed_at,
    'approved_at',w.approved_at,
    'paid_at',w.paid_at,
    'payout_transaction_ref',w.payout_transaction_ref,
    'rejection_reason',w.rejection_reason,
    'failure_reason',w.failure_reason
  ) order by w.requested_at desc),'[]'::jsonb)
  into v_rows
  from (
    select * from private.buklod_r38_referral_withdrawals
    where user_id=v_uid
    order by requested_at desc
    limit v_limit
  ) w;

  return jsonb_build_object(
    'rows',v_rows,
    'referral_withdrawal_enabled',private.buklod_r38_flag_enabled_v1('referral_withdrawal_enabled'),
    'payout_processing_enabled',private.buklod_r38_flag_enabled_v1('payout_processing_enabled')
  );
end;
$function$;

revoke all on function public.get_my_buklod_r38_referral_withdrawals_v1(integer) from public,anon;
grant execute on function public.get_my_buklod_r38_referral_withdrawals_v1(integer) to authenticated;

comment on function public.get_my_buklod_r38_referral_withdrawals_v1(integer) is
'User R38 withdrawal history. Returns only the caller own withdrawals and only masked payout destinations.';