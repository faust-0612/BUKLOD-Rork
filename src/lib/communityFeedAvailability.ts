/**
 * Community Wall progressive feed.
 * Canonical post text paints before names, reactions, and media.
 * Append cannot invalidate a successful first page.
 */

import type { BuklodNetworkQuality } from '@/lib/buklodNetworkQuality';
import {
  classifyNetworkQuality,
  noteMeasuredRead,
} from '@/lib/buklodNetworkQuality';
import { recordCommunityFeedMetric } from '@/lib/communityFeedTelemetry';

export type CommunityFeedPaintState =
  | 'LOADING'
  | 'LOADED'
  | 'CACHED_OFFLINE'
  | 'RETRYABLE_ERROR'
  | 'EMPTY_CONFIRMED';

export type CommunityFeedMode = 'for_you' | 'following' | 'latest';

export type CommunityFeedSession = {
  refreshGeneration: number;
  appendGeneration: number;
  pageOneReady: boolean;
  identity: string | null;
};

export type CommunityFeedToken = {
  kind: 'refresh' | 'append';
  refreshGeneration: number;
  appendGeneration: number;
  identityChanged: boolean;
  previousIdentity: string | null;
};

export type CommunityMediaLookup = 'authoritative' | 'failed';

export type CommunityEnrichment<T> = {
  rows: T[];
  mediaLookup: CommunityMediaLookup;
};

export type CommunityFeedPaintMode =
  | 'identity'
  | 'memory'
  | 'disk'
  | 'canonical'
  | 'enriched';

export const COMMUNITY_FEED_CACHE_VERSION = 2;
export const COMMUNITY_RETRY_MIN_INTERVAL_MS = 1_500;

export function createCommunityFeedSession(): CommunityFeedSession {
  return {
    refreshGeneration: 0,
    appendGeneration: 0,
    pageOneReady: false,
    identity: null,
  };
}

export function beginCommunityFeedLoad(
  session: CommunityFeedSession,
  input: { append: boolean; identity: string },
): CommunityFeedToken | null {
  const previousIdentity = session.identity;
  const identityChanged = previousIdentity !== input.identity;
  if (identityChanged) {
    session.identity = input.identity;
    session.pageOneReady = false;
  }

  if (input.append) {
    if (!session.pageOneReady) return null;
    session.appendGeneration += 1;
    return {
      kind: 'append',
      refreshGeneration: session.refreshGeneration,
      appendGeneration: session.appendGeneration,
      identityChanged: false,
      previousIdentity,
    };
  }

  session.refreshGeneration += 1;
  session.appendGeneration += 1;
  session.pageOneReady = false;
  return {
    kind: 'refresh',
    refreshGeneration: session.refreshGeneration,
    appendGeneration: session.appendGeneration,
    identityChanged,
    previousIdentity,
  };
}

export function isCommunityFeedTokenCurrent(
  session: CommunityFeedSession,
  token: CommunityFeedToken | null | undefined,
) {
  if (!token) return false;
  if (token.refreshGeneration !== session.refreshGeneration) return false;
  if (token.kind === 'append') {
    return token.appendGeneration === session.appendGeneration;
  }
  return true;
}

export function markCommunityPageOneReady(
  session: CommunityFeedSession,
  token: CommunityFeedToken,
) {
  if (!isCommunityFeedTokenCurrent(session, token)) return;
  if (token.kind !== 'refresh') return;
  session.pageOneReady = true;
}

export function invalidateCommunityFeedSession(session: CommunityFeedSession) {
  session.refreshGeneration += 1;
  session.appendGeneration += 1;
  session.pageOneReady = false;
}

export function versionedCommunityFeedCacheKey(baseModeKey: string) {
  return `${baseModeKey}:v${COMMUNITY_FEED_CACHE_VERSION}`;
}

export function communityFeedUserId(identity: string | null | undefined) {
  const userId = String(identity ?? '').split(':')[0]?.trim();
  return userId || null;
}

