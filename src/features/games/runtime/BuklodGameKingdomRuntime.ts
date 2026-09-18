import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

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
  const params = useLocalSearchParams<{ level?: string | string[] }>();
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

  const requestedLevelRaw = Array.isArray(params.level) ? params.level[0] : params.level;
  const requestedLevel = requestedLevelRaw
    ? Math.max(1, Math.min(20, Math.floor(Number(requestedLevelRaw) || 1)))
    : null;

  const canPlay = !gameId
    ? true
    : station
      ? station.unlocked && (requestedLevel == null || requestedLevel <= station.currentLevel)
      : !loading && CORE_GAMES.has(gameId);

  const level = requestedLevel ?? station?.currentLevel ?? 1;
  const difficulty = 1 + Math.max(0, level - 1) * 0.055;
  const speedMultiplier = 1 + Math.max(0, level - 1) * 0.035;
  const targetMultiplier = 1 + Math.max(0, level - 1) * 0.04;
  const resourceMultiplier = Math.max(0.58, 1 - Math.max(0, level - 1) * 0.018);

  const submitResult = useCallback(
    async (result: BuklodGameResult) => {
      const next = await recordBuklodKingdomResult(result, level);
      setProgress(next);
      return next;
    },
    [level],
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
