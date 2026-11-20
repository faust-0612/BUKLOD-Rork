-- BUKLOD SEASON 2: Show Faith / Non-Show Faith per-scope reward isolation.
-- DRAFT SOURCE ONLY. DO NOT APPLY TO PRODUCTION OR EXISTING LIVE DATABASE.
-- Deliberately stored under docs/season2/sql, not supabase/migrations.
-- Requires isolated staging project, original S2 core candidate installed there,
-- audited event-time policy resolver, RLS/security tests, and owner-approved RC.
--
-- Account-deletion compatibility: all user-owned nonfinancial S2 rows cascade
-- on authorized auth.users deletion; no reward-ledger FK may hold the account.
-- Existing financial/legal retention decisions are handled separately.
-- The existing S1 BP/Circle Rank, QMP/monthly money, cash, Character V3,
-- Kingdom Shards, wallet, historical rewards and existing core trigger remain
-- the SAME canonical systems. No retroactive edits, automatic resets, or
-- doubled BP/QMP across paths. A public-scope member's individual Show Faith
-- preference, CHURCH enforcement, ORGANIZATION mandatory faith content and
-- CLUSTER admin overlay must be evaluated by a SERVER policy at source time.
-- Never trust an editable client path, JWT user_metadata, cached scope,
-- or a later/current user preference as an as-of-event authority.
--
-- A globally scoped content source with source_scope = NULL must be
-- attested as SHARED (not guessed Show Faith or Non) and consumed only once.
-- The base core source_receipt unique(user_id,source_kind,source_id)
-- is retained unchanged across track switches and rules upgrades.
--
-- This draft adds accounting/attribution TABLES ONLY. There are no minting,
-- spending, claim or preference-changing functions, triggers, jobs, or RPCs.
-- The claim gate defaults disabled, cannot be changed by service_role.
begin;

-- Expect the original dormant Season2 candidate, never create an exposed
-- public schema or extend the existing production schema in this draft.
do $$
begin
 if to_regclass('buklod_s2.source_receipt') is null then
   raise exception 'INSTALL_S2_CORE_ON_ISOLATED_STAGING_FIRST'
     using errcode='55000';
 end if;
end $$;

create table if not exists buklod_s2.reward_track_gate (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false check(not enabled),
 owner_approved_sha text,
 event_policy_verified boolean not null default false check(not event_policy_verified),
 created_at timestamptz not null default now()
);
insert into buklod_s2.reward_track_gate(singleton,enabled,event_policy_verified)
values(true,false,false) on conflict(singleton) do nothing;

-- Immutable proof for one original canonical event. Event-time mode is
-- captured by a future authorized server adapter, NEVER by the device.
-- SHARED is allowed only when the source itself has no owned scope,
-- with consumption accounted in a single global user claim ledger.
create table if not exists buklod_s2.reward_track_attribution (
 receipt_id bigint primary key references buklod_s2.source_receipt(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid references public.buklod_scopes(id) on delete restrict,
 track text not null check(track in ('show_faith','non_show_faith','shared')),
 event_at timestamptz not null,
 event_mode_policy_version text not null check(length(event_mode_policy_version) between 8 and 100),
 immutable_attestation_key text not null unique check(length(immutable_attestation_key) between 12 and 180),
 server_event_mode_verified boolean not null default false check(not server_event_mode_verified),
 created_at timestamptz not null default now(),
 check((track='shared' and scope_id is null) or
       (track in ('show_faith','non_show_faith') and scope_id is not null))
);
create index if not exists s2_track_user_scope_idx
 on buklod_s2.reward_track_attribution(user_id,scope_id,track,event_at desc);

-- Track progress is separate for each verified user+scope+mode+week.
-- No BP, QMP, money or token payout occurs from merely inserting progress.
create table if not exists buklod_s2.reward_track_weekly_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
 track text not null check(track in ('show_faith','non_show_faith')),
 week_start_manila date not null,
 learning_receipt_id bigint references buklod_s2.reward_track_attribution(receipt_id) on delete set null,
 community_receipt_id bigint references buklod_s2.reward_track_attribution(receipt_id) on delete set null,
 computed_only boolean not null default true check(computed_only),
 created_at timestamptz not null default now(),
 primary key(user_id,scope_id,track,week_start_manila),
 check(learning_receipt_id is null or community_receipt_id is null or learning_receipt_id<>community_receipt_id)
);

