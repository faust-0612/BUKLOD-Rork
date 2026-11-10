-- BUKLOD scope bank manual contribution and admin-only treasurer delegation.
-- DEV MIGRATION ONLY: never credits BUKLOD cash or personal wallets.
create table if not exists public.buklod_scope_bank_receivers_v1(
  scope_id uuid primary key references public.buklod_scopes(id) on delete restrict,
  bank_name text not null check(char_length(bank_name) between 2 and 80),
  account_name text not null check(char_length(account_name) between 2 and 120),
  account_number text not null check(char_length(account_number) between 6 and 34),
  active boolean not null default true,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.buklod_scope_bank_receivers_v1 enable row level security;
revoke all on public.buklod_scope_bank_receivers_v1 from public,anon,authenticated;
create table if not exists private.buklod_scope_bank_reports_v1(
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id),
  submitted_by uuid not null references auth.users(id),
  receiver_bank text not null,
  receiver_number text not null,
  transfer_reference text not null,
  amount_centavos bigint not null check(amount_centavos between 100 and 100000000),
  purpose text not null check(purpose in ('GENERAL','PROJECT','EMERGENCY')),
  member_note text,
  status text not null default 'REPORTED' check(status in ('REPORTED','VERIFIED','REJECTED')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique(scope_id,receiver_bank,receiver_number,transfer_reference)
);
create index if not exists buklod_scope_bank_report_scope_idx on private.buklod_scope_bank_reports_v1(scope_id,created_at desc);
alter table private.buklod_scope_bank_reports_v1 enable row level security;
revoke all on private.buklod_scope_bank_reports_v1 from public,anon,authenticated;

create or replace function public.buklod_scope_bank_receiver_save_v1(
  p_scope_id uuid,p_bank_name text,p_account_name text,p_account_number text,p_active boolean default true
) returns void language plpgsql security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_bank text := btrim(coalesce(p_bank_name,''));
  v_name text := btrim(coalesce(p_account_name,''));
  v_number text := regexp_replace(btrim(coalesce(p_account_number,'')),'[[:space:]-]+','','g');
begin
  if v_actor is null or not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id,v_actor)
    or public.giving_is_central_admin(v_actor)
  ) then raise exception 'Only an exact-scope admin can authorize the bank receiver'; end if;
  if not exists(select 1 from public.buklod_scopes s where s.id=p_scope_id
    and s.status='ACTIVE' and s.scope_type in ('CLUSTER','ORGANIZATION','SUB_ORGANIZATION'))
  then raise exception 'Active scope required'; end if;
  if length(v_bank) not between 2 and 80 or length(v_name) not between 2 and 120
    or length(v_number) not between 6 and 34 or v_number !~ '^[A-Za-z0-9]+$'
  then raise exception 'Invalid bank account details'; end if;
  insert into public.buklod_scope_bank_receivers_v1(
    scope_id,bank_name,account_name,account_number,active,updated_by
  ) values (p_scope_id,v_bank,v_name,v_number,coalesce(p_active,true),v_actor)
  on conflict (scope_id) do update set bank_name=excluded.bank_name,
    account_name=excluded.account_name,account_number=excluded.account_number,
    active=excluded.active,updated_by=excluded.updated_by,updated_at=now();
end;
$func$;

create or replace function public.buklod_scope_bank_dashboard_v1(p_scope_id uuid)
returns jsonb language plpgsql stable security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_bank public.buklod_scope_bank_receivers_v1%rowtype;
  v_reviewer boolean;
  v_reports jsonb;
  v_received bigint;
begin
  if v_actor is null or not public.buklod_scope_can_access_v1(p_scope_id,v_actor) then
    raise exception 'Active scope membership required'; end if;
  v_reviewer := public.giving_can_manage_receiver(p_scope_id,v_actor) and (
    public.buklod_scope_has_active_membership_v1(p_scope_id,v_actor)
    or public.buklod_is_exact_scope_admin_v1(p_scope_id,v_actor)
    or public.giving_is_central_admin(v_actor)
  );
  select * into v_bank from public.buklod_scope_bank_receivers_v1 where scope_id=p_scope_id and active;
  select coalesce(sum(amount_centavos),0) into v_received
    from private.buklod_scope_bank_reports_v1 where scope_id=p_scope_id and status='VERIFIED';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'amount_minor',r.amount_centavos,'purpose',r.purpose,
    'reference',r.transfer_reference,'status',r.status,'created_at',r.created_at,
    'own_report',r.submitted_by=v_actor,
    'review_note',case when v_reviewer or r.submitted_by=v_actor then r.review_note else null end
  ) order by r.created_at desc),'[]'::jsonb) into v_reports
  from (select * from private.buklod_scope_bank_reports_v1
    where scope_id=p_scope_id and (v_reviewer or submitted_by=v_actor)
    order by created_at desc limit 40) r;
  return jsonb_build_object('scope_id',p_scope_id,'registered_bank',
    case when v_bank.scope_id is not null then jsonb_build_object(
      'name',v_bank.bank_name,'holder',v_bank.account_name,'number',v_bank.account_number)
    else null end,
    'can_review',v_reviewer,
    'can_manage_receiver',public.buklod_is_exact_scope_admin_v1(p_scope_id,v_actor)
      or public.giving_is_central_admin(v_actor),
    'manual_received_minor',v_received,'reports',v_reports,
    'custody','EXTERNAL_SCOPE_BANK','spendable_in_buklod',false);
