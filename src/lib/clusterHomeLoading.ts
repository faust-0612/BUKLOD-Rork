/** Read-only presentation cache. Never used to authorize mutations. */
export function clusterHomeResources(widget: string | null, admin: boolean): string[] {
  const resources: Record<string, string[]> = {
    today: ['events'], events: ['events', 'rsvps'],
    members: ['members', 'attendance'], officers: ['members'],
    tasks: ['tasks'], poll: ['polls'], community: ['posts'],
    attendance: ['attendance'], resources: ['resources'],
    recognition: ['recognitions'], about: ['description'],
    insights: ['members', 'tasks', 'events', 'attendance'],
  };
  return ['notices', 'settings', ...(resources[widget ?? ''] ?? [])]
    .filter(key => key !== 'members' || admin);
}

export function createClusterReadCache(ttlMs = 90_000, timeoutMs = 10_000) {
  const values = new Map<string, { data: unknown; at: number }>();
  const pending = new Map<string, Promise<unknown>>();
  return {
    peek(key: string) { return values.get(key)?.data; },
    async read<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
      // A forced refresh waits for an earlier read, then obtains post-mutation data.
      const previous = pending.get(key);
      if (previous) {
        if (!force) return previous as Promise<T>;
        await previous.catch(() => undefined);
      }
      const cached = values.get(key);
      if (!force && cached && Date.now() - cached.at < ttlMs) return cached.data as T;
      let timer: ReturnType<typeof setTimeout>;
      const request = Promise.race([
        Promise.resolve().then(fetcher),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Connection is slow. Please retry.')), timeoutMs);
        }),
      ]).then(data => {
        values.delete(key);
        values.set(key, { data, at: Date.now() });
        // Bound retained presentation data in long-running sessions.
        if (values.size > 160) values.delete(values.keys().next().value!);
        return data;
      }).finally(() => {
        clearTimeout(timer);
        if (pending.get(key) === request) pending.delete(key);
      });
      pending.set(key, request);
      return request;
    },
  };
}
