-- KABIHASNANG LIGAW R5: staging-only schema candidate; do not apply to production.
-- Published visibility is checked in the database, never from the handset clock.
create table if not exists public.kl_seasons (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null,
 status text not null default 'draft' check (status in ('draft','approved','paused')),
 created_at timestamptz not null default now()
);
create table if not exists public.kl_episodes (
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.kl_seasons(id),
 episode_number integer not null check (episode_number > 0),
 title text not null,
 content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
 release_at timestamptz not null,
 approved_at timestamptz,
 status text not null default 'draft' check (status in ('draft','approved','paused')),
 created_at timestamptz not null default now(),
 unique(season_id,episode_number)
);
create index if not exists kl_episode_release_idx on public.kl_episodes(release_at) where status='approved';
create table if not exists public.kl_story_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 episode_id uuid not null references public.kl_episodes(id),
 completed_at timestamptz not null default now(),
 primary key(user_id,episode_id)
);
create table if not exists public.kl_season_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid not null references public.kl_seasons(id),
 completed_at timestamptz not null default now(),
 primary key(user_id,season_id)
);
create table if not exists public.kl_reward_outbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_type text not null check (source_type in ('episode','season')),
 source_id uuid not null,
 points integer not null check ((source_type='episode' and points=2) or (source_type='season' and points=10)),
 status text not null default 'pending' check (status in ('pending','posted','failed')),
 created_at timestamptz not null default now(),
 unique(user_id,source_type,source_id)
);
alter table public.kl_seasons enable row level security;
alter table public.kl_episodes enable row level security;
alter table public.kl_story_progress enable row level security;
alter table public.kl_season_progress enable row level security;
alter table public.kl_reward_outbox enable row level security;
-- Read-only published content. No client write access to approvals, schedules, or rewards.
create policy kl_read_approved_seasons on public.kl_seasons for select to authenticated using (status='approved');
create policy kl_read_released_episodes on public.kl_episodes for select to authenticated
 using (status='approved' and approved_at is not null and release_at <= now()
 and exists(select 1 from public.kl_seasons s where s.id=season_id and s.status='approved'));
create policy kl_read_own_episode_progress on public.kl_story_progress for select to authenticated using (user_id=auth.uid());
create policy kl_read_own_season_progress on public.kl_season_progress for select to authenticated using (user_id=auth.uid());
-- Completion and ledger posting must be performed by a separately audited server-side function.
-- No client INSERT/UPDATE/DELETE policies on progress, outbox or point ledger.
