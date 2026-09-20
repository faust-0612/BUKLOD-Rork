-- BUKLOD_MAIN_PROFIT_FIRST_PAYOUT_V2
-- Reuse hardened R38 payout snapshots/queue while durable person ledger owns cash.

alter table private.buklod_r38_referral_withdrawals
  drop constraint if exists buklod_r38_referral_withdrawals_source_pool_check;
alter table private.buklod_r38_referral_withdrawals
  add constraint buklod_r38_referral_withdrawals_source_pool_check
  check(source_pool in ('DIRECT_REFERRAL','PROFIT_FIRST_V2'));

alter table private.buklod_r38_referral_withdrawals
  alter column user_id drop not null;
alter table private.buklod_r38_referral_withdrawals
  drop constraint if exists buklod_r38_referral_withdrawals_user_id_fkey;
alter table private.buklod_r38_referral_withdrawals
  add constraint buklod_r38_referral_withdrawals_user_id_fkey
  foreign key(user_id) references auth.users(id) on delete set null;

alter table private.buklod_pf_config
  add column if not exists payout_processing_enabled boolean not null default false;

create unique index if not exists idx_buklod_pf_withdrawal_person_request
  on private.buklod_r38_referral_withdrawals(person_id,request_idempotency_key)
  where person_id is not null;

create or replace function public.get_my_buklod_pf_withdrawals_v2(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
  v_cfg private.buklod_pf_config%rowtype;
  v_rows jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then raise exception 'Profit-First identity not linked'; end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',w.id,'requested_amount',w.requested_amount,'currency',w.currency,
    'status',w.status,'payout_method',w.payout_method,
    'payout_destination_masked',w.payout_destination_masked,
    'requested_at',w.requested_at,'reviewed_at',w.reviewed_at,
    'approved_at',w.approved_at,'paid_at',w.paid_at,
    'payout_transaction_ref',w.payout_transaction_ref,
    'rejection_reason',w.rejection_reason,'failure_reason',w.failure_reason
  ) order by w.requested_at desc),'[]'::jsonb)
  into v_rows
  from (
    select *
    from private.buklod_r38_referral_withdrawals
    where person_id=v_person and source_pool='PROFIT_FIRST_V2'
    order by requested_at desc
    limit v_limit
  ) w;

  return jsonb_build_object(
    'rows',v_rows,
    'referral_withdrawal_enabled',v_cfg.withdrawal_enabled,
    'payout_processing_enabled',v_cfg.payout_processing_enabled
  );
end
$$;

create or replace function public.request_my_buklod_pf_withdrawal_v2(
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
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_cfg private.buklod_pf_config%rowtype;
  v_profile private.buklod_r38_payout_profiles%rowtype;
  v_existing private.buklod_r38_referral_withdrawals%rowtype;
  v_row private.buklod_r38_referral_withdrawals%rowtype;
  v_available numeric:=0;
  v_key text:=left(trim(coalesce(p_request_key,'')),160);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_key='' then raise exception 'Request key is required'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then raise exception 'Profit-First identity not linked'; end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true for share;
  if not v_cfg.withdrawal_enabled then raise exception 'Withdrawal is not enabled'; end if;

  select * into v_existing
  from private.buklod_r38_referral_withdrawals
  where person_id=v_person and request_idempotency_key=v_key;
  if found then
    return jsonb_build_object(
      'idempotent_replay',true,
      'withdrawal',to_jsonb(v_existing)-'payout_destination_snapshot'-'payout_account_name_snapshot',
      'remaining_available_referral_cash',greatest(private.buklod_pf_cash_balance_v2(v_person,'AVAILABLE'),0)
    );
  end if;

  select * into v_profile
  from private.buklod_r38_payout_profiles
  where user_id=v_uid and status='ACTIVE'
  for update;
  if not found then raise exception 'Set an active payout profile before requesting withdrawal'; end if;

  if nullif(trim(coalesce(p_payout_profile_ref,'')),'') is not null
     and p_payout_profile_ref<>v_profile.id::text then
    raise exception 'Payout profile does not match the active profile';
  end if;
  if nullif(trim(coalesce(p_payout_method,'')),'') is not null
     and upper(trim(p_payout_method))<>v_profile.payout_method then
    raise exception 'Payout method does not match the active profile';
  end if;

  perform person_id from private.buklod_pf_persons where person_id=v_person for update;
  v_available:=greatest(private.buklod_pf_cash_balance_v2(v_person,'AVAILABLE'),0);
  if v_available<v_cfg.minimum_withdrawal_php then
    raise exception 'Available finalized cash is below the withdrawal minimum';
  end if;

  insert into private.buklod_r38_referral_withdrawals(
    user_id,person_id,requested_amount,currency,status,payout_method,payout_profile_ref,
    payout_destination_masked,payout_account_name_snapshot,payout_destination_snapshot,
    request_idempotency_key,source_pool,metadata
  ) values(
    v_uid,v_person,round(v_available,2),'PHP','REQUESTED',v_profile.payout_method,v_profile.id::text,
    v_profile.destination_masked,v_profile.account_name,v_profile.destination_value,
    v_key,'PROFIT_FIRST_V2',
    jsonb_build_object('profit_first_v2',true,'full_balance_only',true,'points_used',false,'payout_identity_snapshotted',true)
  ) returning * into v_row;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
    policy_version,description,metadata
  ) values(
    v_person,'AVAILABLE','DEBIT',v_row.requested_amount,'WITHDRAWAL_RESERVE',
    'pf-withdrawal-reserve-available:'||v_row.id::text,v_row.id,
    v_cfg.policy_version,'Reserve finalized Profit-First cash for withdrawal','{}'::jsonb
  ) on conflict(person_id,event_key) do nothing;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
    policy_version,description,metadata
  ) values(
    v_person,'RESERVED','CREDIT',v_row.requested_amount,'WITHDRAWAL_RESERVE',
    'pf-withdrawal-reserve-held:'||v_row.id::text,v_row.id,
    v_cfg.policy_version,'Reserved finalized Profit-First cash','{}'::jsonb
  ) on conflict(person_id,event_key) do nothing;

  return jsonb_build_object(
    'idempotent_replay',false,
    'withdrawal',to_jsonb(v_row)-'payout_destination_snapshot'-'payout_account_name_snapshot',
    'remaining_available_referral_cash',greatest(private.buklod_pf_cash_balance_v2(v_person,'AVAILABLE'),0)
  );