end;
$func$;

create or replace function public.buklod_scope_bank_report_v1(
  p_scope_id uuid,p_amount_php numeric,p_reference text,
  p_purpose text default 'GENERAL',p_note text default null
) returns jsonb language plpgsql security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_bank public.buklod_scope_bank_receivers_v1%rowtype;
  v_ref text := upper(regexp_replace(btrim(coalesce(p_reference,'')),'[[:space:]]+','','g'));
  v_purpose text := upper(btrim(coalesce(p_purpose,'GENERAL')));
  v_id uuid;
  v_existing private.buklod_scope_bank_reports_v1%rowtype;
begin
  if v_actor is null or not public.buklod_scope_can_access_v1(p_scope_id,v_actor)
  then raise exception 'Active scope membership required'; end if;
  if not exists(select 1 from public.buklod_scopes s where s.id=p_scope_id
    and s.status='ACTIVE' and s.scope_type in ('CLUSTER','ORGANIZATION','SUB_ORGANIZATION'))
  then raise exception 'Active scope required'; end if;
  select * into v_bank from public.buklod_scope_bank_receivers_v1 where scope_id=p_scope_id and active;
  if not found then raise exception 'No authorized receiving bank account'; end if;
  if p_amount_php is null or p_amount_php < 1 or p_amount_php > 1000000
    or p_amount_php <> round(p_amount_php,2) then raise exception 'Invalid amount'; end if;
  if length(v_ref) not between 6 and 80 or v_ref !~ '^[A-Z0-9_-]+$'
    then raise exception 'Invalid completed bank reference'; end if;
  if v_purpose not in ('GENERAL','PROJECT','EMERGENCY') then raise exception 'Invalid purpose'; end if;
  if length(coalesce(p_note,'')) > 240 then raise exception 'Note too long'; end if;
  insert into private.buklod_scope_bank_reports_v1(
    scope_id,submitted_by,receiver_bank,receiver_number,transfer_reference,
    amount_centavos,purpose,member_note
  ) values (
    p_scope_id,v_actor,v_bank.bank_name,v_bank.account_number,v_ref,
    (p_amount_php*100)::bigint,v_purpose,nullif(btrim(coalesce(p_note,'')),'')
  ) on conflict (scope_id,receiver_bank,receiver_number,transfer_reference) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_existing from private.buklod_scope_bank_reports_v1
    where scope_id=p_scope_id and receiver_bank=v_bank.bank_name
      and receiver_number=v_bank.account_number and transfer_reference=v_ref;
    if v_existing.submitted_by=v_actor and v_existing.amount_centavos=(p_amount_php*100)::bigint then
      return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent',true);
    end if;
    raise exception 'Reference already reported to this bank account'; end if;
  return jsonb_build_object('id',v_id,'status','REPORTED','idempotent',false);
end;
$func$;

create or replace function public.buklod_scope_bank_review_v1(
  p_report_id uuid,p_approve boolean,p_review_note text
) returns jsonb language plpgsql security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_report private.buklod_scope_bank_reports_v1%rowtype;
  v_note text := btrim(coalesce(p_review_note,''));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_report from private.buklod_scope_bank_reports_v1 where id=p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if not public.giving_can_manage_receiver(v_report.scope_id,v_actor) or not (
    public.buklod_scope_has_active_membership_v1(v_report.scope_id,v_actor)
    or public.buklod_is_exact_scope_admin_v1(v_report.scope_id,v_actor)
    or public.giving_is_central_admin(v_actor)
  ) then raise exception 'Active authorized exact-scope finance reviewer required'; end if;
  if v_actor=v_report.submitted_by then raise exception 'Cannot approve your own report'; end if;
  if v_report.status<>'REPORTED' then
    if v_report.status='VERIFIED' and p_approve=true then
      return jsonb_build_object('id',v_report.id,'status','VERIFIED','idempotent',true);
    end if;
    raise exception 'Already reviewed'; end if;
  if p_approve is null or length(v_note) not between 12 and 500 then
    raise exception 'Decision and detailed account evidence required (12-500 characters)'; end if;
  update private.buklod_scope_bank_reports_v1
    set status=case when p_approve then 'VERIFIED' else 'REJECTED' end,
    reviewed_by=v_actor,reviewed_at=now(),review_note=v_note
    where id=p_report_id;
  return jsonb_build_object('id',p_report_id,'status',
    case when p_approve then 'VERIFIED' else 'REJECTED' end,'idempotent',false);