-- A canonical event receipt can be consumed for ONE distinct optional weekly
-- mission, regardless of track or scope; prevents replay after mode switching.
create table if not exists buklod_s2.reward_track_evidence_use (
 receipt_id bigint primary key references buklod_s2.reward_track_attribution(receipt_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
 track text not null check(track in ('show_faith','non_show_faith')),
 week_start_manila date not null,
 claim_role text not null check(claim_role in ('learning','community')),
 created_at timestamptz not null default now(),
 foreign key(user_id,scope_id,track,week_start_manila)
 references buklod_s2.reward_track_weekly_progress(user_id,scope_id,track,week_start_manila)
 on delete cascade
);

-- A member may make independent progress in different groups, but may
-- receive at most ONE weekly optional payout of any kind across the two
-- tracks. Badge previews are not granted by these tables.
create table if not exists buklod_s2.reward_track_weekly_bonus_hold (
 user_id uuid not null references auth.users(id) on delete cascade,
 week_start_manila date not null,
 credited_track text not null check(credited_track in ('show_faith','non_show_faith')),
 credited_scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
 authorized_amount integer not null default 0 check(authorized_amount=0),
 approved_server_settlement boolean not null default false check(not approved_server_settlement),
 created_at timestamptz not null default now(),
 primary key(user_id,week_start_manila)
);

-- Separate per-track cosmetic/recognition history. No actual badge grant
-- is allowed until canonical Character authority and owner-approved rules
-- are linked via an independent verified backend adapter.
create table if not exists buklod_s2.reward_track_badge_candidates (
 user_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid not null references public.buklod_scopes(id) on delete restrict,
 track text not null check(track in ('show_faith','non_show_faith')),
 badge_key text not null check(length(badge_key) between 5 and 100),
 week_start_manila date not null,
 actual_grant_enabled boolean not null default false check(not actual_grant_enabled),
 created_at timestamptz not null default now(),
 primary key(user_id,scope_id,track,badge_key,week_start_manila)
);

-- Internal-only, deny by default with RLS. The service account can create
-- PREVIEW/UNVERIFIED rows only. There is no API endpoint or user-managed
-- track change function in this candidate.
alter table buklod_s2.reward_track_gate enable row level security;
alter table buklod_s2.reward_track_attribution enable row level security;
alter table buklod_s2.reward_track_weekly_progress enable row level security;
alter table buklod_s2.reward_track_evidence_use enable row level security;
alter table buklod_s2.reward_track_weekly_bonus_hold enable row level security;
alter table buklod_s2.reward_track_badge_candidates enable row level security;
revoke all on buklod_s2.reward_track_gate,
 buklod_s2.reward_track_attribution,
 buklod_s2.reward_track_weekly_progress,
 buklod_s2.reward_track_evidence_use,
 buklod_s2.reward_track_weekly_bonus_hold,
 buklod_s2.reward_track_badge_candidates
 from public,anon,authenticated;
grant select,insert on buklod_s2.reward_track_attribution,
 buklod_s2.reward_track_weekly_progress,
 buklod_s2.reward_track_evidence_use,
 buklod_s2.reward_track_weekly_bonus_hold,
 buklod_s2.reward_track_badge_candidates to service_role;
grant select on buklod_s2.reward_track_gate to service_role;
revoke update,delete,truncate on buklod_s2.reward_track_gate,
 buklod_s2.reward_track_attribution,
 buklod_s2.reward_track_weekly_progress,
 buklod_s2.reward_track_evidence_use,
 buklod_s2.reward_track_weekly_bonus_hold,
 buklod_s2.reward_track_badge_candidates from service_role;
-- Explicitly no user access to schema tables or server-only proof.
commit;
