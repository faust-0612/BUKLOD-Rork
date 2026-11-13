/**
 * Only route templates are reported. Never persist dynamic IDs, usernames or
 * query parameters in operational diagnostics.
 */
const SAFE_SEGMENTS = new Set([
  'account', 'admin', 'attendance', 'bayanihan', 'bible', 'buklod',
  'church', 'clusters', 'community', 'connect', 'daily-reading',
  'devotional', 'drawer', 'faith-monitoring', 'formation', 'help',
  'home', 'hub', 'index', 'learn', 'me', 'messages', 'organizations',
  'personal', 'post', 'profile', 'scope', 'settings', 'word', 'support',
  'report', 'manage', 'members', 'invitations', 'progress', 'create',
  'reflection', 'about-buklod', 'hymns', 'life', 'prayer', 'handle-share',
  // Static admin routes; dynamic IDs remain anonymized.
  'bsoc-support', 'bsoc-conversations', 'bsoc-gpt-debug',
  'bsoc-notifications', 'bsoc-personnel', 'priority-requests',
]);

let lastKnownRoute = 'unknown';

export function safeBuklodRoute(
  route: string | readonly string[] | null | undefined,
): string {
  const parts = Array.isArray(route)
    ? route
    : String(route ?? '').split(/[?#]/, 1)[0].split('/');

  const segments = parts
    .filter(Boolean)
    .filter(part => !/^\(.*\)$/.test(part))
    .map(part => SAFE_SEGMENTS.has(part.toLowerCase()) ? part.toLowerCase() : ':id');

  return segments.join('/').slice(0, 160) || 'unknown';
}

export function rememberBuklodRoute(route: string | null | undefined): void {
  const safe = safeBuklodRoute(route);
  if (safe !== 'unknown') lastKnownRoute = safe;
}

export function resolveBuklodCrashRoute(
  pathname: string | null | undefined,
  segments: readonly string[],
): string {
  const fromSegments = safeBuklodRoute(segments);
  if (fromSegments !== 'unknown') return fromSegments;
  const fromPath = safeBuklodRoute(pathname);
  return fromPath !== 'unknown' ? fromPath : lastKnownRoute;
}
