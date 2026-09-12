-- R38 actual-revenue accounting foundation.
-- Additive only: existing R38 tables are preserved. Points remain completely separate.

alter table private.buklod_r38_economic_periods
  add column if not exists currency text not null default 'PHP';

alter table private.buklod_r38_financial_entries
  add column if not exists reconciliation_state text not null default 'ESTIMATED',
  add column if not exists currency text not null default 'PHP',
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid references auth.users(id) on delete set null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname='buklod_r38_financial_entries_reconciliation_state_check'
  ) then
    alter table private.buklod_r38_financial_entries
      add constraint buklod_r38_financial_entries_reconciliation_state_check
      check (reconciliation_state in ('ESTIMATED','RECONCILED','EXCLUDED'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='buklod_r38_economic_periods_currency_check'
  ) then
    alter table private.buklod_r38_economic_periods
      add constraint buklod_r38_economic_periods_currency_check check (currency='PHP');
  end if;
  if not exists (
    select 1 from pg_constraint where conname='buklod_r38_financial_entries_currency_check'
  ) then
    alter table private.buklod_r38_financial_entries
      add constraint buklod_r38_financial_entries_currency_check check (currency='PHP');
  end if;
end
$do$;

create table if not exists private.buklod_r38_user_period_shares (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references private.buklod_r38_economic_periods(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_key text not null check (pool_key in ('BAYANIHAN','DIRECT_REFERRAL')),
  qualified_units numeric not null default 0 check (qualified_units >= 0),
  total_qualified_units numeric not null default 0 check (total_qualified_units >= 0),
  share_ratio numeric not null default 0 check (share_ratio >= 0 and share_ratio <= 1),
  funded_pool_amount numeric not null default 0 check (funded_pool_amount >= 0),
  finalized_share_amount numeric not null default 0 check (finalized_share_amount >= 0),
  effective_php_per_unit numeric,
  finalization_id uuid not null,
  policy_version text not null default 'r38_unified_economy_v1',
  calculation_snapshot jsonb not null default '{}'::jsonb,
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(period_id,user_id,pool_key)
);

create index if not exists buklod_r38_user_period_shares_user_idx
  on private.buklod_r38_user_period_shares(user_id, finalized_at desc);
create index if not exists buklod_r38_user_period_shares_period_idx
  on private.buklod_r38_user_period_shares(period_id, pool_key);

create table if not exists private.buklod_r38_user_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid references private.buklod_r38_economic_periods(id) on delete restrict,
  source_pool text not null check (source_pool in ('BAYANIHAN','DIRECT_REFERRAL')),
  bucket text not null check (bucket in ('AVAILABLE','RESERVED','PAID')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric not null check (amount >= 0),
  entry_type text not null check (entry_type in ('PERIOD_FINALIZATION','WITHDRAWAL_RESERVE','WITHDRAWAL_RELEASE','PAYOUT_PAID','ADMIN_ADJUSTMENT','REVERSAL')),
  event_key text not null,
  withdrawal_request_id uuid references private.buklod_r38_referral_withdrawals(id) on delete restrict,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  policy_version text not null default 'r38_unified_economy_v1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,event_key)
);

create index if not exists buklod_r38_user_cash_user_idx
  on private.buklod_r38_user_cash_ledger(user_id, source_pool, created_at desc);
create index if not exists buklod_r38_user_cash_period_idx
  on private.buklod_r38_user_cash_ledger(period_id, source_pool);

alter table private.buklod_r38_referral_withdrawals
  add column if not exists source_pool text not null default 'DIRECT_REFERRAL';

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname='buklod_r38_referral_withdrawals_source_pool_check'
  ) then
    alter table private.buklod_r38_referral_withdrawals
      add constraint buklod_r38_referral_withdrawals_source_pool_check
      check (source_pool in ('DIRECT_REFERRAL'));
  end if;
end
$do$;

create or replace function private.buklod_r38_immutable_row_guard_v1()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'Finalized R38 accounting rows are immutable; use append-only adjustment/reversal records.';
end;
$function$;

revoke all on function private.buklod_r38_immutable_row_guard_v1() from public, anon, authenticated;

drop trigger if exists buklod_r38_user_period_shares_immutable on private.buklod_r38_user_period_shares;
create trigger buklod_r38_user_period_shares_immutable
before update or delete on private.buklod_r38_user_period_shares
for each row execute function private.buklod_r38_immutable_row_guard_v1();

drop trigger if exists buklod_r38_user_cash_ledger_immutable on private.buklod_r38_user_cash_ledger;
create trigger buklod_r38_user_cash_ledger_immutable
before update or delete on private.buklod_r38_user_cash_ledger
for each row execute function private.buklod_r38_immutable_row_guard_v1();

-- Private policy helpers are implementation details, not client RPCs.
revoke all on function private.buklod_r38_policy_config_v1() from public, anon, authenticated;
revoke all on function private.buklod_r38_flag_enabled_v1(text) from public, anon, authenticated;
revoke all on function private.buklod_r38_referral_window_months_v1() from public, anon, authenticated;

comment on table private.buklod_r38_user_period_shares is
'Immutable finalized proportional-share snapshots. BCU/RCU are weights only; PHP comes from finalized funded pools.';
comment on table private.buklod_r38_user_cash_ledger is
'Append-only funded cash ledger. No entry may be derived from BUKLOD Points, Character, Rank, or Collectibles.';