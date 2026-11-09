-- Follow-up canonical code and referred status correction; v1 remains read-only.
-- BUKLOD referral display reconciliation — read-only, nonfinancial.
-- Every count/code is scoped to auth.uid(); historical invitations are not payouts.
create or replace function public.get_my_buklod_referral_reconciliation_v1()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_person uuid;
  v_financial_code text;
  v_legacy_code text;
  v_financial_total integer := 0;
  v_financial_qualified integer := 0;
  v_legacy_total integer := 0;
  v_legacy_qualified integer := 0;
  v_legacy_unreconciled integer := 0;
  v_total_unique integer := 0;
  v_was_referred boolean := false;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user and p.is_active=true) then
    raise exception 'Active account required';
  end if;
  v_person := private.buklod_pf_person_for_user_v2(v_user);
  select c.referral_code into v_financial_code
  from public.buklod_referral_codes_v2 c where c.person_id=v_person and c.is_active=true
  order by c.created_at limit 1;
  select c.referral_code into v_legacy_code
  from public.buklod_user_referral_codes c where c.user_id=v_user limit 1;

  select count(*)::integer,
         count(*) filter (where qualified_at is not null)::integer
  into v_financial_total,v_financial_qualified
  from private.buklod_pf_referrals r where r.referrer_person_id=v_person;
  select count(*)::integer,
         count(*) filter (where status in ('qualified','rewarded'))::integer
  into v_legacy_total,v_legacy_qualified
  from public.buklod_referrals r where r.referrer_id=v_user;
  select count(*)::integer into v_legacy_unreconciled
  from public.buklod_referrals l
  where l.referrer_id=v_user and not exists (
    select 1 from private.buklod_pf_referrals r
    join private.buklod_pf_persons p on p.person_id=r.referred_person_id
    where r.referrer_person_id=v_person and p.current_user_id=l.referred_id
  );
  select count(*)::integer into v_total_unique
  from (
    select 'user:'||l.referred_id::text as identity_key
    from public.buklod_referrals l where l.referrer_id=v_user
    union
    select case when p.current_user_id is null then 'person:'||r.referred_person_id::text
      else 'user:'||p.current_user_id::text end
    from private.buklod_pf_referrals r
    left join private.buklod_pf_persons p on p.person_id=r.referred_person_id
    where r.referrer_person_id=v_person
  ) deduplicated;
  select exists(select 1 from public.buklod_referrals l where l.referred_id=v_user)
    or exists(select 1 from private.buklod_pf_referrals r where r.referred_person_id=v_person)
  into v_was_referred;
  return jsonb_build_object(
    'identity_ready',v_person is not null,
    'was_referred',v_was_referred,
    'referral_code',coalesce(v_financial_code,''),
    'share_url',case when coalesce(v_financial_code,'')=''
      then null else 'https://buklod.expo.app/register?ref='||v_financial_code end,
    'legacy_code',v_legacy_code,
    'invited_count',v_total_unique,
    'qualified_count',v_financial_qualified,
    'legacy_invited_count',v_legacy_total,
    'legacy_qualified_count',v_legacy_qualified,
    'legacy_unreconciled_count',v_legacy_unreconciled,
    'financial_invited_count',v_financial_total,
    'financial_qualified_count',v_financial_qualified,
    'historical_invitations_do_not_create_cash',true
  );
end;
$$;
revoke all on function public.get_my_buklod_referral_reconciliation_v1() from public,anon;
grant execute on function public.get_my_buklod_referral_reconciliation_v1() to authenticated;
