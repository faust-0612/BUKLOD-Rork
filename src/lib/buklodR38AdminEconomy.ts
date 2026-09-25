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
  paid_at: string | null;
  payout_transaction_ref: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
};

export type BuklodR38AdminWithdrawalQueue = {
  rows: BuklodR38AdminWithdrawalRow[];
  payout_processing_enabled: boolean;
  referral_withdrawal_enabled: boolean;
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
  const entryType = input.entryKind.trim().toUpperCase();
  const canonicalState =
    input.reconciliationState === 'EXCLUDED'
      ? 'REVERSED'
      : input.reconciliationState;

  return rpc<Record<string, unknown>>(
    'admin_record_buklod_pf_financial_entry_v3',
    {
      p_period_key: input.periodKey.trim(),
      p_entry_type: entryType,
      p_direction: input.direction === 'revenue' ? 'CREDIT' : 'DEBIT',
      p_amount_php: input.amount,
      p_reconciliation_state: canonicalState,
      p_source_system: input.sourceSystem.trim() || 'manual_admin',
      p_external_reference: input.externalReference?.trim() || null,
      p_idempotency_key:
        input.idempotencyKey || makeBuklodR38IdempotencyKey('pf-financial-entry'),
      p_notes: 'Canonical Finance V3 admin operation',
    },
    'Could not add the canonical financial entry.',
  );
}

export async function adminFinalizeBuklodR38EconomicPeriod(periodKey: string, _reason?: string) {
  return rpc<Record<string, unknown>>(
    'admin_finalize_buklod_pf_month_v3',
    {
      p_period_key: periodKey.trim(),
      p_idempotency_key: makeBuklodR38IdempotencyKey(`pf-finalize:${periodKey.trim()}`),
    },
    'Could not finalize the canonical financial month.',
  );
}

export async function adminListBuklodR38Withdrawals(status?: string | null) {
  return rpc<BuklodR38AdminWithdrawalQueue>(
    'admin_list_buklod_r38_referral_withdrawals_v1',
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
    'Could not review the canonical withdrawal request.',
  );
}

export async function adminGetBuklodR38PayoutDetails(withdrawalId: string) {
  return rpc<BuklodR38PayoutDetails>(
    'admin_get_buklod_pf_withdrawal_payout_details_v2',
    { p_withdrawal_id: withdrawalId },
    'Could not access canonical payout destination.',
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
    'Could not mark the canonical withdrawal as paid.',
  );
}
