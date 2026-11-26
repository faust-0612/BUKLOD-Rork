-- Run on isolated migrated database before activating either flag.
do $test$
begin
 if has_function_privilege('anon','public.buklod_bible_hybrid_reuse_candidate(text)','EXECUTE')
 or has_function_privilege('authenticated','public.buklod_bible_hybrid_reuse_candidate(text)','EXECUTE')
 or has_function_privilege('anon','public.buklod_bible_hybrid_record(uuid,uuid,text,int,jsonb,text)','EXECUTE')
 or has_function_privilege('authenticated','public.buklod_bible_hybrid_record(uuid,uuid,text,int,jsonb,text)','EXECUTE') then raise exception 'Hybrid cache privilege regression';end if;
 if not exists(select 1 from private.buklod_bible_hybrid_control where singleton and not shadow_cache_enabled) then raise exception 'Cache must default off';end if;
end;
$test$;
-- Required integration fixtures: same-account full verdict hit; different account, question,
-- rubric, answer/order, model, expired, partial, negative, conflict, copied receipt all miss.
-- Verify no budget increment, TTL renewal, score or BP mutation, including concurrent calls.
