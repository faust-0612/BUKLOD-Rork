import { Platform } from 'react-native';

export const BUKLOD_LIST_PERFORMANCE_PROPS = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: Platform.OS === 'android',
} as const;

const inflight = new Map<string, Promise<unknown>>();

export function coalesceRequest<T>(
  key: string,
  request: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const next = request().finally(() => {
    if (inflight.get(key) === next) {
      inflight.delete(key);
    }
  });

  inflight.set(key, next);
  return next;
}