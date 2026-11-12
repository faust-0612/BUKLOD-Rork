/**
 * Community video playback policy for SDK 57 expo-video.
 *
 * Regular wall playback already passes `{ uri, useCaching: true }`.
 * That cache is a bounded LRU of bytes the player actually requested.
 * It is keyed by the URI the player was given. A rotated signed URL is a
 * different URI, so it is not treated as permission to replay private bytes.
 *
 * Google IMA playback uses the native IMA player and does not use this cache.
 * Changing that requires a native build. It is not an OTA-only fix.
 */

export const COMMUNITY_VIDEO_CACHE_BUDGET_BYTES = 256 * 1024 * 1024;

/**
 * Restrict only off-screen decoders on lower Java-heap Android devices.
 * Active video playback, preload buffering, image quality, fullscreen,
 * audio mixing and sponsored ad playback remain unchanged.
 */
export const COMMUNITY_VIDEO_LOW_HEAP_THRESHOLD_BYTES = 384 * 1024 * 1024;

export function androidCommunityVideoMemoryPolicy(maxJavaHeapBytes: number | null) {
  const lowHeap =
    !Number.isFinite(maxJavaHeapBytes) ||
    Number(maxJavaHeapBytes) <= 0 ||
    Number(maxJavaHeapBytes) < COMMUNITY_VIDEO_LOW_HEAP_THRESHOLD_BYTES;
  return {
    lowHeap,
    allowPreload: !lowHeap,
    allowKeepWarm: !lowHeap,
  };
}

export type CommunityVideoPlayerKind = 'expo-video' | 'google-ima';

export type ByteRange = {
  start: number;
  end: number;
};

export function shouldMountCommunityVideoPlayer(input: {
  active: boolean;
  fullscreen: boolean;
  degraded: boolean;
  playIntent: boolean;
  preload?: boolean;
  keepWarm?: boolean;
}) {
  // Pause immediately when out of view, but retain the decoder briefly on
  // rapid scroll-backs; one upcoming video may buffer without playing.
  if (!input.active && !input.preload && !input.keepWarm) return false;
  if (input.fullscreen || input.playIntent) return true;
  // Browser video loads for the visible row regardless of measured network
  // quality. Android must not render a permanent black/placeholder-only row
  // merely because reachability is degraded; offscreen players stay unmounted.
  return true;
}

export function communityVideoCachePlan(kind: CommunityVideoPlayerKind) {
  if (kind === 'google-ima') {
    return {
      player: kind,
      persistentByteCache: false,
      preDownload: false,
      budgetBytes: 0,
      reuseAcrossSignedUrlRotation: false,
      fullFileOfflineGuaranteed: false,
      boundary:
        'Google IMA loads content in the native IMA player. expo-video useCaching does not apply, and ad media must not be cached to skip ads. A content-byte cache needs a separate native APK.',
    };
  }

  return {
    player: kind,
    persistentByteCache: true,
    useCaching: true,
    preDownload: false,
    budgetBytes: COMMUNITY_VIDEO_CACHE_BUDGET_BYTES,
    eviction: 'lru' as const,
    reuseAcrossSignedUrlRotation: false,
    fullFileOfflineGuaranteed: false,
    boundary:
      'expo-video SDK 57 caches requested ranges for the same URI up to the configured LRU budget. The default SDK budget is 1 GB; Community uses 256 MB so a long wall video is not retained in full. The operating system may evict the cache.',
  };
}

function rangeBytes(range: ByteRange) {
  return Math.max(0, range.end - range.start + 1);
}

export function missingByteRanges(
  needed: ByteRange[],
  cached: ByteRange[],
): ByteRange[] {
  const missing: ByteRange[] = [];

  for (const request of needed) {
    let cursor = request.start;
    const end = request.end;
    const overlaps = cached
      .filter(range => range.end >= request.start && range.start <= request.end)
      .sort((a, b) => a.start - b.start);

    for (const hit of overlaps) {
      const hitStart = Math.max(hit.start, request.start);
      const hitEnd = Math.min(hit.end, request.end);
      if (hitStart > cursor) {
        missing.push({ start: cursor, end: hitStart - 1 });
      }
      cursor = Math.max(cursor, hitEnd + 1);
    }

    if (cursor <= end) {
      missing.push({ start: cursor, end });
    }
  }

  return missing.filter(range => range.end >= range.start);
}

export function replayDownloadedBytes(input: {
  player: CommunityVideoPlayerKind;
  authorized: boolean;
  sameMediaIdentity: boolean;
  cacheRetained: boolean;
  needed: ByteRange[];
  cached: ByteRange[];
}) {
  if (!input.authorized) {
    return {
      bytes: 0,
      blocked: true,
      cacheSupported: input.player === 'expo-video',
      ranges: [] as ByteRange[],
    };
  }

  if (input.player === 'google-ima') {
    return {
      bytes: null as number | null,
      blocked: false,
      cacheSupported: false,
      ranges: input.needed,
    };
  }

  if (!input.cacheRetained || !input.sameMediaIdentity) {
    const bytes = input.needed.reduce((sum, range) => sum + rangeBytes(range), 0);
    return {
      bytes,
      blocked: false,
      cacheSupported: true,
      ranges: input.needed,
    };
  }

  const ranges = missingByteRanges(input.needed, input.cached);
  return {
    bytes: ranges.reduce((sum, range) => sum + rangeBytes(range), 0),
    blocked: false,
    cacheSupported: true,
    ranges,
  };
}

/** One same-URL replay before refreshing signed access; never retry offscreen. */
export function decideCommunityVideoErrorRecovery(input: {
  active: boolean;
  replayAttempts: number;
  retryNotBefore: number;
  now: number;
  reported: boolean;
}): 'ignore' | 'replay' | 'refresh' {
  if (!input.active || input.reported) return 'ignore';
  if (input.replayAttempts < 1) return 'replay';
  return input.now >= input.retryNotBefore ? 'refresh' : 'ignore';
}
