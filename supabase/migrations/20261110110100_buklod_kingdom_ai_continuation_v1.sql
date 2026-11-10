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
  elsif v_row.status='failed' and v_row.generation_attempts<2
      and v_row.updated_at<now()-interval '30 seconds' then
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
