// Ephemeral notification only: no retained media URLs, account data or polling.
type Listener = (url: string) => void;
export function createWallOriginalReadyChannel() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    subscribe(path: string, listener: Listener) {
      const group = listeners.get(path) ?? new Set<Listener>();
      group.add(listener);
      listeners.set(path, group);
      return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(path);
      };
    },
    publish(path: string, url: string) {
      if (!path || !url) return;
      for (const listener of [...(listeners.get(path) ?? [])]) listener(url);
    },
  };
}
export const wallOriginalReady = createWallOriginalReadyChannel();
