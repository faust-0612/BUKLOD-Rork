import { supabase } from '@/lib/supabase';

export type BuklodR38AdminWithdrawalRow = {
  id: string;
  user_id: string;
  full_name: string;
  requested_amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  payout_destination_masked: string | null;
  requested_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  processing_at: string | null;
  paid_at: string | null;
  payout_transaction_ref: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
};

export type BuklodR38AdminWithdrawalQueue = {
  rows: BuklodR38AdminWithdrawalRow[];
  payout_processing_enabled: boolean;
  withdrawal_enabled: boolean;
  minimum_withdrawal_php: number;
  full_balance_only: boolean;
};

export type BuklodR38PayoutDetails = {
  withdrawal_id: string;
  user_id: string;
  requested_amount: number;
  currency: string;
  status: string;
  payout_method: string;
  account_name: string;
  destination: string;
  destination_masked: string;
};

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;
    for (const key of ['message', 'details', 'hint', 'code']) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return fallback;
}

async function rpc<T>(name: string, args?: Record<string, unknown>, fallback = 'R38 operation failed.') {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(messageFrom(error, fallback));
  return data as T;
}

export function makeBuklodR38IdempotencyKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function adminCreateBuklodR38EconomicPeriod(input: {
  periodKey: string;
  startIso: string;
  endIso: string;
  notes?: string;
}) {
  return rpc<Record<string, unknown>>(
    'admin_create_buklod_r38_economic_period_v1',
    {
      p_period_key: input.periodKey.trim(),
      p_period_start: input.startIso,
      p_period_end: input.endIso,
      p_notes: input.notes?.trim() || null,
    },
    'Could not create the economic period.',
  );
}

export async function adminAddBuklodR38FinancialEntry(input: {
  periodKey: string;
  entryKind: string;
  direction: 'revenue' | 'cost';
  amount: number;
  sourceSystem: string;
  externalReference?: string;
  reconciliationState: 'ESTIMATED' | 'RECONCILED' | 'EXCLUDED';
  idempotencyKey?: string;
}) {
  return rpc<{ idempotent_replay: boolean; entry: Record<string, unknown> }>(
    'admin_add_buklod_r38_financial_entry_v1',
    {
      p_period_key: input.periodKey.trim(),
      p_entry_kind: input.entryKind.trim().toUpperCase(),
      p_direction: input.direction,
      p_amount: input.amount,
      p_source_system: input.sourceSystem.trim() || 'manual_admin',
      p_external_reference: input.externalReference?.trim() || null,
      p_idempotency_key:
        input.idempotencyKey || makeBuklodR38IdempotencyKey('financial-entry'),
      p_reconciliation_state: input.reconciliationState,
      p_metadata: { entered_from: 'admin_r38_operations' },
    },
    'Could not add the financial entry.',
  );
}

export async function adminSetBuklodR38FinancialEntryState(
  entryId: string,
  reconciliationState: 'ESTIMATED' | 'RECONCILED' | 'EXCLUDED',
  reason?: string,
) {
  return rpc<Record<string, unknown>>(
    'admin_set_buklod_r38_financial_entry_state_v1',
    {
      p_entry_id: entryId,
      p_reconciliation_state: reconciliationState,
      p_reason: reason?.trim() || null,
    },
    'Could not update reconciliation state.',
  );
}

export async function adminSetBuklodR38PeriodStatus(
  periodKey: string,
  status: 'OPEN' | 'ESTIMATING' | 'RECONCILING' | 'READY_FOR_FINALIZATION',
  reason?: string,
) {
  return rpc<Record<string, unknown>>(
    'admin_set_buklod_r38_period_status_v1',
    {
      p_period_key: periodKey.trim(),
      p_status: status,
      p_reason: reason?.trim() || null,
    },
    'Could not update the economic period status.',
  );
}

export async function adminFinalizeBuklodR38EconomicPeriod(periodKey: string, reason?: string) {
  return rpc<Record<string, unknown>>(
    'admin_finalize_buklod_r38_economic_period_v1',
    {
      p_period_key: periodKey.trim(),
      p_reason: reason?.trim() || null,
    },
    'Could not finalize the economic period.',
  );
}

