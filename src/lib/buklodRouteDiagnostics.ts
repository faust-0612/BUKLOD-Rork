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


/**
 * Privacy-safe render forensics. Classifies the exception ON DEVICE and emits
 * fixed taxonomy codes only: no error message, stack, route parameters, user
 * input or source paths are sent to BSOC. A classification is not a diagnosis.
 *
 * Release Hermes stacks may not contain original source filenames. In that
 * case originArea stays UNKNOWN (never fabricate a file or component).
 */
export type BuklodRenderEvidence = {
  causeCode: string;
  originArea: string;
  causeLabel: string;
  correlationKey: string;
};

export function diagnoseBuklodRenderError(
  error: Pick<Error, 'name' | 'message' | 'stack'> | null | undefined,
): BuklodRenderEvidence {
  const name = typeof error?.name === 'string' ? error.name : '';
  const message = typeof error?.message === 'string'
    ? error.message.slice(0, 1500)
    : '';
  let causeCode = 'UNKNOWN';
  let causeLabel = 'Cause not identifiable from safe client metadata';
  if (/rendered (?:more|fewer) hooks|invalid hook call/i.test(message)) {
    causeCode = 'HOOK_ORDER';
    causeLabel = 'React hook invocation or ordering problem';
  } else if (/maximum update depth|too many re-renders/i.test(message)) {
    causeCode = 'RENDER_LOOP';
    causeLabel = 'Repeated render/update cycle';
  } else if (/element type is invalid|type is invalid.*expected/i.test(message)) {
    causeCode = 'INVALID_ELEMENT';
    causeLabel = 'Component import or invalid React element';
  } else if (/objects are not valid as a react child|text strings must be rendered/i.test(message)) {
    causeCode = 'INVALID_CHILD';
    causeLabel = 'Unsupported value rendered as UI content';
  } else if (/cannot read propert|cannot set propert|undefined is not an object|null is not an object/i.test(message)) {
    causeCode = 'NULLISH_ACCESS';
    causeLabel = 'Attempted to use missing data';
  } else if (/is not a function/i.test(message)) {
    causeCode = 'INVALID_CALL';
    causeLabel = 'Attempted to call a non-function value';
  } else if (/must be used (?:within|inside) .*provider/i.test(message)) {
    causeCode = 'MISSING_PROVIDER';
    causeLabel = 'Component rendered without required context';
  } else if (name === 'TypeError') {
    causeCode = 'TYPE_ERROR';
    causeLabel = 'JavaScript type mismatch';
  } else if (name === 'ReferenceError') {
    causeCode = 'REFERENCE_ERROR';
    causeLabel = 'JavaScript reference failure';
  }
  // Only accept a static first-party source-path pattern from the JS stack.
  // Discard the entire path after matching; it may contain sensitive values.
  const stack = typeof error?.stack === 'string' ? error.stack.slice(0, 6000) : '';
  const frame = stack.match(/(?:^|[/\\])src[/\\](app|components|providers|lib)[/\\]([A-Za-z0-9_./\\-]{1,140})/i);
  const root = (frame?.[1] || '').toLowerCase();
  const path = (frame?.[2] || '').toLowerCase().replace(/\\/g, '/');
  let originArea = 'UNKNOWN';
  if (root === 'providers') originArea = 'PROVIDER';
  else if (/^(?:scope|clusters|organizations|community)(?:\/|$)/.test(path)) originArea = 'SCOPE';
  else if (/^(?:connect|messages)(?:\/|$)/.test(path) || /connect/.test(path)) originArea = 'CONNECT';
  else if (/^(?:character|kingdom)(?:\/|$)/.test(path) || /character/.test(path)) originArea = 'CHARACTER';
  else if (/^(?:wall|post|reels|marites|media|video)(?:\/|$)/.test(path)) originArea = 'MEDIA';
  else if (/^(?:auth|session)(?:\/|$)/.test(path)) originArea = 'AUTH';
  else if (root === 'app') originArea = 'ROUTE';
  else if (root === 'components') originArea = 'COMPONENT';
  else if (root === 'lib') originArea = 'LIB';
  return {
    causeCode,
    originArea,
    causeLabel,
    correlationKey: 'BUKLOD_SCREEN_RENDER_EXCEPTION.' + causeCode + '.' + originArea,
  };
}
