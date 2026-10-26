/** Account-isolated, bounded session cache. Never used to authorize a workspace. */
export function createClusterDirectoryCache<T>(now = Date.now) {
  let owner = '';
  let generation = 0;
  const entries = new Map<string, { value: T; at: number }>();
  const pending = new Map<string, Promise<T>>();
  const freshMs = 30_000;
  const staleMs = 5 * 60_000;
  const isOwner = (id: string) => Boolean(id) && id === owner;
  const peek = (id: string, key: string): T | undefined => {
    if (!isOwner(id)) return undefined;
    const entry = entries.get(key);
    if (!entry || now() - entry.at > staleMs) return undefined;
    return entry.value;
  };
  return {
    isOwner,
    peek,
    invalidate() {
      generation += 1;
      entries.clear();
      pending.clear();
    },
    selectOwner(id: string) {
      if (owner === id) return;
      owner = id;
      generation += 1;
      entries.clear();
      pending.clear();
    },
    read(id: string, key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
      if (!isOwner(id)) return Promise.reject(new Error('Sign in to view Clusters.'));
      const entry = entries.get(key);
      if (!force && entry && now() - entry.at < freshMs) return Promise.resolve(entry.value);
      const running = pending.get(key);
      if (running) return running;
      const requestGeneration = generation;
      const task = Promise.resolve().then(fetcher).then(value => {
        if (requestGeneration === generation && isOwner(id)) {
          entries.delete(key);
          entries.set(key, { value, at: now() });
          // Preserve the membership list while bounding cached search results.
          while (entries.size > 12) {
            const oldest = [...entries.keys()].find(candidate => candidate !== 'mine');
            if (!oldest) break;
            entries.delete(oldest);
          }
        }
        return value;
      }).finally(() => {
        if (pending.get(key) === task) pending.delete(key);
      });
      pending.set(key, task);
      return task;
    },
  };
}
