-- BUKLOD QMP V4: read-only, account-scoped simulation of the APPROVED
-- milestone and legacy fairness weights. There is NO write to QMP events,
-- monthly accounts, rules, finance settlement, wallet, revenue, or payouts.
-- Must not become a settlement weight until verified financial RC and policy
-- compliance approval. Historical QMP rows are never mutated or restored.
create or replace function public.get_my_buklod_qmp_v4_bonus_preview()
returns jsonb language plpgsql stable security definer set search_path=''
as $qmp_preview$
declare
 v_actor uuid := (select auth.uid());
 v_period private.buklod_community_settlement_periods%rowtype;
 v_current bigint := 0;
 v_historical bigint := 0;
 v_earned_bp bigint := 0;
 v_active_days bigint := 0;
 v_milestone bigint := 0;
 v_legacy bigint := 0;
 v_bonus bigint := 0;
begin
 if v_actor is null or not exists (
   select 1 from public.profiles p where p.id=v_actor and p.is_active=true
 ) then
   raise exception 'Active member required' using errcode='42501';
 end if;
 if private.buklod_is_platform_official_v1(v_actor) then
   raise exception 'Official publisher identity excluded' using errcode='42501';
 end if;
 select * into v_period
 from private.buklod_community_settlement_periods p
 where p.starts_at<=now() and p.ends_at>now() and p.status='OPEN'
 order by p.starts_at desc limit 1;
 if v_period.id is null then
   return jsonb_build_object('status','no_open_period','preview_only',true,
                              'bonus_qmp',0,'cash_effect',false);
 end if;
 select coalesce(a.qualified_qmp,0)::bigint into v_current
 from private.buklod_community_qmp_accounts a
 where a.user_id=v_actor and a.settlement_period_id=v_period.id;
 v_current:=coalesce(v_current,0);
 select coalesce(sum(a.qualified_qmp),0)::bigint into v_historical
 from private.buklod_community_qmp_accounts a
 join private.buklod_community_settlement_periods p
   on p.id=a.settlement_period_id
 where a.user_id=v_actor and p.starts_at<v_period.starts_at;
 select count(*)::bigint into v_active_days
 from private.buklod_community_qmp_active_days d
 where d.user_id=v_actor and d.settlement_period_id=v_period.id;
 -- Earned BP is based on the original verified server-issued credit date,
 -- never on later Claim/Claim All clicks, ad interactions or withdrawals.
 select coalesce(sum(l.points),0)::bigint into v_earned_bp
 from public.buklod_points_ledger l
 where l.user_id=v_actor and l.direction='credit'
   and l.created_at>=v_period.starts_at
   and l.created_at<v_period.ends_at;
 v_milestone:=
   (case when v_earned_bp>=50 then 2 else 0 end)
   +(case when v_earned_bp>=150 then 3 else 0 end)
   +(case when v_earned_bp>=300 then 5 else 0 end);
 if v_active_days>=4 and v_current>=20 then
   v_legacy:=least(floor(v_current::numeric*0.10)::bigint,
                   floor(sqrt(greatest(v_historical,0)::numeric))::bigint);
 end if;
 -- Cumulative bonus <= 15% of current qualified participation.
 v_bonus:=least(v_milestone+v_legacy,
               floor(v_current::numeric*0.15)::bigint);
 return jsonb_build_object(
   'status','preview_only','preview_only',true,
   'period_key',v_period.period_key,
   'current_qualified_qmp',v_current,
   'historical_qualified_qmp',v_historical,
   'current_earned_bp',v_earned_bp,
   'current_active_days',v_active_days,
   'milestone_bonus_qmp',v_milestone,
   'legacy_bonus_qmp',v_legacy,
   'capped_preview_bonus_qmp',v_bonus,
   'preview_total_qmp',v_current+v_bonus,
   'cash_effect',false,'ad_view_qualification',false,
   'changes_existing_monthly_settlement',false
 );
end;
$qmp_preview$;
revoke all on function public.get_my_buklod_qmp_v4_bonus_preview()
 from public,anon,authenticated;
grant execute on function public.get_my_buklod_qmp_v4_bonus_preview()
 to authenticated;
comment on function public.get_my_buklod_qmp_v4_bonus_preview() is
 'Non-financial preview: +2/+3/+5 milestones, max 10 percent legacy, min four activity days and 20 current QMP, total bonus max 15 percent. Never an ad-view or cash credit.';
