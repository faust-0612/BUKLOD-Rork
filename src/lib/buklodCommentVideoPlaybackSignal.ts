/** One active comment video at a time; pause instantly on comment-thread scroll. */
const listeners = new Set<() => void>();
export function subscribeBuklodCommentVideoStop(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function stopBuklodCommentVideos(): void {
  for (const listener of [...listeners]) listener();
}
