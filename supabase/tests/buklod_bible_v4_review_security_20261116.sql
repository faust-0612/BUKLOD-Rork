-- Read-only regression contract. Run after adding V4 review-details migration.
-- Prevent cross-account review leakage and early answer disclosure.
do $bible_v4_review_contract$
declare
 f text;
 v_is_definer boolean;
 v_configs text[];
begin
 if to_regprocedure('public.get_my_buklod_bible_quiz_v4_review_details(uuid)') is null then
  raise exception 'Bible V4 review detail RPC missing';
 end if;
 select pg_get_functiondef('public.get_my_buklod_bible_quiz_v4_review_details(uuid)'::regprocedure),
        x.prosecdef,
        x.proconfig
 into f,v_is_definer,v_configs
 from pg_proc x
 where x.oid='public.get_my_buklod_bible_quiz_v4_review_details(uuid)'::regprocedure;
 if f is null then raise exception 'No review RPC definition';end if;
 if not coalesce(v_is_definer,false) or not exists(select 1 from unnest(coalesce(v_configs,array[]::text[])) as cfg(setting) where cfg.setting in ('search_path=','search_path=""')) then
  raise exception 'Review RPC search_path or security definer guard missing';
 end if;
 if position('x.user_id=actor' in regexp_replace(lower(f),'[[:space:]]+','','g'))=0 then
  raise exception 'Review RPC user ownership check missing';
 end if;
 if position('ifa.state=''started''thenreturnjsonb_build_object(''review'',null)' in regexp_replace(lower(f),'[[:space:]]+','','g'))=0 then
  raise exception 'Pre-submission answer access guard missing';
 end if;
 if position('submitted_answers' in f)=0 then
  raise exception 'Review details fail to contain submitted response';
 end if;
 if has_function_privilege('anon','public.get_my_buklod_bible_quiz_v4_review_details(uuid)','EXECUTE') then
  raise exception 'Anon must not execute review details';
 end if;
 if not has_function_privilege('authenticated','public.get_my_buklod_bible_quiz_v4_review_details(uuid)','EXECUTE') then
  raise exception 'Authenticated review access missing';
 end if;
 if position('buklod_points_ledger' in f)>0 then
  raise exception 'Review retrieval must not mutate reward ledger';
 end if;
end $bible_v4_review_contract$;
