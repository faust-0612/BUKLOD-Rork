-- Canonical QMP to Finance V3 bridge. No cash credit, payout, or finance activation.
-- Qualified Community QMP is the ONLY monthly user-pool weight.
-- An authenticated and currently active user with qualified QMP can obtain
-- a Finance person identity without first generating a peso of ad revenue.
-- Identity creation != payout approval. Referral qualification stays separate.

create or replace function private.buklod_pf_ensure_qmp_person_v1(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path to ''
as $function$
declare
  v_person uuid;
  v_link jsonb;
begin
  if p_user_id is null then return null; end if;
  if not exists (
    select 1 from auth.users a
    join public.profiles pr on pr.id=a.id
    where a.id=p_user_id and pr.is_active=true
      and pr.user_deactivated_at is null
  ) or not exists (
    select 1 from private.buklod_community_qmp_accounts q
    where q.user_id=p_user_id and q.qualified_qmp>0
  ) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('buklod-qmp-person:'||p_user_id::text,0));

  select l.person_id into v_person
  from private.buklod_pf_user_links l
  where l.user_id=p_user_id and l.retired_at is null;
  if v_person is not null then return v_person; end if;

  -- An existing canonical person for this auth UID must never be duplicated.
  select p.person_id into v_person from private.buklod_pf_persons p
  where p.current_user_id=p_user_id for update;
  if v_person is not null then
    insert into private.buklod_pf_user_links(user_id,person_id,link_reason,metadata)
    values(p_user_id,v_person,'QMP_LINK_RECOVERY',
      jsonb_build_object('recovered_from','existing_current_user_id'))
    on conflict(user_id) do update
      set person_id=excluded.person_id,retired_at=null,
          link_reason=excluded.link_reason,
          metadata=private.buklod_pf_user_links.metadata||excluded.metadata;
    return v_person;
  end if;

  -- Reuse the existing Finance identity creator to retain referral code,
  -- identity history and recreations. [] means NO guessed identity signals.
  v_link:=private.buklod_pf_link_identity_v2(p_user_id,'[]'::jsonb);
  if coalesce((v_link->>'ok')::boolean,false) is not true then
    raise exception 'Finance QMP identity requires verified review';
  end if;

  select l.person_id into v_person from private.buklod_pf_user_links l
  where l.user_id=p_user_id and l.retired_at is null;
  if v_person is null then raise exception 'QMP identity linking failed'; end if;
  return v_person;
end;
$function$;
revoke all on function private.buklod_pf_ensure_qmp_person_v1(uuid) from public,anon,authenticated;

create or replace function public.ensure_my_buklod_qmp_finance_identity_v1()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_person uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_person:=private.buklod_pf_ensure_qmp_person_v1(v_uid);
  return jsonb_build_object('identity_ready',v_person is not null);
end;
$function$;
revoke all on function public.ensure_my_buklod_qmp_finance_identity_v1() from public,anon;
grant execute on function public.ensure_my_buklod_qmp_finance_identity_v1() to authenticated;

-- A person's monthly QMP includes legitimately linked account history,
-- even after account recreation. It is never lifetime BP, rank, or ad clicks.
create or replace function private.buklod_pf_monthly_points_v3(
  p_person_id uuid,p_start timestamptz,p_end timestamptz
) returns bigint
language sql stable security definer set search_path to ''
as $function$
  select coalesce(sum(a.qualified_qmp),0)::bigint
  from private.buklod_community_settlement_periods cp
  join private.buklod_community_qmp_accounts a
    on a.settlement_period_id=cp.id and a.qualified_qmp>0
  join private.buklod_pf_user_links l
    on l.user_id=a.user_id and l.person_id=p_person_id
  where cp.starts_at=p_start and cp.ends_at=p_end
$function$;
revoke all on function private.buklod_pf_monthly_points_v3(uuid,timestamptz,timestamptz)
  from public,anon,authenticated;

-- This value is also the canonical denominator for payout allocation.
create or replace function private.buklod_pf_total_monthly_qmp_v1(
  p_start timestamptz,p_end timestamptz
) returns bigint
language sql stable security definer set search_path to ''
as $function$
  select coalesce(sum(q.qualified_qmp),0)::bigint
  from private.buklod_community_settlement_periods cp
  join private.buklod_community_qmp_accounts q
    on q.settlement_period_id=cp.id and q.qualified_qmp>0
  join private.buklod_pf_user_links l on l.user_id=q.user_id
  join private.buklod_pf_persons p on p.person_id=l.person_id
  join public.profiles pr on pr.id=p.current_user_id
  where cp.starts_at=p_start and cp.ends_at=p_end
    and p.risk_status='CLEAR'
    and pr.is_active=true and pr.user_deactivated_at is null
$function$;
revoke all on function private.buklod_pf_total_monthly_qmp_v1(timestamptz,timestamptz)
  from public,anon,authenticated;

-- Only the missing, active, authenticated identities that already have
-- qualified QMP. No cash ledger, existing payouts or entitlement updates.
do $backfill$
declare
  v_user record;
begin
  for v_user in
    select distinct q.user_id
    from private.buklod_community_qmp_accounts q
    join auth.users au on au.id=q.user_id
    join public.profiles pr on pr.id=q.user_id
    where q.qualified_qmp>0
      and pr.is_active=true and pr.user_deactivated_at is null
    order by q.user_id
  loop
    perform private.buklod_pf_ensure_qmp_person_v1(v_user.user_id);
  end loop;
end;
$backfill$;

comment on function public.ensure_my_buklod_qmp_finance_identity_v1() is
'Own-account link for qualified QMP participation. Does not create cash, grant payout, or bypass finance/fraud gates.';
