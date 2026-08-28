# Character Backend Proposal (NOT APPLIED)

Minimal Supabase persistence for BUKLOD Living Character when local-only
AsyncStorage is insufficient for cross-device sync.

## Table: `buklod_character_state`

```sql
create table if not exists public.buklod_character_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  body text not null check (body in ('female', 'male')),
  equipment jsonb not null default '{}'::jsonb,
  newly_unlocked text[] not null default '{}',
  voice_enabled boolean not null default true,
  reactions_mode text not null default 'full'
    check (reactions_mode in ('full', 'reduced', 'off')),
  updated_at timestamptz not null default now()
);

alter table public.buklod_character_state enable row level security;

create policy "Users read own character"
  on public.buklod_character_state for select
  using (auth.uid() = user_id);

create policy "Users upsert own character"
  on public.buklod_character_state for insert
  with check (auth.uid() = user_id);

create policy "Users update own character"
  on public.buklod_character_state for update
  using (auth.uid() = user_id);
```

## RPC: `get_my_buklod_character`

Returns the row for `auth.uid()` or defaults from catalog starter equipment.

## RPC: `save_my_buklod_character`

Validates equipment ids against catalog + lifetime points from
`get_my_buklod_points_dashboard`, then upserts.

## Client migration

1. On login: fetch RPC; if row exists, overwrite local AsyncStorage.
2. On save (customize sheet): write local first, then RPC upsert (optimistic).
3. Settings (`voice_enabled`, `reactions_mode`) sync on the same row.

## Out of scope (future)

- Server-side event log for character reactions
- Cross-device greeting session deduplication (currently local day key)

No migrations were run for this proposal.
