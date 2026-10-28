/**
 * Photo prefetch shares the stable path cache key used by the image view.
 * expo-image prefetch(url) stores bytes under the signed URL, which misses
 * the path key and downloads the photo again. loadAsync({ uri, cacheKey })
 * writes the same key the view reads. A cache hit skips the network.
 */

import { Image as ExpoImage } from 'expo-image';

import { recordCommunityFeedMetric } from '@/lib/communityFeedTelemetry';
import {
  classifyNetworkQuality,
  communityPhotoPrefetchBudget,
  type BuklodNetworkQuality,
} from '@/lib/buklodNetworkQuality';

export type CommunityMediaPrefetchItem = {
  uri: string;
  cacheKey?: string;
};

type PrefetchDeps = {
  getCachePath?: (cacheKey: string) => Promise<string | null>;
  load: (item: CommunityMediaPrefetchItem) => Promise<void>;
};

const inFlight = new Map<string, Promise<'hit' | 'miss' | 'deduped'>>();
let activeLoads = 0;

function itemKey(item: CommunityMediaPrefetchItem) {
  return item.cacheKey || item.uri;
}

export function planCommunityMediaPrefetch(
  items: Array<string | null | undefined | CommunityMediaPrefetchItem>,
  quality: BuklodNetworkQuality = classifyNetworkQuality(),
) {
  const budget = communityPhotoPrefetchBudget(quality);
  if (budget.burst <= 0 || budget.concurrency <= 0) {
    return { jobs: [], concurrency: 0, burst: 0 };
  }
  const jobs: CommunityMediaPrefetchItem[] = [];
  const seen = new Set<string>();

  for (const entry of items) {
    const item =
      entry && typeof entry === 'object'
        ? {
            uri: String(entry.uri ?? '').trim(),
            cacheKey: String(entry.cacheKey ?? '').trim() || undefined,
          }
        : { uri: String(entry ?? '').trim() };

    if (!item.uri || /^(file|content|data|blob|ph|assets-library):/i.test(item.uri)) {
      continue;
    }

    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(item);
    if (jobs.length >= budget.burst) break;
  }

  return {
    jobs,
    concurrency: budget.concurrency,
    burst: budget.burst,
  };
}

async function prefetchOne(
  item: CommunityMediaPrefetchItem,
  deps: PrefetchDeps,
): Promise<'hit' | 'miss' | 'deduped'> {
  const key = itemKey(item);
  const pending = inFlight.get(key);
  if (pending) {
    await pending;
    return 'deduped';
  }

  const task = (async () => {
    if (item.cacheKey && deps.getCachePath) {
      const cached = await deps.getCachePath(item.cacheKey).catch(() => null);
      if (cached) return 'hit' as const;
    }

    activeLoads += 1;
    try {
      await deps.load(item);
      return 'miss' as const;
    } finally {
      activeLoads = Math.max(0, activeLoads - 1);
    }
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

export async function runCommunityMediaPrefetch(
  items: Array<string | null | undefined | CommunityMediaPrefetchItem>,
  options?: {
    quality?: BuklodNetworkQuality;
    deps?: PrefetchDeps;
  },
) {
  const quality = options?.quality ?? classifyNetworkQuality();
  const plan = planCommunityMediaPrefetch(items, quality);
  if (!plan.concurrency || !plan.jobs.length) {
    recordCommunityFeedMetric({
      stage: 'media_prefetch',
      elapsedMs: 0,
      status: 'ok',
      prefetchCount: 0,
      prefetchInFlight: activeLoads,
      quality,
      offline: quality === 'offline',
      degraded: quality === 'degraded',
    });
    return plan;
  }

  const deps = options?.deps ?? defaultPrefetchDeps();
  let cursor = 0;
  let hits = 0;
  let misses = 0;
  const started = Date.now();

  async function worker() {
    while (cursor < plan.jobs.length) {
      const job = plan.jobs[cursor];
      cursor += 1;
      const result = await prefetchOne(job, deps).catch(() => 'miss' as const);
      if (result === 'hit' || result === 'deduped') hits += 1;
      else misses += 1;
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(plan.concurrency, plan.jobs.length) },
      () => worker(),
    ),
  );

  recordCommunityFeedMetric({
    stage: 'media_prefetch',
    elapsedMs: Date.now() - started,
    status: 'ok',
    cache: misses ? 'miss' : 'hit',
    prefetchCount: plan.jobs.length,
    prefetchInFlight: activeLoads,
    quality,
    offline: quality === 'offline',
    degraded: quality === 'degraded',
  });

  return { ...plan, hits, misses };
}

function defaultPrefetchDeps(): PrefetchDeps {
  return {
    getCachePath: cacheKey => {
      const reader = (ExpoImage as any).getCachePathAsync as
        | ((key: string) => Promise<string | null>)
        | undefined;
      if (!reader) return Promise.resolve(null);
      return reader(cacheKey);
    },
    load: async item => {
      const loader = (ExpoImage as any).loadAsync as
        | ((source: { uri: string; cacheKey?: string }) => Promise<unknown>)
        | undefined;
      if (item.cacheKey && loader) {
        await loader({ uri: item.uri, cacheKey: item.cacheKey });
        return;
      }

      await ExpoImage.prefetch(item.uri, 'disk');
    },
  };
}

export function resetCommunityMediaPrefetchForTests() {
  inFlight.clear();
  activeLoads = 0;
}
