export type ReaderIssueKind = 'library' | 'image' | 'audio' | 'unlock';

export type ReaderIssue = {
  kind: ReaderIssueKind;
  detail: string;
  at: string;
};

export type ReaderCache = {
  version: 1;
  textScale: number;
  dataSaver: boolean;
  motionEnabled: boolean;
  batterySaver: boolean;
  musicVolume: number;
  ambientVolume: number;
  musicMuted: boolean;
  ambientMuted: boolean;
  lastEpisodeId: string | null;
  scrollByEpisode: Record<string, number>;
  issues: ReaderIssue[];
};

export const DEFAULT_READER_CACHE: ReaderCache = {
  version: 1,
  textScale: 1,
  dataSaver: false,
  motionEnabled: true,
  batterySaver: false,
  musicVolume: 0.6,
  ambientVolume: 0.4,
  musicMuted: false,
  ambientMuted: false,
  lastEpisodeId: null,
  scrollByEpisode: {},
  issues: [],
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeReaderCache(input: Partial<ReaderCache> | null | undefined): ReaderCache {
  const scroll: Record<string, number> = {};
  const rawScroll = input?.scrollByEpisode ?? {};
  for (const [key, value] of Object.entries(rawScroll)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      scroll[key] = value;
    }
  }
  const issues = Array.isArray(input?.issues)
    ? input.issues.filter((issue) => issue && typeof issue.detail === 'string').slice(-20)
    : [];
  return {
    version: 1,
    textScale: clamp(input?.textScale ?? 1, 0.85, 1.35),
    dataSaver: Boolean(input?.dataSaver),
    motionEnabled: input?.motionEnabled !== false,
    batterySaver: Boolean(input?.batterySaver),
    musicVolume: clamp(input?.musicVolume ?? 0.6, 0, 1),
    ambientVolume: clamp(input?.ambientVolume ?? 0.4, 0, 1),
    musicMuted: Boolean(input?.musicMuted),
    ambientMuted: Boolean(input?.ambientMuted),
    lastEpisodeId: typeof input?.lastEpisodeId === 'string' ? input.lastEpisodeId : null,
    scrollByEpisode: scroll,
    issues,
  };
}

export function rememberScroll(
  cache: ReaderCache,
  episodeId: string,
  offset: number,
  readable: boolean,
): ReaderCache {
  const next = sanitizeReaderCache({ ...cache, lastEpisodeId: episodeId });
  if (!readable) return next;
  return sanitizeReaderCache({
    ...next,
    scrollByEpisode: { ...next.scrollByEpisode, [episodeId]: Math.max(0, offset) },
  });
}

export function queueReaderIssue(cache: ReaderCache, issue: ReaderIssue): ReaderCache {
  return sanitizeReaderCache({
    ...cache,
    issues: [...cache.issues, { ...issue, detail: issue.detail.slice(0, 180) }],
  });
}

export function imageSlot(uri: string | null, lowBandwidth: boolean): {
  showImage: boolean;
  message: 'missing' | 'withheld' | 'ready';
} {
  if (!uri) return { showImage: false, message: 'missing' };
  if (lowBandwidth) return { showImage: false, message: 'withheld' };
  return { showImage: true, message: 'ready' };
}
