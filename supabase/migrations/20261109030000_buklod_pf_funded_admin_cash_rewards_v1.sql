-- BUKLOD funded System Admin reward path. No auto-credits from points,
-- preliminary AdMob reports, scope funds, or unfunded admin commands.
-- Default OFF: does not alter any existing cash or activation flag.
create table if not exists private.buklod_pf_admin_reward_controls (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  enabled_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into private.buklod_pf_admin_reward_controls(singleton,enabled)
values(true,false) on conflict(singleton) do nothing;

create table if not exists private.buklod_pf_admin_reward_budgets (
  id uuid primary key default gen_random_uuid(),
  source_reference text not null unique check (length(trim(source_reference)) between 8 and 160),
  evidence_reference text not null check (length(trim(evidence_reference)) between 8 and 240),
  verification_reference text check (verification_reference is null or length(trim(verification_reference)) between 8 and 240),
  amount_centavos bigint not null check (amount_centavos between 1 and 100000000),
  remaining_centavos bigint not null check (remaining_centavos between 0 and amount_centavos),
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED_BY_ADMIN','VOID')),
  note text,
  recorded_by uuid not null references auth.users(id),
  verified_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  verified_at timestamptz
);
create table if not exists private.buklod_pf_admin_reward_transfers (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references private.buklod_pf_admin_reward_budgets(id) on delete restrict,
  person_id uuid not null references private.buklod_pf_persons(person_id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  amount_centavos bigint not null check (amount_centavos between 1 and 10000000),
  request_key text not null unique check(length(trim(request_key)) between 8 and 160),
  reason text not null check(length(trim(reason)) between 8 and 240),
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
revoke all on private.buklod_pf_admin_reward_controls from public,anon,authenticated;
revoke all on private.buklod_pf_admin_reward_budgets from public,anon,authenticated;
revoke all on private.buklod_pf_admin_reward_transfers from public,anon,authenticated;
alter table private.buklod_pf_admin_reward_controls enable row level security;
alter table private.buklod_pf_admin_reward_budgets enable row level security;
alter table private.buklod_pf_admin_reward_transfers enable row level security;

create or replace function public.admin_get_buklod_pf_reward_funding_v1()
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare v_control private.buklod_pf_admin_reward_controls%rowtype;
        v_cfg private.buklod_pf_config%rowtype;
        v_rows jsonb;
begin
 if auth.uid() is null or not public.buklod_is_system_admin() then
   raise exception 'System Admin only';
 end if;
 select * into v_control from private.buklod_pf_admin_reward_controls where singleton=true;
 select * into v_cfg from private.buklod_pf_config where singleton=true;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',x.id,'source_reference',x.source_reference,'amount_centavos',x.amount_centavos,
   'remaining_centavos',x.remaining_centavos,'status',x.status,
   'recorded_at',x.recorded_at,'verified_at',x.verified_at
 ) order by x.recorded_at desc),'[]'::jsonb) into v_rows
 from (select * from private.buklod_pf_admin_reward_budgets order by recorded_at desc limit 40) x;
 return jsonb_build_object(
   'enabled',coalesce(v_control.enabled,false),
   'economics_enabled',coalesce(v_cfg.economics_enabled,false),
   'withdrawals_enabled',coalesce(v_cfg.withdrawal_enabled,false),
   'budgets',v_rows,
   'funding_verified_by_provider',false,
   'requires_external_receipt_review',true
 );
end;
$function$;
revoke all on function public.admin_get_buklod_pf_reward_funding_v1() from public,anon;
grant execute on function public.admin_get_buklod_pf_reward_funding_v1() to authenticated;

