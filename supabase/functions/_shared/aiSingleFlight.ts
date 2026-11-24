/** Coalesce simultaneous identical AI requests only. No persistent storage, no cross-user results. */
const pending = new Map<string, Promise<unknown>>();
export async function singleFlightAi<T>(scope: string, key: string, operation: () => Promise<T>): Promise<T> {
  const scopedKey = JSON.stringify([scope, key]);
  const existing = pending.get(scopedKey);
  if (existing) return existing as Promise<T>;
  const promise = operation();
  pending.set(scopedKey, promise);
  try { return await promise; }
  finally { if (pending.get(scopedKey) === promise) pending.delete(scopedKey); }
}
