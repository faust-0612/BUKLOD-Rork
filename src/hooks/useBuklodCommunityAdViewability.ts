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
export function useBuklodCommunityAdViewability() {
  const [activatedAdIds, setActivatedAdIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [visibleVideoPostId, setVisibleVideoPostId] = useState<string | null>(
    null,
  );

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ item?: unknown }>;
    }) => {
      const incoming: string[] = [];
      let nextVideoId: string | null = null;
      for (const token of viewableItems) {
        if (isCommunityFeedInlineAdRow(token.item)) {
          incoming.push(token.item.id);
          continue;
        }

        if (!nextVideoId) {
          nextVideoId = communityVideoPostId(token.item);
        }
      }

      setVisibleVideoPostId((current) =>
        current === nextVideoId ? current : nextVideoId,
      );

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

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 400,
  }).current;

  const extraData = useMemo(
    () =>
      `${[...activatedAdIds].sort().join('|')}:${visibleVideoPostId ?? ''}`,
    [activatedAdIds, visibleVideoPostId],
  );

  const isAdActive = useCallback(
    (id: string) => activatedAdIds.has(id),
    [activatedAdIds],
  );

  return {
    onViewableItemsChanged,
    viewabilityConfig,
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