/**
 * Stream call ID helpers and user-facing call error text.
 */

export function sanitizeBuklodCallSegment(
  value: string,
  maxLength = 40
) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, maxLength);
}

/** Stable 1:1 personal call room for a Connect thread. */
export function buildBuklodPersonalCallId(
  threadId: string
) {
  const safe =
    sanitizeBuklodCallSegment(
      threadId,
      40
    );

  return `buklod-personal-${safe || 'thread'}`;
}

/** Scoped group call room keyed to the exact scope id. */
export function buildBuklodScopeCallId(
  scopeId: string
) {
  const safe =
    sanitizeBuklodCallSegment(
      scopeId,
      18
    );

  return `buklod-scope-${safe || 'scope'}`;
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
