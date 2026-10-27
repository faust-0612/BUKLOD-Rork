/**
 * Community QMP is the source of truth for participation weight.
 * Profit-First financial eligibility and peso balances are separate.
 * Missing or malformed Community data must never appear as a genuine zero.
 */
export type CommunityQmpInput = {
  period?: { key?: string | null } | null;
  this_month_qmp?: number | null;
  total_qualified_qmp?: number | null;
  share_weight?: number | null;
};

export type CommunityQmpMetrics = {
  periodKey: string;
  monthlyQmp: number;
  totalQmp: number;
  participationPct: number;
};

export function communityQmpMetrics(
  source: CommunityQmpInput | null | undefined,
): CommunityQmpMetrics | null {
  if (!source || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(source.period?.key ?? ''))) {
    return null;
  }

  if (source.this_month_qmp == null || source.total_qualified_qmp == null) {
    return null;
  }
  const monthlyQmp = Number(source.this_month_qmp);
  const totalQmp = Number(source.total_qualified_qmp);
  if (!Number.isSafeInteger(monthlyQmp) || !Number.isSafeInteger(totalQmp)
    || monthlyQmp < 0 || totalQmp < 0 || monthlyQmp > totalQmp) {
    return null;
  }

  const fraction = source.share_weight == null
    ? (totalQmp > 0 ? monthlyQmp / totalQmp : 0)
    : Number(source.share_weight);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    return null;
  }

  return {
    periodKey: String(source.period!.key),
    monthlyQmp,
    totalQmp,
    participationPct: fraction * 100,
  };
}
