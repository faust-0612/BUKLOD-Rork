-- ABaKa doctrine reward and RLS assertions. Run AFTER migration in an isolated staging database.
-- Read-only metadata verification; no live user or points records are created or modified.
begin;
do $test$
declare
  v_api oid := to_regprocedure('public.complete_my_abc_doctrinal_lesson_v1(text,text,text)');
  v_progress oid := to_regprocedure('public.get_my_abc_growth_progress_v1()');
  v_catalog oid := to_regclass('public.buklod_abc_doctrinal_lessons');
  v_private oid := to_regclass('private.buklod_abc_doctrinal_answers');
  v_policy integer;
  v_ids integer;
  v_body text;
begin
  if v_api is null or v_progress is null or v_catalog is null or v_private is null then
    raise exception 'ABaKa doctrine migration objects are incomplete';
  end if;

  if has_function_privilege('anon',v_api,'EXECUTE') or not has_function_privilege('authenticated',v_api,'EXECUTE') then
    raise exception 'Doctrinal completion RPC access grants are unsafe';
  end if;

  if has_table_privilege('anon',v_catalog,'SELECT') or
     has_table_privilege('authenticated',v_catalog,'INSERT') or
     has_table_privilege('authenticated',v_catalog,'UPDATE') or
     has_table_privilege('authenticated',v_catalog,'DELETE') or
     has_table_privilege('authenticated',v_private,'SELECT') then
    raise exception 'ABaKa published catalog / private answer key permissions broken';
  end if;

  if not (select relrowsecurity from pg_class where oid=v_catalog) then
    raise exception 'Published doctrinal catalog is missing RLS';
  end if;
  select count(*) into v_policy from pg_policies
    where schemaname='public' and tablename='buklod_abc_doctrinal_lessons'
      and cmd='SELECT' and qual like '%published%';
  if v_policy <> 1 then raise exception 'Expected one published-only SELECT policy'; end if;

  select count(*) into v_ids from public.buklod_abc_doctrinal_lessons
    where lesson_id in ('doctrine-0001','doctrine-0002','doctrine-0003','doctrine-0004')
      and not published and prerequisite_id is not null;
  if v_ids <> 4 then raise exception 'Unreviewed doctrinal drafts/prerequisite seeds missing'; end if;
  select count(*) into v_ids from private.buklod_abc_doctrinal_answers
    where lesson_id in ('doctrine-0001','doctrine-0002','doctrine-0003','doctrine-0004');
  if v_ids <> 4 then raise exception 'Private correct-answer set is incomplete'; end if;

  v_body := pg_get_functiondef(v_api);
  if position('pg_advisory_xact_lock' in v_body)=0
    or position('prerequisite_id' in v_body)=0
    or position('count(distinct lower(word))' in lower(v_body))=0
    or position('today_points + points_for_level <= 50' in v_body)=0
    or position('onconflict(user_id,source_key)donothing' in lower(pg_catalog.regexp_replace(v_body,'\s+','','g')))=0 then
    raise exception 'Doctrinal server validation, cap or ledger idempotence missing';
  end if;

  if to_regclass('private.buklod_abc_doctrine_quiz_attempts') is null or
     to_regclass('private.buklod_abc_doctrine_reflection_hashes') is null or
     has_table_privilege('authenticated','private.buklod_abc_doctrine_quiz_attempts','SELECT') or
     has_table_privilege('authenticated','private.buklod_abc_doctrine_reflection_hashes','INSERT') then
    raise exception 'Private quiz throttling and reflection anti-copy registry unavailable';
  end if;
  if position('quiz_cooldown' in v_body)=0 or
     position('reflection_hash := pg_catalog.md5' in v_body)=0 then
    raise exception 'Quiz cooldown or repeated reflection protection missing';
  end if;

  if not (select exists(
    select 1 from pg_constraint
    where conrelid='public.buklod_abc_growth_progress'::regclass
      and conname='buklod_abc_growth_progress_lesson_check'
      and pg_get_constraintdef(oid) like '%doctrine-%'
  )) then raise exception 'Doctrinal progress allowlist unavailable'; end if;

  -- Legacy RPC must remain independently available to previously installed clients.
  if to_regprocedure('public.complete_my_abc_growth_lesson_v1(text)') is null then
    raise exception 'Legacy ABaKa completion API missing';
  end if;
end;
$test$;
rollback;