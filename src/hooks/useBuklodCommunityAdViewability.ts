import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  isCommunityFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';

let visibleCommunityInlineIds: ReadonlySet<string> = new Set();
const visibleCommunityInlineListeners = new Set<() => void>();

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function publishVisibleCommunityInlineIds(ids: ReadonlySet<string>) {
  if (sameIds(visibleCommunityInlineIds, ids)) return;
  visibleCommunityInlineIds = ids;
  visibleCommunityInlineListeners.forEach(listener => listener());
}

/**
 * Current on-screen state for an inline Community feed row.
 * This is deliberately separate from the sticky AdMob activation state below:
 * ads stay mounted after first view, while video playback may use true current
 * visibility so an off-screen IGPAT cannot continue playing.
 */
export function useBuklodCommunityInlineVisibility(slotId?: string) {
  const readVisible = useCallback(
    () => Boolean(slotId && visibleCommunityInlineIds.has(slotId)),
    [slotId],
  );
  const [visible, setVisible] = useState(readVisible);

  useEffect(() => {
    const sync = () => setVisible(readVisible());
    visibleCommunityInlineListeners.add(sync);
    sync();
    return () => {
      visibleCommunityInlineListeners.delete(sync);
    };
  }, [readVisible]);

  return visible;
}

/**
 * Activates community inline ads only after they are actually on screen.
 * Once activated, a slot stays mounted until the list recycles it so
 * visibility flicker does not spam extra AdMob requests.
 */
export function useBuklodCommunityAdViewability(feedRows: readonly unknown[] = []) {
  const feedRowsRef = useRef(feedRows);
  feedRowsRef.current = feedRows;
  const [activatedAdIds, setActivatedAdIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [visibleVideoPostId, setVisibleVideoPostId] = useState<string | null>(
    null,
  );

  const [preloadVideoPostId, setPreloadVideoPostId] = useState<string | null>(null);

  // Native ads retain the original conservative visibility requirement.
  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ item?: unknown }>;
    }) => {
      const incoming: string[] = [];
      for (const token of viewableItems) {
        if (isCommunityFeedInlineAdRow(token.item)) incoming.push(token.item.id);
      }

      publishVisibleCommunityInlineIds(new Set(incoming));

      if (!incoming.length) {
        return;
      }

      setActivatedAdIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of incoming) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
  ).current;

  // Video becomes eligible as its post enters the viewport, independently
  // of ad request visibility. Keep only one autoplay video at a time.
  const onVideoViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item?: unknown }> }) => {
      let nextVideoId: string | null = null;
      for (const token of viewableItems) {
        nextVideoId = communityVideoPostId(token.item);
        if (nextVideoId) break;
      }
      setVisibleVideoPostId(current => current === nextVideoId ? current : nextVideoId);

      // Prebuffer only the next video within three feed rows. This bounds
      // concurrent downloads, decoder usage and needless mobile-data costs.
      const rows = feedRowsRef.current;
      const index = nextVideoId
        ? rows.findIndex(item => communityVideoPostId(item) === nextVideoId)
        : -1;
      let nextPreloadId: string | null = null;
      if (index >= 0) {
        for (let i = index + 1; i < Math.min(rows.length, index + 4); i += 1) {
          nextPreloadId = communityVideoPostId(rows[i]);
          if (nextPreloadId) break;
        }
      }
      setPreloadVideoPostId(current =>
        current === nextPreloadId ? current : nextPreloadId,
      );
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 400,
  }).current;
  // Start the already-prebuffered next clip as soon as it enters the viewport.
  // Independent from the stricter AdMob visibility/impression threshold.
  const videoViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 25,
    minimumViewTime: 0,
  }).current;

  const extraData = useMemo(
    () =>
      `${[...activatedAdIds].sort().join('|')}:${visibleVideoPostId ?? ''}:${preloadVideoPostId ?? ''}`,
    [activatedAdIds, visibleVideoPostId, preloadVideoPostId],
  );

  const isAdActive = useCallback(
    (id: string) => activatedAdIds.has(id),
    [activatedAdIds],
  );

  return {
    onViewableItemsChanged,
    viewabilityConfig,
    videoViewabilityConfig,
    onVideoViewableItemsChanged,
    preloadVideoPostId,
    extraData,
    isAdActive,
    visibleVideoPostId,
  };
}

function communityVideoPostId(item: unknown) {
  if (!item || typeof item !== 'object') return null;

  const post = item as {
    id?: unknown;
    is_reel?: unknown;
    media_url?: unknown;
    media_mime_type?: unknown;
    media_items?: unknown;
  };

  const id = String(post.id ?? '').trim();
  if (!id) return null;

  const attached = Array.isArray(post.media_items)
    ? post.media_items.find((media) => {
        const row = media as {
          media_mime_type?: unknown;
          media_url?: unknown;
        };
        return (
          String(row?.media_mime_type ?? '')
            .trim()
            .toLowerCase()
            .startsWith('video/') &&
          String(row?.media_url ?? '').trim().length > 0
        );
      })
    : null;

  const fallback = String(post.media_mime_type ?? '')
    .trim()
    .toLowerCase()
    .startsWith('video/')
    ? post
    : null;

  const media = (attached ?? fallback) as {
    media_url?: unknown;
  } | null;

  if (!media || !String(media.media_url ?? '').trim()) {
    return null;
  }

  return id;
}