-- Exact source-only Health consultation role acceptance on ephemeral PostgreSQL 17.
-- This test intentionally does NOT deploy anything or interact with live Supabase.
\set ON_ERROR_STOP on
\ir ../../tests/fixtures/nov14_health_access_rls.sql

-- Verify Data API write privileges are NOT broadly granted, including after the
-- patient, nonparticipant, approved clinician and revoked clinician cases above.
do $$
begin
  if has_table_privilege('anon','public.buklod_hc_consultation_cases','SELECT')
  or has_table_privilege('anon','public.buklod_hc_consultation_messages','SELECT')
  or has_table_privilege('anon','public.buklod_hc_verified_professionals','SELECT')
  or has_table_privilege('authenticated','public.buklod_hc_consultation_cases','UPDATE')
  or has_table_privilege('authenticated','public.buklod_hc_consultation_messages','UPDATE')
  or has_table_privilege('authenticated','public.buklod_hc_verified_professionals','INSERT')
  then
    raise exception 'health role grants are broader than approved patient/clinician contract';
  end if;
end $$;
