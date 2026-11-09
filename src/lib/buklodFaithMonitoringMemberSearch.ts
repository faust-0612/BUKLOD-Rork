/**
 * Debounced latest-only lookup for the Faith Monitoring member selector.
 * Cleanup invalidates both scheduled and in-flight requests (blur, scope switch,
 * audience switch or a newer search). It never changes input focus or form state.
 */
export function createFaithMonitoringMemberSearch<T>(
  search: (query: string) => Promise<T[]>,
  onResults: (members: T[]) => void,
  onError: (error: unknown) => void = () => undefined,
  delayMs = 250
) {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    update(query: string) {
      const requestGeneration = ++generation;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void Promise.resolve()
          .then(() => search(query))
          .then((members) => {
            if (generation === requestGeneration) onResults(members);
          })
          .catch((error: unknown) => {
            if (generation === requestGeneration) onError(error);
          });
      }, Math.max(0, delayMs));
    },
    dispose() {
      generation += 1;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
