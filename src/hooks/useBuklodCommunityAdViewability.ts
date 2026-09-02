import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  isCommunityFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';

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
