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

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ item?: unknown }>;
    }) => {
      const incoming: string[] = [];
      for (const token of viewableItems) {
        if (isCommunityFeedInlineAdRow(token.item)) {
          incoming.push(token.item.id);
        }
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

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 400,
  }).current;

  const extraData = useMemo(
    () => [...activatedAdIds].sort().join('|'),
    [activatedAdIds],
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
  };
}