-- R38 secure payout profile foundation.
-- Keeps payout identity separate from Points, Giving, and public/profile data.

create table if not exists private.buklod_r38_payout_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  payout_method text not null check (payout_method in ('GCASH')),
  account_name text not null,
  destination_value text not null,
  destination_masked text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buklod_r38_payout_profiles_user_idx
  on private.buklod_r38_payout_profiles(user_id,status);

revoke all on table private.buklod_r38_payout_profiles from public,anon,authenticated;

create or replace function private.buklod_r38_normalize_gcash_v1(p_mobile text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v text := regexp_replace(coalesce(p_mobile,''),'[^0-9+]','','g');
begin
  if left(v,3)='+63' then
    v := '0'||substring(v from 4);
  elsif left(v,2)='63' and length(v)=12 then
    v := '0'||substring(v from 3);
  end if;
  if v !~ '^09[0-9]{9}$' then
    raise exception 'Enter a valid Philippine mobile number for GCash';
  end if;
  return v;
end;
$function$;
revoke all on function private.buklod_r38_normalize_gcash_v1(text) from public,anon,authenticated;

create or replace function private.buklod_r38_mask_mobile_v1(p_mobile text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case when length(coalesce(p_mobile,''))>=7
    then left(p_mobile,2)||'*****'||right(p_mobile,4)
    else '••••'
  end;
$function$;
revoke all on function private.buklod_r38_mask_mobile_v1(text) from public,anon,authenticated;

create or replace function public.set_my_buklod_r38_payout_profile_v1(
  p_payout_method text,
  p_account_name text,
  p_destination text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_method text := upper(trim(coalesce(p_payout_method,'')));
  v_name text := nullif(left(trim(coalesce(p_account_name,'')),120),'');
  v_destination text;
  v_masked text;
  v_row private.buklod_r38_payout_profiles%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_method <> 'GCASH' then raise exception 'Only GCash payout profile is supported in Phase 1'; end if;
  if v_name is null then raise exception 'Account name is required'; end if;

  v_destination := private.buklod_r38_normalize_gcash_v1(p_destination);
  v_masked := private.buklod_r38_mask_mobile_v1(v_destination);

  insert into private.buklod_r38_payout_profiles(
    user_id,payout_method,account_name,destination_value,destination_masked,status,updated_at
  ) values(v_uid,v_method,v_name,v_destination,v_masked,'ACTIVE',now())
  on conflict(user_id) do update set
    payout_method=excluded.payout_method,
    account_name=excluded.account_name,
    destination_value=excluded.destination_value,
    destination_masked=excluded.destination_masked,
    status='ACTIVE',
    updated_at=now()
  returning * into v_row;

  perform private.buklod_r38_audit_v1(
    v_uid,'PAYOUT_PROFILE_UPDATED','PAYOUT_PROFILE',v_row.id::text,null,
    jsonb_build_object('payout_method',v_method,'destination_masked',v_masked),
    jsonb_build_object('id',v_row.id,'payout_method',v_method,'account_name',v_name,'destination_masked',v_masked,'status',v_row.status),
    'User updated own R38 payout profile. Full destination omitted from audit log.',
    'payout-profile:'||v_row.id::text||':'||extract(epoch from now())::bigint::text
  );

  return jsonb_build_object(
    'id',v_row.id,
    'payout_method',v_row.payout_method,
    'account_name',v_row.account_name,
    'destination_masked',v_row.destination_masked,
    'status',v_row.status,
    'updated_at',v_row.updated_at
  );
end;
$function$;
revoke all on function public.set_my_buklod_r38_payout_profile_v1(text,text,text) from public,anon;
grant execute on function public.set_my_buklod_r38_payout_profile_v1(text,text,text) to authenticated;

create or replace function public.get_my_buklod_r38_payout_profile_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_row private.buklod_r38_payout_profiles%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_row from private.buklod_r38_payout_profiles where user_id=v_uid and status='ACTIVE' limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id',v_row.id,
    'payout_method',v_row.payout_method,
    'account_name',v_row.account_name,
    'destination_masked',v_row.destination_masked,
    'status',v_row.status,
    'updated_at',v_row.updated_at
  );
end;
$function$;
revoke all on function public.get_my_buklod_r38_payout_profile_v1() from public,anon;
grant execute on function public.get_my_buklod_r38_payout_profile_v1() to authenticated;

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
  if found then return jsonb_build_object('idempotent_replay',true,'withdrawal',to_jsonb(v_existing)); end if;

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
    request_idempotency_key,source_pool,metadata
  ) values(
    v_uid,round(v_available,2),'PHP','REQUESTED',v_profile.payout_method,v_profile.id::text,v_profile.destination_masked,
    v_key,'DIRECT_REFERRAL',jsonb_build_object('full_balance_only',true,'points_used',false,'payout_profile_server_resolved',true)
  ) returning * into v_row;

  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','AVAILABLE','debit',v_row.requested_amount,'WITHDRAWAL_RESERVE','withdrawal-reserve-available:'||v_row.id::text,v_row.id,'Reserve finalized referral cash for withdrawal','r38_unified_economy_v1','{}'::jsonb);
  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','RESERVED','credit',v_row.requested_amount,'WITHDRAWAL_RESERVE','withdrawal-reserve-held:'||v_row.id::text,v_row.id,'Reserved finalized referral cash','r38_unified_economy_v1','{}'::jsonb);

  perform private.buklod_r38_audit_v1(
    v_uid,'WITHDRAWAL_REQUESTED','REFERRAL_WITHDRAWAL',v_row.id::text,null,
    jsonb_build_object('amount',v_row.requested_amount,'payout_method',v_row.payout_method,'destination_masked',v_row.payout_destination_masked),
    jsonb_build_object('id',v_row.id,'status',v_row.status,'amount',v_row.requested_amount),
    'Full finalized Direct Referral available balance reserved. Points not used.',
    'withdrawal-requested:'||v_row.id::text
  );

  return jsonb_build_object(
    'idempotent_replay',false,
    'withdrawal',to_jsonb(v_row),
    'remaining_available_referral_cash',private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE')
  );
end;
$function$;
revoke all on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) from public,anon;
grant execute on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) to authenticated;

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
  select * into v_w from private.buklod_r38_referral_withdrawals where id=p_withdrawal_id;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_w.status not in ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING') then
    raise exception 'Payout destination is not available for this withdrawal state';
  end if;
  if v_w.payout_profile_ref is null then raise exception 'Withdrawal has no R38 payout profile reference'; end if;

  select * into v_p from private.buklod_r38_payout_profiles
  where id::text=v_w.payout_profile_ref and user_id=v_w.user_id;
  if not found then raise exception 'Referenced payout profile not found'; end if;

  perform private.buklod_r38_audit_v1(
    v_actor,'PAYOUT_DESTINATION_ACCESSED','REFERRAL_WITHDRAWAL',v_w.id::text,null,
    jsonb_build_object('payout_method',v_p.payout_method,'destination_masked',v_p.destination_masked),null,
    'System Admin accessed payout destination for an active withdrawal.',
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

comment on table private.buklod_r38_payout_profiles is
'Private R38 payout identity. Never used as a source of earnings; full destination is exposed only by guarded RPCs.';
comment on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) is
'R38 withdrawal request using server-resolved active payout profile. Full available Direct Referral balance only; Points are never consulted.';