create or replace function public.admin_register_buklod_pf_reward_funding_v1(
  p_source_reference text,p_evidence_reference text,p_amount_centavos bigint,p_note text default null
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=auth.uid();
        v_source text:=trim(coalesce(p_source_reference,''));
        v_evidence text:=trim(coalesce(p_evidence_reference,''));
        v_budget private.buklod_pf_admin_reward_budgets%rowtype;
begin
 if v_actor is null or not public.buklod_is_system_admin() then raise exception 'System Admin only'; end if;
 if length(v_source) not between 8 and 160 or length(v_evidence) not between 8 and 240
   or p_amount_centavos is null or p_amount_centavos not between 1 and 100000000 then
   raise exception 'External receipt reference, supporting proof and valid funded amount required';
 end if;
 insert into private.buklod_pf_admin_reward_budgets(
   source_reference,evidence_reference,amount_centavos,remaining_centavos,note,recorded_by
 ) values(v_source,v_evidence,p_amount_centavos,p_amount_centavos,left(p_note,240),v_actor)
 on conflict(source_reference) do nothing;
 select * into v_budget from private.buklod_pf_admin_reward_budgets where source_reference=v_source;
 if v_budget.amount_centavos<>p_amount_centavos or v_budget.evidence_reference<>v_evidence then
   raise exception 'Receipt already registered with conflicting details';
 end if;
 return jsonb_build_object('id',v_budget.id,'status',v_budget.status,
   'amount_centavos',v_budget.amount_centavos,'remaining_centavos',v_budget.remaining_centavos);
end;
$function$;
revoke all on function public.admin_register_buklod_pf_reward_funding_v1(text,text,bigint,text) from public,anon;
grant execute on function public.admin_register_buklod_pf_reward_funding_v1(text,text,bigint,text) to authenticated;

create or replace function public.admin_verify_buklod_pf_reward_funding_v1(
  p_budget_id uuid,p_verification_reference text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=auth.uid();
        v_reference text:=trim(coalesce(p_verification_reference,''));
        v_budget private.buklod_pf_admin_reward_budgets%rowtype;
begin
 if v_actor is null or not public.buklod_is_system_admin() then raise exception 'System Admin only'; end if;
 if length(v_reference) not between 8 and 240 then
   raise exception 'External funding verification reference required';
 end if;
 select * into v_budget from private.buklod_pf_admin_reward_budgets
 where id=p_budget_id for update;
 if not found then raise exception 'Funding record not found'; end if;
 if v_budget.status='VERIFIED_BY_ADMIN' then
   if v_budget.verification_reference<>v_reference then raise exception 'Verification conflict'; end if;
 elsif v_budget.status='PENDING' then
   if v_reference=v_budget.source_reference then
     raise exception 'Verification reference must document an independent review of the receipt';
   end if;
   update private.buklod_pf_admin_reward_budgets
   set status='VERIFIED_BY_ADMIN',verified_by=v_actor,verified_at=now(),
       verification_reference=v_reference
   where id=p_budget_id returning * into v_budget;
 else
   raise exception 'Voided funding cannot be verified';
 end if;
 return jsonb_build_object('id',v_budget.id,'status',v_budget.status,
    'remaining_centavos',v_budget.remaining_centavos);
end;
$function$;
revoke all on function public.admin_verify_buklod_pf_reward_funding_v1(uuid,text) from public,anon;
grant execute on function public.admin_verify_buklod_pf_reward_funding_v1(uuid,text) to authenticated;

create or replace function public.admin_set_buklod_pf_reward_transfers_enabled_v1(p_enabled boolean)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=auth.uid();v_cfg private.buklod_pf_config%rowtype;
begin
 if v_actor is null or not public.buklod_is_system_admin() then raise exception 'System Admin only'; end if;
 if p_enabled is null then raise exception 'Explicit activation choice required'; end if;
 select * into v_cfg from private.buklod_pf_config where singleton=true for share;
 if p_enabled and (not coalesce(v_cfg.economics_enabled,false)
      or not exists(select 1 from private.buklod_pf_admin_reward_budgets
        where status='VERIFIED_BY_ADMIN' and remaining_centavos>0)) then
   raise exception 'Cannot enable unfunded rewards while economics is disabled or verified funding absent';
 end if;
 update private.buklod_pf_admin_reward_controls
 set enabled=p_enabled,enabled_by=v_actor,updated_at=now()
 where singleton=true;
 return jsonb_build_object('enabled',p_enabled);
end;
$function$;
revoke all on function public.admin_set_buklod_pf_reward_transfers_enabled_v1(boolean) from public,anon;
grant execute on function public.admin_set_buklod_pf_reward_transfers_enabled_v1(boolean) to authenticated;

create or replace function public.admin_transfer_buklod_pf_funded_reward_v1(
 p_budget_id uuid,p_recipient_user_id uuid,p_amount_centavos bigint,
 p_request_key text,p_reason text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid:=auth.uid(); v_cfg private.buklod_pf_config%rowtype;
        v_enabled boolean:=false; v_person uuid; v_lock uuid;
        v_key text:=trim(coalesce(p_request_key,''));
        v_reason text:=trim(coalesce(p_reason,''));
        v_prev private.buklod_pf_admin_reward_transfers%rowtype;
        v_transfer private.buklod_pf_admin_reward_transfers%rowtype;
        v_budget private.buklod_pf_admin_reward_budgets%rowtype;
begin
 if v_actor is null or not public.buklod_is_system_admin() then raise exception 'System Admin only'; end if;
 if p_recipient_user_id is null or p_budget_id is null
    or p_amount_centavos is null or p_amount_centavos not between 1 and 10000000
    or length(v_key) not between 8 and 160 or length(v_reason) not between 8 and 240 then
   raise exception 'Valid recipient, verified funding, amount, request key, and reason required';
 end if;
 select * into v_cfg from private.buklod_pf_config where singleton=true for share;
 select enabled into v_enabled from private.buklod_pf_admin_reward_controls where singleton=true for share;
 if not coalesce(v_cfg.economics_enabled,false) or not coalesce(v_enabled,false) then
   raise exception 'Funded reward transfer is not activated';
 end if;
 v_person:=private.buklod_pf_person_for_user_v2(p_recipient_user_id);
 if v_person is null then raise exception 'Recipient has no canonical financial identity'; end if;
 -- Same person row lock as canonical PF withdrawal: a concurrent grant cannot
 -- be skipped by a full-balance reservation or accidentally paid twice.
 select person_id into v_lock from private.buklod_pf_persons
 where person_id=v_person and current_user_id=p_recipient_user_id
   and risk_status='CLEAR' for update;
 if v_lock is null then raise exception 'Recipient identity is not eligible'; end if;
 select * into v_prev from private.buklod_pf_admin_reward_transfers
 where request_key=v_key;
 if found then
   if v_prev.recipient_user_id<>p_recipient_user_id
       or v_prev.budget_id<>p_budget_id
       or v_prev.amount_centavos<>p_amount_centavos
       or v_prev.reason<>v_reason then
     raise exception 'Conflicting funded reward request replay';
   end if;
   return jsonb_build_object('id',v_prev.id,'idempotent_replay',true,
     'amount_centavos',v_prev.amount_centavos,'credited_to','PROFIT_FIRST_V3_AVAILABLE');
 end if;
 update private.buklod_pf_admin_reward_budgets
 set remaining_centavos=remaining_centavos-p_amount_centavos
 where id=p_budget_id and status='VERIFIED_BY_ADMIN'
   and remaining_centavos>=p_amount_centavos
 returning * into v_budget;
 if not found then raise exception 'Verified reward funding is insufficient'; end if;

 insert into private.buklod_pf_admin_reward_transfers(
   budget_id,person_id,recipient_user_id,amount_centavos,request_key,reason,granted_by
 ) values(p_budget_id,v_person,p_recipient_user_id,p_amount_centavos,v_key,v_reason,v_actor)
 returning * into v_transfer;
 insert into private.buklod_pf_cash_ledger(
   person_id,bucket,direction,amount_centavos,entry_type,event_key,
   policy_version,description,metadata
 ) values(
   v_person,'AVAILABLE','CREDIT',p_amount_centavos,'ADMIN_CORRECTION',
   'pf-admin-funded-reward:'||v_transfer.id::text,v_cfg.policy_version,
   'Verified funded System Admin reward',
   jsonb_build_object('funding_class','ADMIN_FUNDED_REWARD',
     'budget_id',p_budget_id,'transfer_id',v_transfer.id,'granted_by',v_actor)
 );
 return jsonb_build_object('id',v_transfer.id,'idempotent_replay',false,
   'amount_centavos',v_transfer.amount_centavos,'credited_to','PROFIT_FIRST_V3_AVAILABLE',
   'withdrawal_gated',not coalesce(v_cfg.withdrawal_enabled,false));
end;
$function$;
revoke all on function public.admin_transfer_buklod_pf_funded_reward_v1(uuid,uuid,bigint,text,text) from public,anon;
grant execute on function public.admin_transfer_buklod_pf_funded_reward_v1(uuid,uuid,bigint,text,text) to authenticated;
