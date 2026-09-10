-- BUKLOD IGPAT R7 — FULL COMPLETION BACKEND CONTRACT
-- Additive only. Existing Community/Reels tables and RPCs remain authoritative for media posts.
-- Safe objective: persist IGPAT-only saves, recommendation feedback, analytics, Bond actions and Arena.

create extension if not exists pgcrypto;

create table if not exists public.igpat_saved_posts (
  user_id uuid not null default auth.uid(),
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.igpat_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  feedback_kind text not null check (feedback_kind in ('not_interested','show_fewer','dont_recommend_creator','hide')),
  post_id uuid null,
  creator_id uuid null,
  created_at timestamptz not null default now(),
  check (post_id is not null or creator_id is not null)
);
create index if not exists igpat_feedback_user_created_idx on public.igpat_feedback(user_id, created_at desc);
create index if not exists igpat_feedback_post_idx on public.igpat_feedback(post_id) where post_id is not null;
create index if not exists igpat_feedback_creator_idx on public.igpat_feedback(creator_id) where creator_id is not null;

create table if not exists public.igpat_events (
  id bigint generated always as identity primary key,
  user_id uuid null default auth.uid(),
  event_name text not null,
  post_id uuid null,
  creator_id uuid null,
  feed_source text null,
  watch_ms integer not null default 0 check (watch_ms >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists igpat_events_post_created_idx on public.igpat_events(post_id, created_at desc) where post_id is not null;
create index if not exists igpat_events_user_created_idx on public.igpat_events(user_id, created_at desc) where user_id is not null;
create index if not exists igpat_events_name_created_idx on public.igpat_events(event_name, created_at desc);

create table if not exists public.igpat_bond_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('relay','pass','capsule','mosaic','memory_echo')),
  post_id uuid not null,
  target_id uuid null,
  message text null check (char_length(coalesce(message,'')) <= 1200),
  unlock_at timestamptz null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','OPENED','EXPIRED','REMOVED')),
  created_at timestamptz not null default now()
);
create index if not exists igpat_bond_actor_created_idx on public.igpat_bond_actions(actor_user_id, created_at desc);
create index if not exists igpat_bond_target_created_idx on public.igpat_bond_actions(target_id, created_at desc) where target_id is not null;
create index if not exists igpat_bond_post_idx on public.igpat_bond_actions(post_id, created_at desc);

create table if not exists public.igpat_arena_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null default auth.uid(),
  mode text not null check (mode in ('duel','prove_it','squad_battle','king_of_the_hill','hard_mode','iron_streak','ranked_season','boss_challenge','last_man_standing','bounty_challenge')),
  post_id uuid null,
  opponent_user_id uuid null,
  squad_id uuid null,
  title text null check (char_length(coalesce(title,'')) <= 160),
  status text not null default 'OPEN' check (status in ('OPEN','ACCEPTED','ACTIVE','COMPLETED','CANCELLED')),
  winner_user_id uuid null,
  respect_score integer not null default 0 check (respect_score >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);
create index if not exists igpat_arena_open_idx on public.igpat_arena_challenges(status, created_at desc);
create index if not exists igpat_arena_creator_idx on public.igpat_arena_challenges(creator_user_id, created_at desc);

alter table public.igpat_saved_posts enable row level security;
alter table public.igpat_feedback enable row level security;
alter table public.igpat_events enable row level security;
alter table public.igpat_bond_actions enable row level security;
alter table public.igpat_arena_challenges enable row level security;

