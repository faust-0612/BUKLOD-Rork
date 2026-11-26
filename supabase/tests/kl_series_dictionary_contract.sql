-- Read-only post-migration contract, run on local/authorized staging only.
-- The independent PostgreSQL fixture covers create/publish, storage RLS and worker writes.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);
select ok(to_regclass('public.kl_series_v1') is not null,'series table exists');
select ok(to_regclass('private.kl_dictionary_jobs_v1') is not null,'private job table exists');
select ok((select relrowsecurity from pg_class where oid='public.kl_series_v1'::regclass),'series RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.kl_dictionary_jobs_v1'::regclass),'job RLS enabled');
select ok(not has_table_privilege('anon','public.kl_series_v1','SELECT'),'no direct anonymous series table access');
select ok(not has_table_privilege('authenticated','public.kl_series_v1','INSERT'),'no member direct series creation');
select ok(not has_table_privilege('authenticated','private.kl_dictionary_jobs_v1','SELECT'),'job details not exposed');
select ok(not has_function_privilege('anon','public.kl_series_save_v1(integer,text,text,boolean)','EXECUTE'),'no anonymous series mutations');
select ok(not has_function_privilege('authenticated','public.kl_dictionary_claim_v1()','EXECUTE'),'no member job claims');
select ok(not has_function_privilege('authenticated','public.kl_dictionary_finish_v1(uuid,text,uuid,jsonb,text)','EXECUTE'),'no member job writes');
select ok(has_function_privilege('service_role','public.kl_dictionary_claim_v1()','EXECUTE'),'worker can claim');
select ok((select count(*)>=146 from private.kl_dictionary_curated_v1),'canonical glossary seeded');
select ok(exists(select 1 from public.kl_series_v1 where season_number=1 and published and length(btrim(title))>=3),'existing first series preserved');
select ok(exists(select 1 from storage.buckets where id='kl-series-covers' and not public and file_size_limit=5242880),'private cover bucket with size limit');
select * from finish();
rollback;