export function dropWarmCommunityFeedForUser(
  memory: Map<string, any>,
  userId: string,
) {
  const prefix = `community_feed:${userId}:`;
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export function asCommunityEnrichment<T>(
  result: T[] | CommunityEnrichment<T>,
): CommunityEnrichment<T> {
  if (Array.isArray(result)) {
    return { rows: result, mediaLookup: 'failed' };
  }
  return {
    rows: result.rows,
    mediaLookup: result.mediaLookup === 'authoritative'
      ? 'authoritative'
      : 'failed',
  };
}

export function communityRetryAllowed(
  lastAttemptAt: number,
  now = Date.now(),
  minIntervalMs = COMMUNITY_RETRY_MIN_INTERVAL_MS,
) {
  return now - Math.max(0, lastAttemptAt || 0) >= minIntervalMs;
}

export function withCanonicalCommunityAuthor<
  T extends {
    user_id?: string | null;
    author_name?: string | null;
    media_items?: unknown;
    my_reaction?: unknown;
  },
>(
  row: T,
  resolveName: (
    name?: string | null,
    userId?: string | null,
  ) => string,
): T {
  return {
    ...row,
    author_name: resolveName(row.author_name, row.user_id),
    media_items: Array.isArray(row.media_items) ? row.media_items : [],
    my_reaction: row.my_reaction ?? null,
  };
}

export function mergePaintedCommunityPosts<
  T extends {
    id?: string | number;
    author_name?: string | null;
    media_path?: string | null;
    media_url?: string | null;
    media_items?: any[];
    my_reaction?: unknown;
  },
>(
  previous: T[],
  next: T[],
  options: {
    append: boolean;
    preserveEmptyMedia: boolean;
    replaceWithNext?: boolean;
    keepUnmentioned?: boolean;
  },
): T[] {
  if (options.replaceWithNext) return next.slice();

  if (options.append) {
    const seen = new Set(previous.map(row => String(row.id ?? '')));
    return [
      ...previous,
      ...next.filter(row => row?.id != null && !seen.has(String(row.id))),
    ];
  }

  const combine = (old: T | undefined, row: T): T => {
    if (!old) return row;
    const nextItems = Array.isArray(row.media_items) ? row.media_items : [];
    const oldItems = Array.isArray(old.media_items) ? old.media_items : [];
    const keepProvisional =
      options.preserveEmptyMedia && nextItems.length === 0;
    const clearMedia = !options.preserveEmptyMedia && nextItems.length === 0;
    return {
      ...old,
      ...row,
      author_name: row.author_name || old.author_name,
      media_path: clearMedia
        ? null
        : (row.media_path ?? (keepProvisional ? old.media_path : row.media_path)),
      media_url: clearMedia
        ? null
        : (row.media_url || (keepProvisional ? old.media_url : row.media_url)),
      media_items: keepProvisional ? oldItems : nextItems,
      my_reaction: row.my_reaction ?? old.my_reaction ?? null,
    };
  };

  if (options.keepUnmentioned) {
    const nextById = new Map(next.map(row => [String(row.id ?? ''), row]));
    const seen = new Set<string>();
    const merged = previous.map(old => {
      const id = String(old.id ?? '');
      const row = nextById.get(id);
      if (!row) return old;
      seen.add(id);
      return combine(old, row);
    });
    for (const row of next) {
      const id = String(row.id ?? '');
      if (!seen.has(id)) merged.push(row);
    }
    return merged;
  }

  const prevById = new Map(
    previous.map(row => [String(row.id ?? ''), row]),
  );

  return next.map(row => combine(prevById.get(String(row.id ?? '')), row));
}

export function applyAuthoritativeCommunityMedia<
  T extends {
    id?: string | number;
    media_path?: string | null;
    media_url?: string | null;
    media_items?: any[];
  },
>(
  posts: T[],
  postIds: Array<string | number>,
  mediaByPost: Record<string, any[] | null | undefined>,
): T[] {
  const ids = new Set(postIds.map(id => String(id)));
  return posts.map(post => {
    const id = String(post.id ?? '');
    if (!ids.has(id)) return post;
    const loaded = mediaByPost[id];
    if (Array.isArray(loaded) && loaded.length) {
      return {
        ...post,
        media_items: loaded.slice().sort(
          (a: any, b: any) =>
            Number(a?.media_position ?? 0) - Number(b?.media_position ?? 0),
        ),
      };
    }
    return {
      ...post,
      media_path: null,
      media_url: null,
      media_items: [],
    };
  });
}

export function communityFeedStatusMessage(
  state: CommunityFeedPaintState,
  mode: CommunityFeedMode,
) {
  if (state === 'LOADING') {
    return {
      message: 'Loading posts…',
      showRetry: false,
    };
  }

  if (state === 'RETRYABLE_ERROR') {
    return {
      message: "Couldn't load posts. Check your connection and try again.",
      showRetry: true,
    };
  }

  if (state === 'CACHED_OFFLINE') {
    return {
      message: 'Showing saved posts from this phone.',
      showRetry: true,
    };
  }

  if (state === 'EMPTY_CONFIRMED') {
    return {
      message:
        mode === 'following'
          ? 'No posts from people you follow yet.'
          : 'No Public posts yet.',
      showRetry: false,
    };
  }

  return { message: '', showRetry: false };
}

export type ProgressiveFeedResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: unknown };