export async function adminReconcileBuklodR38Referrals(limit = 500) {
  return rpc<Record<string, unknown>>(
    'admin_reconcile_buklod_r38_referrals_v1',
    { p_limit: limit },
    'Could not reconcile referral qualification.',
  );
}

export async function adminListBuklodR38Withdrawals(status?: string | null) {
  return rpc<BuklodR38AdminWithdrawalQueue>(
    'admin_list_buklod_pf_withdrawals_v2',
    { p_status: status?.trim() || null, p_limit: 100 },
    'Could not load the canonical withdrawal queue.',
  );
}

export async function adminReviewBuklodR38Withdrawal(
  withdrawalId: string,
  approve: boolean,
  reason?: string,
) {
  return rpc<Record<string, unknown>>(
    'admin_review_buklod_pf_withdrawal_v2',
    {
      p_withdrawal_id: withdrawalId,
      p_approve: approve,
      p_reason: reason?.trim() || null,
    },
    'Could not review the withdrawal request.',
  );
}

export async function adminMarkBuklodPfWithdrawalProcessing(
  withdrawalId: string,
) {
  return rpc<Record<string, unknown>>(
    'admin_mark_buklod_pf_withdrawal_processing_v2',
    { p_withdrawal_id: withdrawalId },
    'Could not move the withdrawal to processing.',
  );
}

export async function adminFailBuklodPfWithdrawal(
  withdrawalId: string,
  reason: string,
) {
  return rpc<Record<string, unknown>>(
    'admin_fail_buklod_pf_withdrawal_v2',
    {
      p_withdrawal_id: withdrawalId,
      p_reason: reason.trim(),
    },
    'Could not mark the payout as failed.',
  );
}

export async function adminGetBuklodR38PayoutDetails(withdrawalId: string) {
  return rpc<BuklodR38PayoutDetails>(
    'admin_get_buklod_pf_withdrawal_payout_details_v2',
    { p_withdrawal_id: withdrawalId },
    'Could not access payout destination.',
  );
}

export async function adminMarkBuklodR38WithdrawalPaid(
  withdrawalId: string,
  transactionRef: string,
) {
  return rpc<Record<string, unknown>>(
    'admin_mark_buklod_pf_withdrawal_paid_v2',
    {
      p_withdrawal_id: withdrawalId,
      p_transaction_ref: transactionRef.trim(),
    },
    'Could not mark the withdrawal as paid.',
  );
}

// BUKLOD_CANONICAL_FINANCE_ADMIN_V3
export type BuklodPfFinancialEntryV3 = {
  id: string;
  entry_type: string;
  direction: 'CREDIT' | 'DEBIT' | string;
  amount_php: number;
  reconciliation_state: string;
  source_system: string | null;
  external_reference: string | null;
  idempotency_key: string;
  notes: string | null;
  created_at: string;
};

export type BuklodPfFinanceConsoleV3 = {
  period_key: string;
  controls: {
    economics_enabled: boolean;
    settlement_enabled: boolean;
    withdrawal_enabled: boolean;
    payout_processing_enabled: boolean;
    minimum_withdrawal_php: number;
  };
  policy: {
    version: string;
    user_pool_pct: number;
    first_line_pct: number;
    cluster_pct: number;
    organization_pct: number;
    organization_threshold: number;
  };
  settlement: null | {
    id: string;
    period_key: string;
    status: string;
    prequalification_revenue_php: number;
    qualification_reserve_opening_php: number;
    qualification_reserve_closing_php: number;
    one_time_referral_rewards_php: number;
    prequalification_retained_transfer_php: number;
    normal_eligible_revenue_php: number;
    user_pool_php: number;
    user_pool_distributed_php: number;
    user_pool_reserved_php: number;
    first_line_php: number;
    community_fund_php: number;
    buklod_retained_php: number;
    operating_cost_php: number;
    tax_reserve_php: number;
    estimated_final_net_php: number;
    qualified_monthly_points: number;
    finalized_at: string | null;
    policy_version: string;
  };
  financial_entries: BuklodPfFinancialEntryV3[];
  user_shares: Array<{
    person_id: string;
    qualified_monthly_points: number;
    share_php: number;
  }>;
  community_allocations: Array<{
    scope_id: string;
    tier: string;
    active_contributors: number;
    source_revenue_php: number;
    allocation_pct: number;
    allocation_php: number;
  }>;
};

function makeBuklodPfIdempotencyKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function adminGetBuklodPfFinanceConsoleV3(
  periodKey?: string | null,
) {
  return rpc<BuklodPfFinanceConsoleV3>(
    'admin_get_buklod_pf_finance_console_v3',
    {
      p_period_key: periodKey?.trim() || null,
    },
    'Could not load the canonical Finance V3 console.',
  );
}

export async function adminRecordBuklodPfFinancialEntryV3(input: {
  periodKey: string;
  entryType: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  reconciliationState: 'ESTIMATED' | 'RECONCILED' | 'REVERSED';
  sourceSystem: string;
  externalReference?: string;
  notes?: string;
  idempotencyKey?: string;
}) {
  return rpc<Record<string, unknown>>(
    'admin_record_buklod_pf_financial_entry_v3',
    {
      p_period_key: input.periodKey.trim(),
      p_entry_type: input.entryType.trim().toUpperCase(),
      p_direction: input.direction,
      p_amount_php: input.amount,
      p_reconciliation_state: input.reconciliationState,
      p_source_system: input.sourceSystem.trim() || 'manual_admin',
      p_external_reference:
        input.externalReference?.trim() || null,
      p_idempotency_key:
        input.idempotencyKey ||
        makeBuklodPfIdempotencyKey('pf-financial-entry'),
      p_notes: input.notes?.trim() || null,
    },
    'Could not record the canonical financial entry.',
  );
}

export async function adminFinalizeBuklodPfMonthV3(
  periodKey: string,
) {
  const key = periodKey.trim();

  return rpc<Record<string, unknown>>(
    'admin_finalize_buklod_pf_month_v3',
    {
      p_period_key: key,
      p_idempotency_key:
        `pf-finalize:${key}:canonical-v3`,
    },
    'Could not finalize the canonical Finance V3 month.',
  );
}


/** Server-owned release audit. No user identifiers or balances are disclosed. */
export type BuklodPfQmpReadiness = {
  period_key: string;
  period_exists: boolean;
  qmp_period_status?: string;
  month_complete?: boolean;
  qualified_users?: number;
  qualified_monthly_qmp?: number;
  unlinked_finance_identities?: number;
  ineligible_or_risk_held?: number;
  pending_qmp_reviews?: number;
  held_qmp_reviews?: number;
  legacy_share_records?: number;
  canonical_finalized_months?: number;
  reconciled_eligible_revenue_sources?: number;
  finance_enabled?: boolean;
  settlement_enabled?: boolean;
  ready_for_finalization: boolean;
};

export async function adminGetBuklodPfQmpReadinessV1(periodKey: string) {
  return rpc<BuklodPfQmpReadiness>(
    'admin_get_buklod_pf_qmp_readiness_v1',
    { p_period_key: periodKey.trim() },
    'Could not verify canonical monthly QMP and Finance reconciliation.',
  );
}


export type BuklodQmpAdminReview = {
  event_id: string;
  type: string;
  state: 'PENDING' | 'HELD';
  reason: string;
  qmp: number;
  created_at: string;
  source_excerpt: string;
  source_available: boolean;
};

export type BuklodQmpAdminReviewQueue = {
  period_key: string;
  total_pending: number;
  rows: BuklodQmpAdminReview[];
};

export async function adminGetBuklodQmpMonthReviewQueue(periodKey: string) {
  return rpc<BuklodQmpAdminReviewQueue>(
    'admin_list_buklod_qmp_month_review_queue_v1',
    { p_period_key: periodKey.trim(), p_limit: 50 },
    'Could not load the private qualified-contribution review queue.',
  );
}

export async function adminResolveBuklodQmpEvent(eventId: string, approve: boolean) {
  return rpc<{ event_id: string; approved: boolean }>(
    'admin_review_buklod_community_qmp_event_v1',
    { p_event_id: eventId, p_approve: approve,
      p_reason: approve ? 'Reviewed evidence for month-close qualification'
        : 'Reviewed evidence; does not meet qualified contribution criteria' },
    'Could not complete QMP evidence review.',
  );
}
