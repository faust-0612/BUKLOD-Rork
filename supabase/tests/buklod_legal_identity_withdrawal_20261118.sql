-- BUKLOD MAIN staging DB contract: run only AFTER private legal identity migration.
-- No finance activation, no identity records touched.
do $verify$
declare v_definition text;
begin
 if to_regclass('private.buklod_legal_identity_v1') is null then
  raise exception 'Legal identity table missing'; end if;
 if (select public from storage.buckets where id='buklod-identity-private') is distinct from false then
  raise exception 'Government ID bucket must be PRIVATE'; end if;
 if not (select relrowsecurity from pg_class
  where oid='private.buklod_legal_identity_v1'::regclass) then
  raise exception 'Legal identity RLS must be on'; end if;
 if has_table_privilege('authenticated','private.buklod_legal_identity_v1','SELECT')
  or has_table_privilege('anon','private.buklod_legal_identity_v1','SELECT') then
  raise exception 'Private ID status may not be read by ordinary SQL grants'; end if;

 if not exists(select 1 from pg_policies
  where schemaname='storage' and tablename='objects'
  and policyname='buklod_identity_owner_insert_v1') then
  raise exception 'Owner-only ID upload policy missing'; end if;
 if not exists(select 1 from pg_policies
  where schemaname='storage' and tablename='objects'
  and policyname='buklod_identity_private_read_v1') then
  raise exception 'Private ID reviewer access policy missing'; end if;

 if has_function_privilege('anon','public.admin_review_buklod_identity_v1(uuid,integer,boolean,text,text)','EXECUTE')
  or has_function_privilege('anon','public.get_my_buklod_identity_status_v1()','EXECUTE') then
  raise exception 'Anonymous user may call a legal-ID endpoint'; end if;
 if has_function_privilege('authenticated','public.request_my_buklod_pf_withdrawal_v2_unverified_legacy(text,text,text,text)','EXECUTE')
  or has_function_privilege('authenticated','public.request_my_buklod_r38_referral_withdrawal_v1_unverified_legacy(text,text,text,text)','EXECUTE')
  or has_function_privilege('authenticated','public.admin_mark_buklod_pf_withdrawal_paid_v2_unverified_legacy(uuid,text)','EXECUTE') then
  raise exception 'A legacy unverified money RPC is directly callable'; end if;

 v_definition:=pg_get_functiondef('public.request_my_buklod_pf_withdrawal_v2(text,text,text,text)'::regprocedure);
 if position('buklod_require_legal_identity_for_withdrawal_v1' in v_definition)=0
  or position('get_my_buklod_pf_payout_profile_v2' in v_definition)=0 then
  raise exception 'Canonical withdrawal lacks legal-ID/payout-name gate'; end if;
 v_definition:=pg_get_functiondef('public.admin_mark_buklod_pf_withdrawal_paid_v2(uuid,text)'::regprocedure);
 if position('admin_get_buklod_pf_withdrawal_payout_details_v2' in v_definition)=0 then
  raise exception 'Paid status does not revalidate beneficiary identity'; end if;
 if not exists(select 1 from pg_trigger
  where tgrelid='public.profiles'::regclass and tgname='aa_buklod_legal_name_profile_guard_v1'
   and not tgisinternal) then
  raise exception 'Real-name profile guard trigger missing'; end if;
end $verify$;
