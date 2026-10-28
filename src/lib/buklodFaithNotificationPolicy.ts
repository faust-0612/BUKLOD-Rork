/** Faith alerts follow the personal Show Faith preference, never org/admin overrides. */
export const FAITH_NOTIFICATION_PATTERNS = [
  'formation_%', 'devotional_%', 'prayer_%', 'bible_%',
  'faith_%', 'daily_bible_%',
] as const;

const prefixes = FAITH_NOTIFICATION_PATTERNS.map(pattern => pattern.slice(0, -1));

export function isFaithNotificationKind(kind: unknown): boolean {
  const normalized = String(kind ?? '').trim().toLowerCase();
  return prefixes.some(prefix => normalized.startsWith(prefix));
}
