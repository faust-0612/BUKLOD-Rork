/**
 * A pure boundary for account-scoped QMP history.
 * Qualified QMP is not pesos and never triggers, funds or resets payouts.
 * Do not synthesize zero when backend data is missing or malformed.
 */
export type CommunityQmpPeriod = {
  period_key: string;
  qualified_qmp: number;
  held_qmp: number;
  status: string;
};

export type CommunityQmpHistory = {
  lifetime_qmp: number;
  periods: CommunityQmpPeriod[];
};

const periodKey = /^\d{4}-(0[1-9]|1[0-2])$/;
function safeNonnegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export function parseCommunityQmpHistory(value: unknown): CommunityQmpHistory | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const lifetime = safeNonnegativeInteger(source.lifetime_qmp);
  if (lifetime === null || !Array.isArray(source.periods)) return null;

  const periods: CommunityQmpPeriod[] = [];
  const seen = new Set<string>();
  let sum = 0;
  for (const item of source.periods) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const key = row.period_key;
    const qualified = safeNonnegativeInteger(row.qualified_qmp);
    const held = safeNonnegativeInteger(row.held_qmp);
    if (typeof key !== 'string' || !periodKey.test(key) || seen.has(key)
      || qualified === null || held === null
      || typeof row.status !== 'string' || row.status.length > 32) return null;
    seen.add(key);
    sum += qualified;
    if (!Number.isSafeInteger(sum)) return null;
    periods.push({ period_key: key, qualified_qmp: qualified, held_qmp: held, status: row.status });
  }
  if (sum !== lifetime) return null;
  return { lifetime_qmp: lifetime, periods };
}
