-- Run after R7 migration in an isolated DB.
do $test$
begin
 if has_table_privilege('anon','private.buklod_learning_evidence_receipts','SELECT')
 or has_table_privilege('authenticated','private.buklod_learning_evidence_receipts','SELECT')
 or has_function_privilege('anon','public.buklod_record_learning_evidence_v1(uuid,text,text,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.buklod_record_learning_evidence_v1(uuid,text,text,text,text,text)','EXECUTE') then raise exception 'Evidence access regression';end if;
 if not exists(select 1 from private.buklod_bible_hybrid_control where singleton and not evidence_pilot_enabled) then raise exception 'Evidence pilot must default off';end if;
end;
$test$;
-- Required transactional fixtures: authenticated own session, foreign session denial,
-- duplicate receipt, stale published content, service-only privilege, provider timeout.
