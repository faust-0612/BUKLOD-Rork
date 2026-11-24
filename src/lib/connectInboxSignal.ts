/**
 * Local, account-scoped invalidation signal for Connect inbox snapshots.
 *
 * Push notifications can arrive while the inbox route is not mounted, so
 * revision reads allow the next focus to revalidate even without a listener.
 * No message contents or personal data is retained here.
 */
const revisions = new Map<string, number>();
const listeners = new Set<(profileId: string) => void>();

export function connectInboxRevision(profileId: string): number {
  return revisions.get(profileId) ?? 0;
}

export function subscribeConnectInboxChanged(
  listener: (profileId: string) => void,
): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyConnectInboxChanged(profileId: string): void {
  const id = String(profileId ?? '').trim();
  if (!id) return;
  revisions.set(id, (revisions.get(id) ?? 0) + 1);
  for (const listener of listeners) listener(id);
}

const MESSAGE_KINDS = new Set([
  'direct_message',
  'connect_message',
  'scope_message',
  'community_message',
  'cluster_message',
]);

export function isConnectMessageNotification(kind: unknown): boolean {
  return typeof kind === 'string' &&
    MESSAGE_KINDS.has(kind.trim().toLowerCase());
}
