/**
 * Development-only lightweight performance helpers.
 * No production logging noise.
 */

declare const __DEV__: boolean;

const screenMarks = new Map<string, number>();
const queryMarks = new Map<string, number>();

export function perfMarkScreenMount(screenName: string) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const key = String(screenName ?? 'unknown');
  screenMarks.set(key, Date.now());
}

export function perfMeasureScreenMount(screenName: string) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const key = String(screenName ?? 'unknown');
  const started = screenMarks.get(key);

  if (!started) {
    return;
  }

  const elapsed = Date.now() - started;
  screenMarks.delete(key);

  if (elapsed > 400) {
    console.debug(
      `[BUKLOD perf] screen "${key}" interactive in ${elapsed}ms`
    );
  }
}

export function perfMarkQuery(label: string) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  queryMarks.set(String(label), Date.now());
}

export function perfMeasureQuery(label: string, duplicateKey?: string) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const key = String(label);
  const started = queryMarks.get(key);

  if (!started) {
    return;
  }

  const elapsed = Date.now() - started;
  queryMarks.delete(key);

  if (elapsed > 600) {
    console.debug(
      `[BUKLOD perf] query "${key}" ${elapsed}ms`
    );
  }

  if (duplicateKey) {
    const dupKey = `dup:${duplicateKey}`;
    const last = queryMarks.get(dupKey);

    if (last && Date.now() - last < 1200) {
      console.debug(
        `[BUKLOD perf] duplicate query burst "${duplicateKey}"`
      );
    }

    queryMarks.set(dupKey, Date.now());
  }
}

import {
  SCALE_LIMITS,
  FLASHLIST_ESTIMATES,
} from '@/lib/performanceScale';

export {
  SCALE_LIMITS,
  FLASHLIST_ESTIMATES,
};

export const FLATLIST_TUNING = {
  inbox: {
    initialNumToRender: 10,
    maxToRenderPerBatch: 6,
    updateCellsBatchingPeriod: 50,
    windowSize: 6,
  },
  scopedCommunity: {
    initialNumToRender: 4,
    maxToRenderPerBatch: 3,
    updateCellsBatchingPeriod: 60,
    windowSize: 5,
  },
  publicCommunity: {
    initialNumToRender: 4,
    maxToRenderPerBatch: 4,
    updateCellsBatchingPeriod: 60,
    windowSize: 5,
  },
  connectThread: {
    initialNumToRender: 14,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    windowSize: 7,
  },
} as const;
/* -------------------------------------------------------------------------- */
/* BUKLOD PERFORMANCE + OFFLINE FOUNDATION R1                                 */
/* Added without replacing the legacy FLATLIST_TUNING / FLASHLIST_ESTIMATES.  */
/* -------------------------------------------------------------------------- */

export type R1PerformanceSample = {
  label: string;
  durationMs: number;
  finishedAt: number;
};

const r1PerformanceSamples: R1PerformanceSample[] = [];
const R1_MAX_PERFORMANCE_SAMPLES = 80;
const R1_SLOW_THRESHOLD_MS = 650;

function shouldLogR1Performance(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_PERF_LOGS === '1';
}

export function recordR1PerformanceSample(
  label: string,
  durationMs: number,
): void {
  const sample: R1PerformanceSample = {
    label: String(label).slice(0, 120),
    durationMs: Math.max(0, Number(durationMs) || 0),
    finishedAt: Date.now(),
  };

  r1PerformanceSamples.push(sample);

  if (r1PerformanceSamples.length > R1_MAX_PERFORMANCE_SAMPLES) {
    r1PerformanceSamples.splice(
      0,
      r1PerformanceSamples.length - R1_MAX_PERFORMANCE_SAMPLES,
    );
  }

  if (
    shouldLogR1Performance() &&
    sample.durationMs >= R1_SLOW_THRESHOLD_MS
  ) {
    console.warn(
      `[BUKLOD_PERF_R1] ${sample.label} took ${Math.round(sample.durationMs)}ms`,
    );
  }
}

export async function measureR1Async<T>(
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    return await work();
  } finally {
    recordR1PerformanceSample(
      label,
      Date.now() - startedAt,
    );
  }
}

export function getRecentR1PerformanceSamples(): R1PerformanceSample[] {
  return [...r1PerformanceSamples];
}

export function clearR1PerformanceSamples(): void {
  r1PerformanceSamples.length = 0;
}