import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  loadBuklodKingdomProgress,
  recordBuklodKingdomResult,
  subscribeBuklodKingdomProgress,
  type BuklodKingdomProgress,
  type BuklodKingdomStationProgress,
} from '@/features/games/kingdom/progress';
import type { BuklodGameResult } from '@/features/games/types';

const CORE_GAMES = new Set([
  'phan-enterprise-builder',
  'van-living-city-dispatch',
  'christian-civic-leadership',
  'lhen-rhythm-journey',
  'quin-discovery-expedition',
]);

export function useBuklodGameKingdomRuntime(gameId?: string) {
  const [progress, setProgress] = useState<BuklodKingdomProgress | null>(null);
  const [loading, setLoading] = useState(Boolean(gameId));

  useEffect(() => {
    let mounted = true;
    if (!gameId) {
      setLoading(false);
      return () => undefined;
    }

    setLoading(true);
    loadBuklodKingdomProgress()
      .then((value) => {
        if (mounted) setProgress(value);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const unsubscribe = subscribeBuklodKingdomProgress((value) => {
      if (mounted) setProgress(value);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [gameId]);

  const station = useMemo<BuklodKingdomStationProgress | null>(
    () => (gameId ? progress?.stations?.[gameId] ?? null : null),
    [gameId, progress],
  );

  const canPlay = !gameId
    ? true
    : station
      ? station.unlocked
      : !loading && CORE_GAMES.has(gameId);

  const level = station?.currentLevel ?? 1;
  const difficulty = 1 + Math.max(0, level - 1) * 0.055;
  const speedMultiplier = 1 + Math.max(0, level - 1) * 0.035;
  const targetMultiplier = 1 + Math.max(0, level - 1) * 0.04;
  const resourceMultiplier = Math.max(0.58, 1 - Math.max(0, level - 1) * 0.018);

  const submitResult = useCallback(
    async (result: BuklodGameResult) => {
      const next = await recordBuklodKingdomResult(result);
      setProgress(next);
      return next;
    },
    [],
  );

  return {
    progress,
    station,
    loading,
    canPlay,
    level,
    difficulty,
    speedMultiplier,
    targetMultiplier,
    resourceMultiplier,
    submitResult,
  };
}
