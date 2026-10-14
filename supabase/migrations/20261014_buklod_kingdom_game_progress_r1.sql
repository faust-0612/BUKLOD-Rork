-- BUKLOD Kingdom account-specific game records R1.
-- Declarative migration only. Do not apply to production during feature development.
-- This is NOT a BUKLOD Points, Circle Rank or character XP system.
create table if not exists public.buklod_kingdom_game_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (char_length(game_id) between 3 and 100),
  clears integer not null default 0 check (clears >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  best_stars smallint not null default 0 check (best_stars between 0 and 3),
  last_status text not null default 'lost' check (last_status in ('won', 'lost')),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
alter table public.buklod_kingdom_game_progress enable row level security;
revoke all on table public.buklod_kingdom_game_progress from anon, public;
grant select, insert, update, delete on table public.buklod_kingdom_game_progress to authenticated;

drop policy if exists kingdom_game_progress_read_self on public.buklod_kingdom_game_progress;
create policy kingdom_game_progress_read_self
on public.buklod_kingdom_game_progress for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists kingdom_game_progress_insert_self on public.buklod_kingdom_game_progress;
create policy kingdom_game_progress_insert_self
on public.buklod_kingdom_game_progress for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists kingdom_game_progress_update_self on public.buklod_kingdom_game_progress;
create policy kingdom_game_progress_update_self
on public.buklod_kingdom_game_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists kingdom_game_progress_delete_self on public.buklod_kingdom_game_progress;
create policy kingdom_game_progress_delete_self
on public.buklod_kingdom_game_progress for delete to authenticated
using (user_id = (select auth.uid()));
