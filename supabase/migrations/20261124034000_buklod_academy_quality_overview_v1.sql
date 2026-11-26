-- DEV/STAGING ONLY: anonymized, non-writable Academy quality metrics for founder oversight.
-- No learner manual approvals, no score edits, no academic credit mutations.
-- Existing Academy configuration remains OFF unless separately staged and verified.
create or replace function public.buklod_academy_quality_overview_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
  raise exception 'System Admin access required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'observed_at',pg_catalog.now(),
  'academy_enabled',coalesce((select c.enabled from public.buklod_university_config c where c.singleton),false),
  'source_adapters_ready',(select count(*) from public.buklod_academy_learning_sources s
     where s.readiness='DEV_VERIFIED'),
  'source_adapters_pending',(select count(*) from public.buklod_academy_learning_sources s
     where s.readiness in ('PENDING_SOURCE','DEV_BRIDGE')),
  'source_adapters_blocked',(select count(*) from public.buklod_academy_learning_sources s
     where s.readiness='BLOCKED_CONTENT'),
  'research_submitted',(select count(*) from public.buklod_academy_research_submissions r where r.status='SUBMITTED'),
  'research_reviewing',(select count(*) from public.buklod_academy_research_submissions r where r.status='REVIEWING'),
  'research_rework',(select count(*) from public.buklod_academy_research_submissions r where r.status='REWORK'),
  'research_stale_reviewing',(select count(*) from public.buklod_academy_research_submissions r
     where r.status='REVIEWING' and r.review_started_at < pg_catalog.now()-interval '10 minutes'),
  'research_verified_30d',(select count(*) from public.buklod_academy_research_submissions r
     where r.status='VERIFIED' and r.reviewed_at >= pg_catalog.now()-interval '30 days'),
  'uc_events_30d',(select count(*) from public.buklod_university_uc_ledger u
     where u.verified_at >= pg_catalog.now()-interval '30 days'),
  'awards_issued_30d',(select count(*) from public.buklod_university_awards a
     where a.status='ISSUED' and a.issued_at >= pg_catalog.now()-interval '30 days')
 );
end;
$$;
revoke all on function public.buklod_academy_quality_overview_v1() from public,anon,authenticated;
grant execute on function public.buklod_academy_quality_overview_v1() to authenticated;
