/**
 * Pure, dependency-free inbox policy shared by the admin dashboard and BSOC.
 * Keep authorisation in the existing guarded screens/RLS, never in this helper.
 */
export type PriorityLevel = 'urgent' | 'high' | 'normal';

export function rankPriorityLevel(level: PriorityLevel, createdAt: string, now: number = Date.now()): number {
  const recordedAt = Date.parse(createdAt);
  const age = Number.isFinite(recordedAt) ? Math.max(0, now - recordedAt) : 0;
  const base = level === 'urgent' ? 3 : level === 'high' ? 2 : 1;
  return Math.min(3, base + (age >= 72 * 60 * 60 * 1000 ? 1 : 0));
}

export function mergePendingCaseSamples<T extends { id: string }>(latest: T[], oldest: T[]): T[] {
  return Array.from(new Map([...latest, ...oldest].map(c => [c.id, c])).values());
}

export function isValidBdocCaseId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export function bsocCaseRoute(caseId: unknown): string {
  return isValidBdocCaseId(caseId)
    ? '/admin/bsoc-conversations?caseId=' + encodeURIComponent(caseId)
    : '/admin/bsoc-conversations';
}
