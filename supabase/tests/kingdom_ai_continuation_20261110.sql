-- Run in a rollback-only QA session after applying the corresponding DEV migration.
-- Never create fake BP credits or persist synthetic user attempts in production.
begin;
do $test$
declare
  v_total int;
  v_invalid int;
  v_duplicate int;
  v_covered int;
  v_enabled bool;
begin
  select count(*) into v_total
    from private.buklod_kingdom_mastery_bank_v1;
  if v_total < 780 then
    raise exception 'Expected at least 780 reviewed Kingdom mastery questions; got %',v_total;
  end if;
  select count(*) into v_covered
  from (
    select game_id from private.buklod_kingdom_mastery_bank_v1
    group by game_id having count(*)=20
  ) complete_games;
  if v_covered<>39 then
    raise exception 'Expected 20 questions for each of 39 games; got % complete games',v_covered;
  end if;

  select count(*) into v_invalid
  from private.buklod_kingdom_mastery_bank_v1 b
  where jsonb_typeof(b.choices)<>'array'
    or jsonb_array_length(b.choices)<>4
    or b.answer_index not between 0 and 3
    or length(trim(b.prompt))<20;
  if v_invalid<>0 then raise exception 'Invalid Kingdom question rows: %',v_invalid; end if;

  select count(*) into v_duplicate from (
    select game_id, lower(regexp_replace(trim(prompt),'\s+',' ','g')) as normalized
    from private.buklod_kingdom_mastery_bank_v1
    group by game_id,lower(regexp_replace(trim(prompt),'\s+',' ','g'))
    having count(*)>1
  ) d;
  if v_duplicate<>0 then raise exception 'Repeated Kingdom question text: %',v_duplicate; end if;

  select c.relrowsecurity into v_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='buklod_kingdom_ai_levels_v1';
  if coalesce(v_enabled,false)<>true then raise exception 'AI level RLS is not enabled'; end if;
  if has_table_privilege('authenticated','public.buklod_kingdom_ai_levels_v1','SELECT')
    or has_table_privilege('anon','public.buklod_kingdom_ai_levels_v1','SELECT') then
    raise exception 'AI level answers must not be exposed through Data API roles';
  end if;
  if to_regprocedure('public.reserve_my_buklod_kingdom_ai_level_v1(text,integer)') is null then
    raise exception 'Missing rate-limited AI level reservation RPC';
  end if;
  if to_regprocedure('public.start_my_buklod_kingdom_mastery_v1(text)') is null then
    raise exception 'Mastery RPC missing after anti-repeat migration';
  end if;
end
$test$;
rollback;
