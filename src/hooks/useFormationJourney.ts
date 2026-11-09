import { useCallback, useEffect, useState } from 'react';

import {
  loadFormationEngineEnabled,
  loadMyFormationJourney,
} from '@/lib/buklodFormationProgress';
import type { FormationJourney } from '@/types/buklodFormation';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';

type FormationJourneyState = {
  engineAvailable: boolean;
  engineEnabled: boolean;
  journey: FormationJourney | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useFormationJourney(userId: string | undefined): FormationJourneyState {
  const { online } = useNetwork();
  const [engineEnabled, setEngineEnabled] = useState(false);
  const [engineAvailable, setEngineAvailable] = useState(false);
  const [journey, setJourney] = useState<FormationJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setEngineEnabled(false);
      setEngineAvailable(false);
      setJourney(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (!online) {
      const cached = await getOfflineCache<{
        enabled: boolean;
        journey: FormationJourney | null;
      }>('formation-journey-v1', { userId, allowStale: true });
      if (cached?.data) {
        setEngineEnabled(cached.data.enabled);
        setEngineAvailable(true);
        setJourney(cached.data.journey);
      } else {
        setEngineAvailable(false);
        setEngineEnabled(false);
        setJourney(null);
        setError('Connect once to save your BUKLOD Lesson progress.');
      }
      setLoading(false);
      return;
    }

    try {
      const enabled = await loadFormationEngineEnabled();
      setEngineAvailable(true);
      setEngineEnabled(enabled);

      if (!enabled) {
        setJourney(null);
        void setOfflineCache('formation-journey-v1',
          { enabled: false, journey: null },
          { userId, ttlMs: 30 * 24 * 60 * 60 * 1000 }).catch(() => undefined);
        return;
      }

      try {
        const data = await loadMyFormationJourney();
        setJourney(data);
        void setOfflineCache('formation-journey-v1',
          { enabled: true, journey: data },
          { userId, ttlMs: 30 * 24 * 60 * 60 * 1000 }).catch(() => undefined);
      } catch (journeyError: unknown) {
        const message =
          journeyError instanceof Error
            ? journeyError.message
            : 'Formation journey unavailable';
        setJourney(null);
        setError(message);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Formation engine unavailable';
      setEngineAvailable(false);
      setEngineEnabled(false);
      setJourney(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId, online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    engineAvailable,
    engineEnabled,
    journey,
    loading,
    error,
    refresh,
  };
}