export async function executeProgressiveCommunityFeed<T>(options: {
  session: CommunityFeedSession;
  append: boolean;
  identity: string;
  online: boolean;
  readMemory: () => T[] | null | undefined;
  readDisk: () => Promise<T[] | null | undefined>;
  fetchFeed: () => Promise<ProgressiveFeedResult<T>>;
  toCanonical: (rows: T[]) => T[];
  enrich: (rows: T[]) => Promise<T[] | CommunityEnrichment<T>>;
  paint: (
    rows: T[],
    meta: {
      mode: CommunityFeedPaintMode;
      append: boolean;
      preserveEmptyMedia: boolean;
      replaceWithNext: boolean;
      keepUnmentioned: boolean;
    },
  ) => void;
  onState: (state: CommunityFeedPaintState) => void;
  onPageReady?: (rowCount: number) => void;
  onIdentityChange?: (
    previousIdentity: string | null,
    nextIdentity: string,
  ) => void;
  onFailure?: (error: unknown, hadCache: boolean) => void;
  persist?: (rows: T[]) => void;
  onToken?: (token: CommunityFeedToken) => void;
}): Promise<number> {
  const token = beginCommunityFeedLoad(options.session, {
    append: options.append,
    identity: options.identity,
  });

  if (!token) return -1;
  options.onToken?.(token);
  if (token.identityChanged) {
    options.onIdentityChange?.(token.previousIdentity, options.identity);
  }

  const current = () =>
    isCommunityFeedTokenCurrent(options.session, token);

  let authoritative = false;
  const started = Date.now();

  if (!options.append && token.identityChanged && current()) {
    const memory = options.readMemory() ?? [];
    if (!memory.length) {
      options.paint([], {
        mode: 'identity',
        append: false,
        preserveEmptyMedia: false,
        replaceWithNext: true,
        keepUnmentioned: false,
      });
      options.onState(options.online ? 'LOADING' : 'RETRYABLE_ERROR');
    }
  }

  if (!options.append && current()) {
    const memory = options.readMemory() ?? [];
    if (memory.length) {
      options.paint(memory, {
        mode: 'memory',
        append: false,
        preserveEmptyMedia: true,
        replaceWithNext: false,
        keepUnmentioned: false,
      });
      options.onState(options.online ? 'LOADED' : 'CACHED_OFFLINE');
      recordCommunityFeedMetric({
        stage: 'first_text_paint',
        elapsedMs: 0,
        status: 'cache',
        rowCount: memory.length,
        cache: 'hit',
        quality: classifyNetworkQuality(),
        offline: !options.online,
        degraded: classifyNetworkQuality() === 'degraded',
      });
    } else if (options.online) {
      options.onState('LOADING');
    }
  }

  if (!options.online && !options.append) {
    const disk = (await options.readDisk()) ?? [];
    if (!current()) return -1;
    if (disk.length) {
      options.paint(disk, {
        mode: 'disk',
        append: false,
        preserveEmptyMedia: true,
        replaceWithNext: false,
        keepUnmentioned: false,
      });
      options.onState('CACHED_OFFLINE');
      markCommunityPageOneReady(options.session, token);
      options.onPageReady?.(disk.length);
      return disk.length;
    }

    options.onState('RETRYABLE_ERROR');
    options.onFailure?.(new Error('offline'), false);
    return -1;
  }

  if (!options.append && options.online) {
    void options.readDisk()
      .then(disk => {
        if (authoritative || !disk?.length || !current()) return;
        options.paint(disk, {
          mode: 'disk',
          append: false,
          preserveEmptyMedia: true,
          replaceWithNext: false,
          keepUnmentioned: false,
        });
        options.onState('CACHED_OFFLINE');
      })
      .catch(() => undefined);
  }

  if (options.append && !options.online) return -1;

  let fetched: ProgressiveFeedResult<T>;
  try {
    fetched = await options.fetchFeed();
  } catch (error) {
    fetched = { ok: false, error };
  }

  const elapsed = Date.now() - started;
  noteMeasuredRead(elapsed, fetched.ok);
  const quality: BuklodNetworkQuality = classifyNetworkQuality();
  recordCommunityFeedMetric({
    stage: 'feed_rpc',
    elapsedMs: elapsed,
    status: fetched.ok ? 'ok' : 'error',
    rowCount: fetched.ok ? fetched.rows.length : 0,
    quality,
    offline: !options.online,
    degraded: quality === 'degraded',
  });

  if (!current()) return -1;

  if (!fetched.ok) {
    const disk = options.append ? [] : ((await options.readDisk()) ?? []);
    if (!current()) return -1;
    if (!options.append && disk.length) {
      authoritative = true;
      options.paint(disk, {
        mode: 'disk',
        append: false,
        preserveEmptyMedia: true,
        replaceWithNext: false,
        keepUnmentioned: false,
      });
      options.onState('CACHED_OFFLINE');
      markCommunityPageOneReady(options.session, token);
      options.onPageReady?.(disk.length);
      options.onFailure?.(fetched.error, true);
      return disk.length;
    }

    if (!options.append) options.onState('RETRYABLE_ERROR');
    options.onFailure?.(fetched.error, false);
    return -1;
  }

  authoritative = true;
  const canonical = options.toCanonical(fetched.rows);
  if (!options.append && current()) {
    options.paint(canonical, {
      mode: 'canonical',
      append: false,
      preserveEmptyMedia: true,
      replaceWithNext: false,
      keepUnmentioned: false,
    });
    options.onState(canonical.length ? 'LOADED' : 'EMPTY_CONFIRMED');
    markCommunityPageOneReady(options.session, token);
    options.onPageReady?.(canonical.length);
    if (canonical.length) options.persist?.(canonical);
    recordCommunityFeedMetric({
      stage: 'first_text_paint',
      elapsedMs: Date.now() - started,
      status: 'ok',
      rowCount: canonical.length,
      cache: 'miss',
      quality,
      offline: false,
      degraded: quality === 'degraded',
    });
  }

  let enriched = canonical;
  let mediaLookup: CommunityMediaLookup = 'failed';
  try {
    const enrichment = asCommunityEnrichment(
      await options.enrich(fetched.rows),
    );
    enriched = enrichment.rows;
    mediaLookup = enrichment.mediaLookup;
  } catch {
    enriched = canonical;
    mediaLookup = 'failed';
  }

  if (!current()) return -1;

  const mediaAuthoritative = mediaLookup === 'authoritative';
  options.paint(enriched, {
    mode: 'enriched',
    append: options.append,
    preserveEmptyMedia: !mediaAuthoritative,
    replaceWithNext: false,
    keepUnmentioned: !options.append,
  });

  if (!options.append) {
    options.onState(enriched.length ? 'LOADED' : 'EMPTY_CONFIRMED');
    if (mediaAuthoritative && enriched.length) options.persist?.(enriched);
  }

  return enriched.length;
}
