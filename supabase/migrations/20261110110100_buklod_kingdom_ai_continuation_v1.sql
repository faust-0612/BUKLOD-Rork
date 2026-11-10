-- DEV/HOLD: BUKLOD Kingdom optional AI practice continuation; NO BP/XP/cash awards.
-- Deploy only after SQL/RLS/cost and live-function validation. Existing mastery tables untouched.
create table if not exists public.buklod_kingdom_ai_levels_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references private.buklod_kingdom_mastery_catalog_v1(game_id),
  level_no integer not null check (level_no between 1 and 200),
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  questions jsonb,
  generation_attempts integer not null default 1 check (generation_attempts between 1 and 2),
  completed_at timestamptz,
  final_score integer check (final_score between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,game_id,level_no),
  constraint kingdom_ai_questions_array check (
    questions is null or jsonb_typeof(questions) = 'array'
  )
);
create index if not exists buklod_kingdom_ai_levels_daily_idx
  on public.buklod_kingdom_ai_levels_v1(created_at,user_id);
create index if not exists buklod_kingdom_ai_levels_member_idx
  on public.buklod_kingdom_ai_levels_v1(user_id,game_id,level_no desc);
alter table public.buklod_kingdom_ai_levels_v1 enable row level security;
-- Quiz answers never appear in RLS-selectable rows; all read/write occurs through a
-- validated Edge Function using server credentials. Nothing here awards BP.
revoke all on public.buklod_kingdom_ai_levels_v1 from public, anon, authenticated;
grant select,insert,update on public.buklod_kingdom_ai_levels_v1 to service_role;

create or replace function public.reserve_my_buklod_kingdom_ai_level_v1(
  p_game_id text, p_after_level integer default 0
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_uid uuid := (select auth.uid());
  v_game text := lower(trim(coalesce(p_game_id,'')));
  v_next integer;
  v_today timestamptz :=
    (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila');
  v_row public.buklod_kingdom_ai_levels_v1%rowtype;
  v_title text;
  v_genre text;
  v_previous jsonb;
  v_daily integer;
  v_started boolean := false;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if p_after_level is null or p_after_level < 0 or p_after_level >= 200
    then raise exception 'Invalid prior level'; end if;
  select c.title, c.genre into v_title,v_genre
    from private.buklod_kingdom_mastery_catalog_v1 c
    where c.game_id=v_game and c.active;
  if not found then raise exception 'Unknown Kingdom game'; end if;

  -- Per-account/game serialization then global daily cap, preventing duplicate
  -- billable generations across parallel taps and at-scale provider-cost abuse.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':kingdom:ai:'||v_game,0));
  perform pg_advisory_xact_lock(hashtextextended('kingdom:ai:daily:'||v_today::text,0));
  v_next := p_after_level + 1;
  if p_after_level > 0 and not exists (
    select 1 from public.buklod_kingdom_ai_levels_v1 x
    where x.user_id=v_uid and x.game_id=v_game
      and x.level_no=p_after_level and x.status='ready'
      and x.completed_at is not null
  ) then raise exception 'Finish previous AI practice level first'; end if;

  select * into v_row from public.buklod_kingdom_ai_levels_v1 x
    where x.user_id=v_uid and x.game_id=v_game and x.level_no=v_next
    for update;
  if not found then
    select count(*) into v_daily from public.buklod_kingdom_ai_levels_v1 x
      where x.user_id=v_uid and x.created_at>=v_today;
    if v_daily>=4 then raise exception 'Daily AI level allowance reached (4)'; end if;
    select count(*) into v_daily from public.buklod_kingdom_ai_levels_v1 x
      where x.user_id=v_uid and x.game_id=v_game and x.created_at>=v_today;
    if v_daily>=2 then raise exception 'Daily AI game allowance reached (2)'; end if;
    select count(*) into v_daily from public.buklod_kingdom_ai_levels_v1 x
      where x.created_at>=v_today;
    if v_daily>=100 then raise exception 'Kingdom AI global daily generation cap reached'; end if;
    insert into public.buklod_kingdom_ai_levels_v1(user_id,game_id,level_no)
      values(v_uid,v_game,v_next) returning * into v_row;
    v_started := true;
  elsif (
    (v_row.status='failed' and v_row.updated_at<now()-interval '30 seconds')
    or (v_row.status='generating' and v_row.updated_at<now()-interval '2 minutes')
  ) and v_row.generation_attempts<2 then
    update public.buklod_kingdom_ai_levels_v1
      set status='generating',generation_attempts=generation_attempts+1,updated_at=now()
      where id=v_row.id returning * into v_row;
    v_started := true;
  end if;

  select coalesce(jsonb_agg(q.item->>'prompt'),'[]'::jsonb) into v_previous
  from (
    select x.questions from public.buklod_kingdom_ai_levels_v1 x
     where x.user_id=v_uid and x.game_id=v_game
       and x.level_no<v_next and x.status='ready'
     order by x.level_no desc limit 10
  ) history
  cross join lateral jsonb_array_elements(coalesce(history.questions,'[]'::jsonb)) as q(item);
  return jsonb_build_object(
    'session_id',v_row.id,'game_id',v_game,'game_title',v_title,
    'genre',v_genre,'level',v_next,'status',v_row.status,
    'prior_questions',v_previous,
    'generation_attempts',v_row.generation_attempts,
    'updated_at',v_row.updated_at,'started',v_started
  );