-- Idempotent policy creation.
do $$ begin
  create policy igpat_saved_own on public.igpat_saved_posts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_feedback_own on public.igpat_feedback for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_events_insert_own on public.igpat_events for insert with check (user_id is null or user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_events_read_own on public.igpat_events for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_bond_visible on public.igpat_bond_actions for select using (actor_user_id = auth.uid() or target_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_bond_insert_own on public.igpat_bond_actions for insert with check (actor_user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_arena_read_authenticated on public.igpat_arena_challenges for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_arena_insert_own on public.igpat_arena_challenges for insert with check (creator_user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_arena_update_participant on public.igpat_arena_challenges for update using (creator_user_id = auth.uid() or opponent_user_id = auth.uid()) with check (creator_user_id = creator_user_id);
exception when duplicate_object then null; end $$;

create or replace function public.igpat_set_saved_v1(p_post_id uuid, p_saved boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(p_saved,false) then
    insert into public.igpat_saved_posts(user_id,post_id) values(auth.uid(),p_post_id) on conflict do nothing;
  else
    delete from public.igpat_saved_posts where user_id=auth.uid() and post_id=p_post_id;
  end if;
end; $$;

create or replace function public.igpat_get_saved_v1()
returns table(post_id uuid, created_at timestamptz)
language sql security invoker set search_path = public as $$
  select s.post_id,s.created_at from public.igpat_saved_posts s where s.user_id=auth.uid() order by s.created_at desc;
$$;

create or replace function public.igpat_set_feedback_v1(p_feedback_kind text, p_post_id uuid default null, p_creator_id uuid default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_feedback_kind not in ('not_interested','show_fewer','dont_recommend_creator','hide') then raise exception 'Invalid feedback'; end if;
  if p_post_id is null and p_creator_id is null then raise exception 'Feedback target required'; end if;
  delete from public.igpat_feedback f where f.user_id=auth.uid() and f.feedback_kind=p_feedback_kind and f.post_id is not distinct from p_post_id and f.creator_id is not distinct from p_creator_id;
  insert into public.igpat_feedback(user_id,feedback_kind,post_id,creator_id) values(auth.uid(),p_feedback_kind,p_post_id,p_creator_id);
end; $$;

create or replace function public.igpat_track_event_v1(
  p_event_name text,
  p_post_id uuid default null,
  p_creator_id uuid default null,
  p_feed_source text default null,
  p_watch_ms integer default 0,
  p_meta jsonb default '{}'::jsonb
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.igpat_events(user_id,event_name,post_id,creator_id,feed_source,watch_ms,meta)
  values(auth.uid(),left(coalesce(p_event_name,'unknown'),80),p_post_id,p_creator_id,left(coalesce(p_feed_source,''),40),greatest(coalesce(p_watch_ms,0),0),coalesce(p_meta,'{}'::jsonb));
end; $$;

create or replace function public.igpat_create_bond_v1(
  p_kind text,
  p_post_id uuid,
  p_target_id uuid default null,
  p_message text default null,
  p_unlock_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_kind not in ('relay','pass','capsule','mosaic','memory_echo') then raise exception 'Invalid Bond type'; end if;
  insert into public.igpat_bond_actions(actor_user_id,kind,post_id,target_id,message,unlock_at)
  values(auth.uid(),p_kind,p_post_id,p_target_id,left(coalesce(p_message,''),1200),p_unlock_at) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.igpat_create_relay_v1(p_post_id uuid,p_target_id uuid default null,p_message text default null,p_unlock_at timestamptz default null)
returns uuid language sql security invoker set search_path=public as $$ select public.igpat_create_bond_v1('relay',p_post_id,p_target_id,p_message,p_unlock_at); $$;
create or replace function public.igpat_create_pass_v1(p_post_id uuid,p_target_id uuid default null,p_message text default null,p_unlock_at timestamptz default null)
returns uuid language sql security invoker set search_path=public as $$ select public.igpat_create_bond_v1('pass',p_post_id,p_target_id,p_message,p_unlock_at); $$;
create or replace function public.igpat_create_capsule_v1(p_post_id uuid,p_target_id uuid default null,p_message text default null,p_unlock_at timestamptz default null)
returns uuid language sql security invoker set search_path=public as $$ select public.igpat_create_bond_v1('capsule',p_post_id,p_target_id,p_message,p_unlock_at); $$;
create or replace function public.igpat_create_mosaic_v1(p_post_id uuid,p_target_id uuid default null,p_message text default null,p_unlock_at timestamptz default null)
returns uuid language sql security invoker set search_path=public as $$ select public.igpat_create_bond_v1('mosaic',p_post_id,p_target_id,p_message,p_unlock_at); $$;
create or replace function public.igpat_create_memory_echo_v1(p_post_id uuid,p_target_id uuid default null,p_message text default null,p_unlock_at timestamptz default null)
returns uuid language sql security invoker set search_path=public as $$ select public.igpat_create_bond_v1('memory_echo',p_post_id,p_target_id,p_message,p_unlock_at); $$;

create or replace function public.igpat_create_arena_challenge_v1(
  p_mode text,
  p_post_id uuid default null,
  p_opponent_user_id uuid default null,
  p_squad_id uuid default null,
  p_title text default null
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('duel','prove_it','squad_battle','king_of_the_hill','hard_mode','iron_streak','ranked_season','boss_challenge','last_man_standing','bounty_challenge') then raise exception 'Invalid Arena mode'; end if;
  insert into public.igpat_arena_challenges(creator_user_id,mode,post_id,opponent_user_id,squad_id,title)
  values(auth.uid(),p_mode,p_post_id,p_opponent_user_id,p_squad_id,left(coalesce(p_title,''),160)) returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.igpat_set_saved_v1(uuid,boolean) to authenticated;
grant execute on function public.igpat_get_saved_v1() to authenticated;
grant execute on function public.igpat_set_feedback_v1(text,uuid,uuid) to authenticated;
grant execute on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) to authenticated;
grant execute on function public.igpat_create_bond_v1(text,uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.igpat_create_arena_challenge_v1(text,uuid,uuid,uuid,text) to authenticated;
