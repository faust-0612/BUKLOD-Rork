/** A lightweight, in-memory hint after the server confirms a read cursor.
 * Never clears counts optimistically or crosses signed-in accounts. */
type Listener = (profileId: string) => void;
const listeners = new Set<Listener>();

export function subscribeConnectRead(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyConnectRead(profileId: string): void {
  if (!profileId) return;
  for (const listener of listeners) listener(profileId);
}
