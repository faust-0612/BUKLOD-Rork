-- Run after applying V4 migrations in an isolated test database. No writes here.
do $v4$
declare f text;
begin
 if to_regclass('private.buklod_bible_v4_questions') is null
  or to_regclass('private.buklod_bible_v4_attempts') is null
  or to_regclass('private.buklod_bible_v4_events') is null
  or to_regclass('private.buklod_bible_v4_event_entries') is null
 then raise exception 'Bible V4 private schema missing';end if;
 if to_regprocedure('public.get_my_buklod_bible_quiz_v4(text)') is null
  or to_regprocedure('public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)') is null
  or to_regprocedure('public.admin_create_buklod_bible_event_v4(text,text,timestamptz,integer,integer)') is null
  or to_regprocedure('public.join_my_buklod_bible_arena_v4(uuid,boolean)') is null
 then raise exception 'Bible V4 secure APIs missing';end if;
 select pg_get_functiondef('public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)'::regprocedure) into f;
 if position('private.buklod_bible_v4_finalize' in f)=0 or position('for update' in lower(f))=0 then
  raise exception 'Quiz server scoring lacks locks or finalization';end if;
 select pg_get_functiondef('public.submit_my_buklod_bible_event_v4(uuid,jsonb)'::regprocedure) into f;
 if position('rank_slot<=3' in regexp_replace(lower(f),'\s+','','g'))=0 then
  raise exception 'First-three official ranking absent';end if;
 select pg_get_functiondef('public.admin_review_buklod_bible_v4_essay(uuid,integer,text)'::regprocedure) into f;
 if position('buklod_is_system_admin' in f)=0 then raise exception 'Admin essay role guard missing';end if;
 if (select count(*) from private.buklod_bible_v4_questions where difficulty='hard' and kind='mcq'
    and skill in ('situation','analysis','comparison') and reviewed and active)<20 then
  raise exception 'Insufficient contextual Hard bank';end if;
end $v4$;