end;
$body$;
revoke all on function public.reserve_my_buklod_kingdom_ai_level_v1(text,integer)
  from public,anon;
grant execute on function public.reserve_my_buklod_kingdom_ai_level_v1(text,integer)
  to authenticated;

comment on table public.buklod_kingdom_ai_levels_v1 is
  'Private AI-generated optional Kingdom practice only. No BP, Character XP, Circle Rank, QMP or economic ledger side effects.';

-- Server-confirmed practice completion and account-scoped continuity. This is
-- deliberately isolated from all BP, QMP, cash, character XP and reward RPCs.
create or replace function public.finish_my_buklod_kingdom_ai_level_v1(
  p_session_id uuid, p_answers jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $finish$
declare
  v_uid uuid := (select auth.uid());
  v_row public.buklod_kingdom_ai_levels_v1%rowtype;
  v_score integer;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array'
    or jsonb_array_length(p_answers)<>3
    or exists (
      select 1 from jsonb_array_elements(p_answers) as ans(item)
      where jsonb_typeof(ans.item)<>'number'
        or ans.item::text !~ '^[0-3]$'
    ) then raise exception 'Exactly three numbered answers 0 through 3 are required';
  end if;
  select * into v_row from public.buklod_kingdom_ai_levels_v1 x
    where x.id=p_session_id and x.user_id=v_uid
      and x.status='ready' for update;
  if not found then raise exception 'Practice session unavailable'; end if;
  if v_row.completed_at is not null then
    return jsonb_build_object('completed',true,'score',v_row.final_score,
      'level',v_row.level_no,'practice_only',true,'bp_awarded',0);
  end if;
  select count(*)::integer into v_score
  from jsonb_array_elements(v_row.questions) with ordinality as q(item,ord)
  where (p_answers->>(q.ord::integer-1))::integer
        = (q.item->>'answer_index')::integer;
  update public.buklod_kingdom_ai_levels_v1
    set completed_at=now(), final_score=v_score, updated_at=now()
    where id=v_row.id;
  return jsonb_build_object('completed',true,'score',v_score,
    'level',v_row.level_no,'practice_only',true,'bp_awarded',0);
end;
$finish$;
revoke all on function public.finish_my_buklod_kingdom_ai_level_v1(uuid,jsonb)
  from public,anon;
grant execute on function public.finish_my_buklod_kingdom_ai_level_v1(uuid,jsonb)
  to authenticated;

create or replace function public.get_my_buklod_kingdom_ai_progress_v1(
  p_game_id text
) returns jsonb language sql stable security definer set search_path=''
as $progress$
  select jsonb_build_object(
    'completed_level',coalesce(max(
      case when x.completed_at is not null then x.level_no else 0 end),0),
    'unfinished_level',min(
      case when x.status='ready' and x.completed_at is null
      then x.level_no else null end),
    'practice_only',true,'bp_awarded',0
  )
  from public.buklod_kingdom_ai_levels_v1 x
  where x.user_id=(select auth.uid())
    and x.game_id=lower(trim(coalesce(p_game_id,'')));
$progress$;
revoke all on function public.get_my_buklod_kingdom_ai_progress_v1(text)
  from public,anon;
grant execute on function public.get_my_buklod_kingdom_ai_progress_v1(text)
  to authenticated;
