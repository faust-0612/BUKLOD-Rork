-- BUKLOD SCOPE GCASH FUND REPORTING V1
-- Manual GCash is sent directly to the exact scope's registered receiver.
-- Report and verification are EXTERNALLY HELD scope-GCash records only.
-- This never credits a BUKLOD-owned settlement ledger or personal cash wallet.
create table if not exists private.buklod_scope_gcash_contribution_reports_v1 (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  receiver_name text not null,
  receiver_mobile text not null,
  gcash_reference text not null,
  amount_centavos bigint not null check (amount_centavos between 100 and 100000000),
  purpose text not null default 'GENERAL',
  member_note text,
  status text not null default 'REPORTED' check (status in ('REPORTED','VERIFIED','REJECTED')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_scope_gcash_reports_reference_unique unique (receiver_mobile, gcash_reference),
  constraint buklod_scope_gcash_reports_purpose_check check (purpose in ('GENERAL','PROJECT','EMERGENCY'))
);
create index if not exists buklod_scope_gcash_reports_scope_status_idx
on private.buklod_scope_gcash_contribution_reports_v1(scope_id,status,created_at desc);
create index if not exists buklod_scope_gcash_reports_user_idx
on private.buklod_scope_gcash_contribution_reports_v1(submitted_by,created_at desc);
alter table private.buklod_scope_gcash_contribution_reports_v1 enable row level security;
revoke all on table private.buklod_scope_gcash_contribution_reports_v1 from public,anon,authenticated;

create or replace function public.report_buklod_scope_gcash_contribution_v1(
  p_scope_id uuid, p_amount_php numeric, p_reference text,
  p_purpose text default 'GENERAL', p_note text default null
) returns jsonb language plpgsql security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_receiver public.giving_scope_receivers%rowtype;
  v_amount bigint;
  v_ref text := upper(regexp_replace(btrim(coalesce(p_reference,'')), '[[:space:]]+', '', 'g'));
  v_purpose text := upper(btrim(coalesce(p_purpose,'GENERAL')));
  v_id uuid;
  v_existing private.buklod_scope_gcash_contribution_reports_v1%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_scope_can_access_v1(p_scope_id,v_actor) then
    raise exception 'Active scope membership required';
  end if;
  if not exists (
    select 1 from public.buklod_scopes s where s.id=p_scope_id
    and s.status='ACTIVE' and s.scope_type in ('CLUSTER','ORGANIZATION','SUB_ORGANIZATION')
  ) then raise exception 'Active receiving Cluster or Organization required'; end if;
  select * into v_receiver from public.giving_scope_receivers
  where scope_id=p_scope_id and active=true;
  if not found then raise exception 'Registered receiving GCash not available'; end if;
  if p_amount_php is null or p_amount_php < 1 or p_amount_php > 1000000
    or p_amount_php <> round(p_amount_php,2) then
    raise exception 'Amount must be PHP 1 to 1000000, with at most two decimals';
  end if;
  v_amount := (p_amount_php*100)::bigint;
  if length(v_ref) < 6 or length(v_ref) > 80 or v_ref !~ '^[A-Z0-9_-]+$' then
    raise exception 'Enter a valid GCash reference (6-80 letters/numbers)';
  end if;
  if v_purpose not in ('GENERAL','PROJECT','EMERGENCY') then
    raise exception 'Unsupported contribution purpose';
  end if;
  if length(coalesce(p_note,'')) > 240 then raise exception 'Note too long'; end if;
  insert into private.buklod_scope_gcash_contribution_reports_v1 (
    scope_id,submitted_by,receiver_name,receiver_mobile,gcash_reference,
    amount_centavos,purpose,member_note
  ) values (
    p_scope_id,v_actor,v_receiver.gcash_name,v_receiver.gcash_mobile,v_ref,
    v_amount,v_purpose,nullif(btrim(p_note),'')
  ) on conflict (receiver_mobile,gcash_reference) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_existing
    from private.buklod_scope_gcash_contribution_reports_v1
    where receiver_mobile=v_receiver.gcash_mobile and gcash_reference=v_ref;
    if v_existing.submitted_by=v_actor and v_existing.scope_id=p_scope_id
      and v_existing.amount_centavos=v_amount then
      return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent',true);
    end if;
    raise exception 'GCash reference has already been reported; contact finance for reconciliation';
  end if;
  return jsonb_build_object('id',v_id,'status','REPORTED','idempotent',false);
end;
$func$;

create or replace function public.review_buklod_scope_gcash_contribution_v1(
  p_report_id uuid, p_approve boolean, p_review_note text
) returns jsonb language plpgsql security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_report private.buklod_scope_gcash_contribution_reports_v1%rowtype;
  v_review text := btrim(coalesce(p_review_note,''));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_report
    from private.buklod_scope_gcash_contribution_reports_v1
    where id=p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if not public.giving_can_manage_receiver(v_report.scope_id,v_actor) then
    raise exception 'Authorized exact-scope finance reviewer required';
  end if;
  if v_actor=v_report.submitted_by then
    raise exception 'Independent reviewer required: cannot approve your own contribution';
  end if;
  if v_report.status <> 'REPORTED' then
    if v_report.status='VERIFIED' and p_approve=true then
      return jsonb_build_object('id',v_report.id,'status','VERIFIED','idempotent',true);
    end if;
    raise exception 'Report already reviewed';
  end if;
  if p_approve is null then raise exception 'Review decision required'; end if;
  if length(v_review)<12 or length(v_review)>500 then
    raise exception 'Review must include 12-500 characters documenting GCash account evidence';
  end if;
  update private.buklod_scope_gcash_contribution_reports_v1
  set status=case when p_approve then 'VERIFIED' else 'REJECTED' end,
    reviewed_by=v_actor,reviewed_at=now(),review_note=v_review,updated_at=now()
  where id=p_report_id;
  return jsonb_build_object('id',p_report_id,
    'status',case when p_approve then 'VERIFIED' else 'REJECTED' end,
    'idempotent',false);
end;
$func$;

create or replace function public.get_buklod_scope_gcash_fund_dashboard_v1(p_scope_id uuid)
returns jsonb language plpgsql stable security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_fund jsonb;
  v_receiver public.giving_scope_receivers%rowtype;
  v_can_review boolean := false;
  v_reports jsonb;
  v_manual bigint := 0;
  v_allocation bigint := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_scope_can_access_v1(p_scope_id,v_actor) then
    raise exception 'Active scope membership required';
  end if;
  v_fund := public.get_buklod_scope_revenue_fund_summary_v1(p_scope_id);
  v_can_review := public.giving_can_manage_receiver(p_scope_id,v_actor);
  select * into v_receiver from public.giving_scope_receivers
  where scope_id=p_scope_id and active=true;
  select coalesce(sum(amount_centavos),0) into v_manual
    from private.buklod_scope_gcash_contribution_reports_v1
    where scope_id=p_scope_id and status='VERIFIED';
  select coalesce(sum(amount_centavos),0) into v_allocation
    from private.buklod_pf_community_fund_ledger
    where scope_id=p_scope_id and bucket='AVAILABLE' and direction='CREDIT'
      and entry_type='SETTLEMENT_ALLOCATION';
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',r.id,'amount_minor',r.amount_centavos,'purpose',r.purpose,
      'reference',r.gcash_reference,'status',r.status,'created_at',r.created_at,
      'own_report',r.submitted_by=v_actor,'submitted_by',
        case when v_can_review then r.submitted_by else null end,
      'review_note',case when v_can_review or r.submitted_by=v_actor then r.review_note else null end
    ) order by r.created_at desc
  ),'[]'::jsonb) into v_reports
  from (
    select * from private.buklod_scope_gcash_contribution_reports_v1
    where scope_id=p_scope_id and (v_can_review or submitted_by=v_actor)
    order by created_at desc limit 40
  ) r;
  return v_fund || jsonb_build_object(
    'registered_gcash',case when v_receiver.scope_id is not null
      then jsonb_build_object('name',v_receiver.gcash_name,'mobile',v_receiver.gcash_mobile)
      else null end,
    'can_review',v_can_review,
    'manual_received_minor',v_manual,
    'manual_fund_custody','EXTERNAL_SCOPE_GCASH',
    'manual_fund_spendable_in_buklod',false,
    'buklod_allocation_received_minor',v_allocation,
    'reports',v_reports
  );
end;
$func$;
revoke all on function public.report_buklod_scope_gcash_contribution_v1(uuid,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.review_buklod_scope_gcash_contribution_v1(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.get_buklod_scope_gcash_fund_dashboard_v1(uuid) from public,anon,authenticated;
grant execute on function public.report_buklod_scope_gcash_contribution_v1(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.review_buklod_scope_gcash_contribution_v1(uuid,boolean,text) to authenticated;
grant execute on function public.get_buklod_scope_gcash_fund_dashboard_v1(uuid) to authenticated;
comment on function public.review_buklod_scope_gcash_contribution_v1(uuid,boolean,text) is
'Independent exact-scope authorized review. A verified external GCash receipt remains externally held and is NOT a BUKLOD-funded ledger credit or personal earnings.';
