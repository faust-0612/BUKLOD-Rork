/**
 * Keep Connect personal, requests, and community rooms ordered by the most
 * recent message, regardless of the order returned by their separate RPCs.
 * A room with no messages stays after active conversations.
 */
type WithActivity = { last_message_at: string | null };
type WithMessageActivity = WithActivity & { last_message: string | null };

function activityTime(iso: string | null | undefined): number {
  const parsed = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortConnectInboxByActivity<T extends WithActivity>(
  rows: readonly T[],
): T[] {
  // Stable sort retains the backend's existing category/name order when
  // timestamps are equal or absent, without mutating cached RPC snapshots.
  return rows
    .map((value, index) => ({ value, index }))
    .sort(
      (a, b) =>
        activityTime(b.value.last_message_at) -
          activityTime(a.value.last_message_at) ||
        a.index - b.index,
    )
    .map(entry => entry.value);
}

export type ConnectInboxMessageEvent = {
  created_at?: unknown;
  body?: unknown;
  attachment_name?: unknown;
};

/**
 * Reorder a *known* conversation immediately on a validated Realtime INSERT.
 * Only the authenticated inbox RPC may supply unread counts or new thread IDs.
 * The normal post-event reload reconciles the preview with the database.
 */
export function applyConnectInboxRealtimeActivity<T extends WithMessageActivity>(
  rows: T[],
  matches: (row: T) => boolean,
  event: ConnectInboxMessageEvent,
): T[] {
  if (typeof event?.created_at !== 'string') return rows;
  const nextTime = activityTime(event.created_at);
  if (nextTime <= 0) return rows;

  const body = typeof event.body === 'string' ? event.body.trim() : '';
  const attachmentName =
    typeof event.attachment_name === 'string' ? event.attachment_name.trim() : '';
  const preview = body || (attachmentName ? `Attachment: ${attachmentName}` : 'Attachment');
  let changed = false;
  const next = rows.map(row => {
    if (!matches(row) || nextTime < activityTime(row.last_message_at)) return row;
    changed = true;
    return {
      ...row,
      last_message: preview,
      last_message_at: event.created_at as string,
    };
  });
  return changed ? next : rows;
}
