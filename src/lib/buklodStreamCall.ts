/**
 * Stream call ID helpers and user-facing call error text.
 *
 * PATCH_CALL_LIFECYCLE_R1
 * Ringing calls MUST use a fresh call ID for every attempt. Stream allows a
 * room ID to be reused for joining, but ringing/push behavior is one-shot per
 * call ID. Reusing the old stable thread/scope IDs caused silent repeated
 * calls, unreliable push, and stale ringing state.
 */

export function sanitizeBuklodCallSegment(
  value: string,
  maxLength = 40
) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, maxLength);
}

function buklodCallNonce() {
  const cryptoApi =
    (globalThis as any)?.crypto;

  const randomUuid =
    typeof cryptoApi?.randomUUID === 'function'
      ? String(cryptoApi.randomUUID())
      : '';

  const fallback =
    `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 9)}`;

  return sanitizeBuklodCallSegment(
    randomUuid || fallback,
    14
  );
}

/** Fresh 1:1 ringing call for a Connect thread. */
export function buildBuklodPersonalCallId(
  threadId: string
) {
  const safe =
    sanitizeBuklodCallSegment(
      threadId,
      18
    );

  return `buklod-personal-${safe || 'thread'}-${buklodCallNonce()}`;
}

/** Fresh scoped/group ringing call for the exact scope. */
export function buildBuklodScopeCallId(
  scopeId: string
) {
  const safe =
    sanitizeBuklodCallSegment(
      scopeId,
      18
    );

  return `buklod-scope-${safe || 'scope'}-${buklodCallNonce()}`;
}

export function formatBuklodCallStartError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? '');

  const lower =
    message.toLowerCase();

  if (
    lower.includes(
      'not configured in this app build'
    ) ||
    lower.includes(
      'stream credentials are unavailable'
    ) ||
    lower.includes(
      'stream api key'
    )
  ) {
    return 'Unable to initialize calling. Check your connection and try again.';
  }

  if (
    lower.includes('user token is not set') ||
    lower.includes('client.connectuser') ||
    lower.includes('client.disconnect')
  ) {
    return 'Hindi pa handa ang calling connection. Subukan muli makalipas ang ilang sandali.';
  }

  if (
    lower.includes('unable to obtain a call token') ||
    lower.includes('obtain a call token') ||
    lower.includes('call token') ||
    lower.includes('token service') ||
    lower.includes('sign in again and retry')
  ) {
    return 'Could not start the call. Try again in a moment.';
  }

  if (
    lower.includes('permission') ||
    lower.includes('microphone') ||
    lower.includes('camera')
  ) {
    return message;
  }

  if (
    lower.includes('network') ||
    lower.includes('fetch')
  ) {
    return 'Network unavailable. Check your connection and try again.';
  }

  if (
    lower.includes('browser calling is not enabled')
  ) {
    return 'Calling is not available in the browser build.';
  }

  return (
    message ||
    'Could not start the call.'
  );
}
