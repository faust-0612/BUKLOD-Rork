-- BUKLOD Empire Arena: proposed PRIVATE schema only.
-- UNAPPLIED DRAFT. Do not run against production or auto-include in migrations.
-- Requires separate signature verification, transactional settlement, canonical BP service
-- integration, economic budget approval and database security review.
create schema if not exists private;

create table if not exists private.empire_arena_match_v1 (
  match_id text primary key check (length(match_id) between 8 and 128),
  mode text not null check (mode in ('duel','cluster','grand')),
  map_id text not null,
  rule_version integer not null check (rule_version > 0),
  ranked boolean not null default false,
  state text not null check (state in ('queued','active','finished','void','held','settled')),
  winner_team text check (winner_team in ('A','B') or winner_team is null),
  result_reason text,
  canonical_receipt_sha256 text unique check
    (canonical_receipt_sha256 is null or canonical_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  region text not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.empire_arena_player_v1 (
  match_id text not null references private.empire_arena_match_v1(match_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (team in ('A','B')),
  scope_id uuid,
  character_id text not null check (character_id in (
    'phan','quin','van','christian','lhen','jawo','trudice',
    'ace','mitch','niel','angel','vhen','ellusur'
  )),
  effective_combat_level smallint not null check (effective_combat_level between 1 and 20),
  human_verified boolean not null default false,
  scope_verified boolean not null default false,
  active_ms integer not null default 0 check (active_ms >= 0),
  kill_count integer not null default 0 check (kill_count >= 0),
  death_count integer not null default 0 check (death_count >= 0),
  disconnect_ms integer not null default 0 check (disconnect_ms >= 0),
  primary key(match_id,user_id)
);
create index if not exists empire_arena_player_recent_v1
  on private.empire_arena_player_v1(user_id,match_id);

create table if not exists private.empire_arena_character_diamonds_wallet_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check (character_id in (
    'phan','quin','van','christian','lhen','jawo','trudice',
    'ace','mitch','niel','angel','vhen','ellusur'
  )),
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_lost integer not null default 0 check (lifetime_lost >= 0),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,character_id),
  constraint empire_arena_wallet_reconciliation_v1 check
    (balance = lifetime_earned - lifetime_lost)
);

create table if not exists private.empire_arena_character_diamonds_ledger_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  event_key text not null check (length(event_key) between 12 and 220),
  delta integer not null check (delta between -30 and 50 and delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  source_kind text not null check
    (source_kind in ('participation','ranked_win','ranked_loss','review_adjustment')),
  match_id text references private.empire_arena_match_v1(match_id),
  created_at timestamptz not null default now(),
  primary key(user_id,character_id,event_key),
  foreign key(user_id,character_id)
    references private.empire_arena_character_diamonds_wallet_v1(user_id,character_id)
);

create table if not exists private.empire_arena_rank_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating integer not null default 1000 check (rating between 100 and 3500),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists private.empire_arena_settlement_v1 (
  match_id text primary key references private.empire_arena_match_v1(match_id),
  canonical_receipt_sha256 text not null check
    (canonical_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check
    (status in ('held','planned','committed','bp_pending','reconciled','void')),
  reason text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.empire_arena_settlement_effect_v1 (
  match_id text not null references private.empire_arena_settlement_v1(match_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  rating_before integer not null,
  rating_after integer not null,
  diamond_before integer not null,
  diamond_after integer not null,
  bp_award integer not null default 0 check (bp_award between 0 and 12),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  primary key(match_id,user_id)
);

-- A canonical BP service processes this outbox; no player or Arena HTTP client
-- may directly insert BUKLOD Points into the canonical ledger.
create table if not exists private.empire_arena_bp_outbox_v1 (
  source_key text primary key,
  match_id text not null references private.empire_arena_match_v1(match_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  bp_amount integer not null check (bp_amount between 1 and 12),
  state text not null default 'pending' check
    (state in ('pending','processing','credited','rejected','held')),
  canonical_ledger_id bigint,
  attempts smallint not null default 0 check (attempts between 0 and 20),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id,user_id)
);
create index if not exists empire_arena_bp_outbox_pending_v1
  on private.empire_arena_bp_outbox_v1(state,created_at)
  where state in ('pending','processing');

-- No public API direct table access; even authenticated users have zero table DML.
-- Reader/writer RPC façades must be implemented and reviewed separately; do not
-- add SECURITY DEFINER functions to public for convenience.
alter table private.empire_arena_match_v1 enable row level security;
alter table private.empire_arena_player_v1 enable row level security;
alter table private.empire_arena_character_diamonds_wallet_v1 enable row level security;
alter table private.empire_arena_character_diamonds_ledger_v1 enable row level security;
alter table private.empire_arena_rank_v1 enable row level security;
alter table private.empire_arena_settlement_v1 enable row level security;
alter table private.empire_arena_settlement_effect_v1 enable row level security;
alter table private.empire_arena_bp_outbox_v1 enable row level security;
revoke all on private.empire_arena_match_v1 from public,anon,authenticated;
revoke all on private.empire_arena_player_v1 from public,anon,authenticated;
revoke all on private.empire_arena_character_diamonds_wallet_v1 from public,anon,authenticated;
revoke all on private.empire_arena_character_diamonds_ledger_v1 from public,anon,authenticated;
revoke all on private.empire_arena_rank_v1 from public,anon,authenticated;
revoke all on private.empire_arena_settlement_v1 from public,anon,authenticated;
revoke all on private.empire_arena_settlement_effect_v1 from public,anon,authenticated;
revoke all on private.empire_arena_bp_outbox_v1 from public,anon,authenticated;

-- Trust contract (NOT SQL executable implementation):
-- 1. Signed result gateway validates match ID, roster, cluster membership, tick log,
--    authoritative receipt hash, expiry, combat rules, no unresolved outage/abuse flags.
-- 2. Begin a single SERIALIZABLE transaction with bounded retry on serialization
--    failures; lock match + wallet + rating rows in deterministic user-id order.
-- 3. If settlement already exists with matching receipt hash, return stored result.
--    If a different receipt hash exists, hold for review; never overwrite.
-- 4. Enforce per-opponent, per-day BP/Diamond limits from ledger data, not client claims.
-- 5. Apply each verified Diamond delta and rating result once with event-key uniqueness.
-- 6. Insert pending BP outbox rows once; commit database transaction.
-- 7. Canonical points policy worker evaluates and grants BP using source_key idempotently.
--    Mark pending until authoritative ledger confirmation; no premature credited UI.
-- 8. On transient error retry boundedly; reconcile outbox without double rewards.
-- 9. On verified outage/void neither winner payouts nor loser penalties apply.
-- 10. NEVER use game-server client-supplied JWT claims as authorization; server role
--     delegation must be narrowly scoped, fully audited and revocable.
