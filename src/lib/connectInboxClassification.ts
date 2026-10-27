/**
 * A first inbound message from a person the recipient has never replied to
 * stays under Requests. Classification comes from the authenticated DB RPC,
 * not from visual status or unread counts.
 */
export function partitionConnectInboxThreads<T extends { thread_id: string }>(
  threads: readonly T[],
  requestThreadIds: readonly string[]
): { personal: T[]; requests: T[] } {
  const requestIds = new Set(requestThreadIds);
  const personal: T[] = [];
  const requests: T[] = [];

  for (const thread of threads) {
    if (requestIds.has(thread.thread_id)) {
      requests.push(thread);
    } else {
      personal.push(thread);
    }
  }

  return { personal, requests };
}
