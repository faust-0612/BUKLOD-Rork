-- Ensure idempotent withdrawal replay never exposes immutable private payout snapshots.

create or replace function public.request_my_buklod_r38_referral_withdrawal_v1(
  p_payout_method text,
  p_payout_profile_ref text,
  p_destination_masked text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_cfg jsonb := private.buklod_r38_policy_config_v1();
  v_available numeric:=0;
  v_min numeric:=200;
  v_key text:=left(trim(coalesce(p_request_key,'')),160);
  v_profile private.buklod_r38_payout_profiles%rowtype;
  v_existing private.buklod_r38_referral_withdrawals%rowtype;
  v_row private.buklod_r38_referral_withdrawals%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.buklod_r38_flag_enabled_v1('referral_withdrawal_enabled') then raise exception 'Referral withdrawal is not enabled'; end if;
  if v_key='' then raise exception 'Request key is required'; end if;

  select * into v_existing from private.buklod_r38_referral_withdrawals
  where user_id=v_uid and request_idempotency_key=v_key;
  if found then
    return jsonb_build_object(
      'idempotent_replay',true,
      'withdrawal',to_jsonb(v_existing)-'payout_destination_snapshot'-'payout_account_name_snapshot',
      'remaining_available_referral_cash',private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE')
    );
  end if;

  select * into v_profile
  from private.buklod_r38_payout_profiles
  where user_id=v_uid and status='ACTIVE'
  for update;
  if not found then raise exception 'Set an active R38 payout profile before requesting withdrawal'; end if;

  if nullif(trim(coalesce(p_payout_profile_ref,'')),'') is not null
     and p_payout_profile_ref <> v_profile.id::text then
    raise exception 'Payout profile does not match the active profile';
  end if;
  if nullif(trim(coalesce(p_payout_method,'')),'') is not null
     and upper(trim(p_payout_method)) <> v_profile.payout_method then
    raise exception 'Payout method does not match the active profile';
  end if;

  perform p.id from public.profiles p where p.id=v_uid for update;
  v_available:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE'),0);
  v_min:=greatest(coalesce((v_cfg->'withdrawal'->>'minimum_amount')::numeric,200),0);
  if v_available<v_min then raise exception 'Available finalized referral cash is below the withdrawal minimum'; end if;
  if v_available<=0 then raise exception 'No finalized referral cash is available'; end if;

  insert into private.buklod_r38_referral_withdrawals(
    user_id,requested_amount,currency,status,payout_method,payout_profile_ref,payout_destination_masked,
    payout_account_name_snapshot,payout_destination_snapshot,
    request_idempotency_key,source_pool,metadata
  ) values(
    v_uid,round(v_available,2),'PHP','REQUESTED',v_profile.payout_method,v_profile.id::text,v_profile.destination_masked,
    v_profile.account_name,v_profile.destination_value,
    v_key,'DIRECT_REFERRAL',jsonb_build_object(
      'full_balance_only',true,
      'points_used',false,
      'payout_profile_server_resolved',true,
      'payout_identity_snapshotted',true
    )
  ) returning * into v_row;

  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','AVAILABLE','debit',v_row.requested_amount,'WITHDRAWAL_RESERVE','withdrawal-reserve-available:'||v_row.id::text,v_row.id,'Reserve finalized referral cash for withdrawal','r38_unified_economy_v1','{}'::jsonb);
  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','RESERVED','credit',v_row.requested_amount,'WITHDRAWAL_RESERVE','withdrawal-reserve-held:'||v_row.id::text,v_row.id,'Reserved finalized referral cash','r38_unified_economy_v1','{}'::jsonb);

  perform private.buklod_r38_audit_v1(
    v_uid,'WITHDRAWAL_REQUESTED','REFERRAL_WITHDRAWAL',v_row.id::text,null,
    jsonb_build_object('amount',v_row.requested_amount,'payout_method',v_row.payout_method,'destination_masked',v_row.payout_destination_masked),
    jsonb_build_object('id',v_row.id,'status',v_row.status,'amount',v_row.requested_amount),
    'Full finalized Direct Referral available balance reserved with immutable payout identity snapshot. Points not used.',
    'withdrawal-requested:'||v_row.id::text
  );

  return jsonb_build_object(
    'idempotent_replay',false,
    'withdrawal',to_jsonb(v_row)-'payout_destination_snapshot'-'payout_account_name_snapshot',
    'remaining_available_referral_cash',private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE')
  );
end;
$function$;

revoke all on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) from public,anon;
grant execute on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) to authenticated;

comment on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) is
'R38 full-balance Direct Referral withdrawal. Both initial and idempotent replay responses strip private payout identity snapshots.';