end
$$;

create or replace function public.cancel_my_buklod_pf_withdrawal_v2(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_cfg private.buklod_pf_config%rowtype;
  v_row private.buklod_r38_referral_withdrawals%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then raise exception 'Profit-First identity not linked'; end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true;

  select * into v_row
  from private.buklod_r38_referral_withdrawals
  where id=p_withdrawal_id and person_id=v_person and source_pool='PROFIT_FIRST_V2'
  for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_row.status not in ('REQUESTED','UNDER_REVIEW') then
    raise exception 'Only requested/under-review withdrawal can be cancelled';
  end if;

  update private.buklod_r38_referral_withdrawals
  set status='CANCELLED',updated_at=now()
  where id=v_row.id
  returning * into v_row;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
    policy_version,description
  ) values(
    v_person,'RESERVED','DEBIT',v_row.requested_amount,'WITHDRAWAL_RELEASE',
    'pf-withdrawal-cancel-reserved:'||v_row.id::text,v_row.id,
    v_cfg.policy_version,'Release cancelled withdrawal reserve'
  ) on conflict(person_id,event_key) do nothing;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
    policy_version,description
  ) values(
    v_person,'AVAILABLE','CREDIT',v_row.requested_amount,'WITHDRAWAL_RELEASE',
    'pf-withdrawal-cancel-available:'||v_row.id::text,v_row.id,
    v_cfg.policy_version,'Return cancelled withdrawal to available cash'
  ) on conflict(person_id,event_key) do nothing;

  return to_jsonb(v_row)-'payout_destination_snapshot'-'payout_account_name_snapshot';
end
$$;

