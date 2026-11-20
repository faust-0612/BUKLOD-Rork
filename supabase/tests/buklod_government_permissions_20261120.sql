-- BUKLOD Government focused permission and transaction contracts; run on a local DB
-- AFTER applying the government migration. Read-only assertions, rollback by design.
begin;
do $test$
declare
 v_table text;
 v_rls boolean;
 v_procedure text;
begin
 foreach v_table in array array[
  'buklod_government_entities','buklod_government_staff',
  'buklod_government_jurisdictions','buklod_government_publications',
  'buklod_government_services','buklod_government_events',
  'buklod_government_follows','buklod_government_cases',
  'buklod_government_case_events','buklod_government_audit'
 ] loop
  select c.relrowsecurity into v_rls from pg_class c join pg_namespace n
  on n.oid=c.relnamespace where n.nspname='public' and c.relname=v_table;
  if not coalesce(v_rls,false) then raise exception 'Government RLS missing on %',v_table; end if;
 end loop;
 if has_table_privilege('anon','public.buklod_government_cases','SELECT')
  or has_table_privilege('anon','public.buklod_government_entities','INSERT')
  or has_table_privilege('authenticated','public.buklod_government_cases','INSERT')
  or has_table_privilege('authenticated','public.buklod_government_cases','UPDATE')
  or has_table_privilege('authenticated','public.buklod_government_case_events','INSERT')
  or has_table_privilege('authenticated','public.buklod_government_audit','INSERT')
 then raise exception 'Government private concern or agency data bypasses intended RPC-only privileges'; end if;
 if not has_table_privilege('authenticated','public.buklod_government_cases','SELECT') then
  raise exception 'Citizens need RLS-filtered access to their submitted concerns'; end if;
 if not has_function_privilege('authenticated','public.buklod_government_submit_case_v1(uuid,text,text,text,uuid)','EXECUTE')
  or has_function_privilege('anon','public.buklod_government_submit_case_v1(uuid,text,text,text,uuid)','EXECUTE')
 then raise exception 'Concern intake RPC grants are incorrect'; end if;
 if not has_function_privilege('authenticated','public.buklod_government_publish_v1(uuid,text,text,text[],uuid,boolean)','EXECUTE')
  or has_function_privilege('anon','public.buklod_government_publish_v1(uuid,text,text,text[],uuid,boolean)','EXECUTE')
 then raise exception 'Official publisher RPC grants are incorrect'; end if;
 if not has_function_privilege('authenticated','public.buklod_government_case_transition_v1(uuid,text,text,uuid)','EXECUTE')
  or has_function_privilege('anon','public.buklod_government_case_transition_v1(uuid,text,text,uuid)','EXECUTE')
 then raise exception 'Concern transition RPC grants are incorrect'; end if;
 select pg_get_functiondef('public.buklod_government_publish_v1(uuid,text,text,text[],uuid,boolean)'::regprocedure) into v_procedure;
 if position('buklod_government_private.has_role(' in v_procedure)=0
  or position('create_buklod_community_post_v3(' in v_procedure)=0
  or position('Location outside verified agency jurisdiction' in v_procedure)=0
  or position('pg_advisory_xact_lock(' in v_procedure)=0
 then raise exception 'Official publishing lacks authority, locality, canonical moderation or idempotency checks'; end if;
 select pg_get_functiondef('public.buklod_government_submit_case_v1(uuid,text,text,text,uuid)'::regprocedure) into v_procedure;
 if position('auth.uid()' in v_procedure)=0
  or position('Daily concern limit reached' in v_procedure)=0
  or position('pg_advisory_xact_lock(' in v_procedure)=0
 then raise exception 'Private concern submission has an incomplete server contract'; end if;
 if not exists(select 1 from pg_policies
   where schemaname='public' and tablename='buklod_government_cases'
   and policyname='gov_cases_read' and qual like '%submitted_by%auth.uid%') then
  raise exception 'Concern RLS does not protect citizen ownership'; end if;
 if not exists(select 1 from pg_policies
   where schemaname='public' and tablename='buklod_government_entities'
   and policyname='gov_entities_verify' and qual like '%buklod_is_system_admin%') then
  raise exception 'Government official verification must be System Admin only'; end if;
end $test$;
rollback;