end;
$func$;

create or replace function public.buklod_scope_treasurer_candidates_v1(p_scope_id uuid)
returns jsonb language plpgsql stable security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_members jsonb;
  v_assigned jsonb;
begin
  if v_actor is null or not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id,v_actor)
    or public.giving_is_central_admin(v_actor)
  ) then raise exception 'Exact-scope admin required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.user_id,'name',q.full_name)
    order by q.full_name),'[]'::jsonb) into v_members
    from (select m.user_id,coalesce(nullif(btrim(p.full_name),''),'Member') as full_name
      from public.buklod_scope_memberships m
      left join public.profiles p on p.id=m.user_id
      where m.scope_id=p_scope_id and m.membership_status='ACTIVE'
      order by full_name,m.user_id limit 250) q;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.user_id,'active',a.active)),'[]'::jsonb)
    into v_assigned from public.giving_finance_admins a
    where a.scope_id=p_scope_id and a.role='local_finance';
  return jsonb_build_object('members',v_members,'treasurers',v_assigned,'scope_id',p_scope_id);
end;
$func$;

create or replace function public.buklod_scope_treasurer_authorize_v1(
  p_scope_id uuid,p_user_id uuid,p_active boolean
) returns jsonb language plpgsql security definer set search_path to ''
as $func$
declare
  v_actor uuid := (select auth.uid());
  v_updated integer;
begin
  if v_actor is null or not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id,v_actor)
    or public.giving_is_central_admin(v_actor)
  ) then raise exception 'Only exact-scope admin may authorize treasurers'; end if;
  if p_user_id is null or p_active is null then raise exception 'Member and decision required'; end if;
  if not exists(select 1 from public.buklod_scopes s where s.id=p_scope_id and s.status='ACTIVE'
    and s.scope_type in ('CLUSTER','ORGANIZATION','SUB_ORGANIZATION'))
  then raise exception 'Active exact scope required'; end if;
  if p_active and not public.buklod_scope_has_active_membership_v1(p_scope_id,p_user_id)
  then raise exception 'Only active exact-scope members can be treasurers'; end if;
  update public.giving_finance_admins set active=p_active,created_by=v_actor
    where user_id=p_user_id and role='local_finance' and scope_id=p_scope_id;
  get diagnostics v_updated = row_count;
  if v_updated=0 and p_active then
    begin
      insert into public.giving_finance_admins(user_id,role,scope_id,church_id,active,created_by)
      values (p_user_id,'local_finance',p_scope_id,null,true,v_actor);
    exception when unique_violation then
      update public.giving_finance_admins set active=true,created_by=v_actor
        where user_id=p_user_id and role='local_finance' and scope_id=p_scope_id;
    end;
  end if;
  return jsonb_build_object('scope_id',p_scope_id,'user_id',p_user_id,'active',p_active);
end;
$func$;

revoke all on function public.buklod_scope_bank_receiver_save_v1(uuid,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.buklod_scope_bank_dashboard_v1(uuid) from public,anon,authenticated;
revoke all on function public.buklod_scope_bank_report_v1(uuid,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.buklod_scope_bank_review_v1(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.buklod_scope_treasurer_candidates_v1(uuid) from public,anon,authenticated;
revoke all on function public.buklod_scope_treasurer_authorize_v1(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.buklod_scope_bank_receiver_save_v1(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.buklod_scope_bank_dashboard_v1(uuid) to authenticated;
grant execute on function public.buklod_scope_bank_report_v1(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.buklod_scope_bank_review_v1(uuid,boolean,text) to authenticated;
grant execute on function public.buklod_scope_treasurer_candidates_v1(uuid) to authenticated;
grant execute on function public.buklod_scope_treasurer_authorize_v1(uuid,uuid,boolean) to authenticated;