create or replace function public.admin_review_buklod_pf_withdrawal_v2(
  p_withdrawal_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_row private.buklod_r38_referral_withdrawals%rowtype;
begin
  if v_actor is null or not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System Admin access required';
  end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true;

  select * into v_row
  from private.buklod_r38_referral_withdrawals
  where id=p_withdrawal_id and source_pool='PROFIT_FIRST_V2'
  for update;
  if not found then raise exception 'Profit-First withdrawal request not found'; end if;
  if v_row.status not in ('REQUESTED','UNDER_REVIEW') then raise exception 'Withdrawal is not reviewable'; end if;

  if coalesce(p_approve,false) then
    update private.buklod_r38_referral_withdrawals
    set status='APPROVED',reviewed_by=v_actor,reviewed_at=now(),
        approved_by=v_actor,approved_at=now(),updated_at=now()
    where id=v_row.id returning * into v_row;
  else
    update private.buklod_r38_referral_withdrawals
    set status='REJECTED',reviewed_by=v_actor,reviewed_at=now(),
        rejection_reason=nullif(left(trim(coalesce(p_reason,'')),500),''),
        updated_at=now()
    where id=v_row.id returning * into v_row;

    insert into private.buklod_pf_cash_ledger(
      person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
      policy_version,description
    ) values(
      v_row.person_id,'RESERVED','DEBIT',v_row.requested_amount,'WITHDRAWAL_RELEASE',
      'pf-withdrawal-reject-reserved:'||v_row.id::text,v_row.id,
      v_cfg.policy_version,'Release rejected withdrawal reserve'
    ) on conflict(person_id,event_key) do nothing;

    insert into private.buklod_pf_cash_ledger(
      person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
      policy_version,description
    ) values(
      v_row.person_id,'AVAILABLE','CREDIT',v_row.requested_amount,'WITHDRAWAL_RELEASE',
      'pf-withdrawal-reject-available:'||v_row.id::text,v_row.id,
      v_cfg.policy_version,'Return rejected withdrawal to available cash'
    ) on conflict(person_id,event_key) do nothing;
  end if;

  return to_jsonb(v_row)-'payout_destination_snapshot'-'payout_account_name_snapshot';
end
$$;

create or replace function public.admin_get_buklod_pf_withdrawal_payout_details_v2(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_row private.buklod_r38_referral_withdrawals%rowtype;
begin
  if v_actor is null or not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System Admin access required';
  end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true;
  if not v_cfg.payout_processing_enabled then raise exception 'Payout processing is disabled'; end if;

  select * into v_row
  from private.buklod_r38_referral_withdrawals
  where id=p_withdrawal_id and source_pool='PROFIT_FIRST_V2';
  if not found then raise exception 'Profit-First withdrawal request not found'; end if;
  if v_row.status not in ('APPROVED','PROCESSING') then
    raise exception 'Payout destination may be accessed only after withdrawal approval';
  end if;

  return jsonb_build_object(
    'withdrawal_id',v_row.id,'user_id',v_row.user_id,'person_id',v_row.person_id,
    'requested_amount',v_row.requested_amount,'currency',v_row.currency,
    'status',v_row.status,'payout_method',v_row.payout_method,
    'account_name',v_row.payout_account_name_snapshot,
    'destination',v_row.payout_destination_snapshot,
    'destination_masked',v_row.payout_destination_masked
  );
end
$$;

create or replace function public.admin_mark_buklod_pf_withdrawal_paid_v2(
  p_withdrawal_id uuid,
  p_transaction_ref text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_row private.buklod_r38_referral_withdrawals%rowtype;
  v_ref text:=nullif(left(trim(coalesce(p_transaction_ref,'')),160),'');
begin
  if v_actor is null or not public.buklod_actor_is_system_admin_v1() then
    raise exception 'System Admin access required';
  end if;
  if v_ref is null then raise exception 'Payout transaction reference is required'; end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true;
  if not v_cfg.payout_processing_enabled then raise exception 'Payout processing is disabled'; end if;

  select * into v_row
  from private.buklod_r38_referral_withdrawals
  where id=p_withdrawal_id and source_pool='PROFIT_FIRST_V2'
  for update;
  if not found then raise exception 'Profit-First withdrawal request not found'; end if;
  if v_row.status='PAID' then return to_jsonb(v_row)-'payout_destination_snapshot'-'payout_account_name_snapshot'; end if;
  if v_row.status not in ('APPROVED','PROCESSING') then raise exception 'Only approved/processing withdrawal can be marked paid'; end if;

  if private.buklod_pf_cash_balance_v2(v_row.person_id,'RESERVED')<v_row.requested_amount then
    raise exception 'Reserved finalized cash is insufficient';
  end if;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
    policy_version,description,metadata
  ) values(
    v_row.person_id,'RESERVED','DEBIT',v_row.requested_amount,'PAYOUT_PAID',
    'pf-withdrawal-paid-reserved:'||v_row.id::text,v_row.id,
    v_cfg.policy_version,'Consume reserved finalized cash',
    jsonb_build_object('transaction_ref',v_ref)
  ) on conflict(person_id,event_key) do nothing;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_php,entry_type,event_key,withdrawal_id,
    policy_version,description,metadata
  ) values(
    v_row.person_id,'PAID','CREDIT',v_row.requested_amount,'PAYOUT_PAID',
    'pf-withdrawal-paid-history:'||v_row.id::text,v_row.id,
    v_cfg.policy_version,'Paid finalized Profit-First earnings',
    jsonb_build_object('transaction_ref',v_ref)
  ) on conflict(person_id,event_key) do nothing;

  update private.buklod_r38_referral_withdrawals
  set status='PAID',paid_at=now(),payout_transaction_ref=v_ref,updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return to_jsonb(v_row)-'payout_destination_snapshot'-'payout_account_name_snapshot';
end
$$;

grant execute on function public.get_my_buklod_pf_withdrawals_v2(integer) to authenticated;
grant execute on function public.request_my_buklod_pf_withdrawal_v2(text,text,text,text) to authenticated;
grant execute on function public.cancel_my_buklod_pf_withdrawal_v2(uuid) to authenticated;
grant execute on function public.admin_review_buklod_pf_withdrawal_v2(uuid,boolean,text) to authenticated;
grant execute on function public.admin_get_buklod_pf_withdrawal_payout_details_v2(uuid) to authenticated;
grant execute on function public.admin_mark_buklod_pf_withdrawal_paid_v2(uuid,text) to authenticated;
