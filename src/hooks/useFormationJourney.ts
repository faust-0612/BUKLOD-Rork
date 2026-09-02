import { useCallback, useEffect, useState } from 'react';

import {
  loadFormationEngineEnabled,
  loadMyFormationJourney,
} from '@/lib/buklodFormationProgress';
import type { FormationJourney } from '@/types/buklodFormation';

type FormationJourneyState = {
  engineAvailable: boolean;
  engineEnabled: boolean;
  journey: FormationJourney | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useFormationJourney(userId: string | undefined): FormationJourneyState {
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

    try {
      const enabled = await loadFormationEngineEnabled();
      setEngineAvailable(true);
      setEngineEnabled(enabled);

      if (!enabled) {
        setJourney(null);
        return;
      }

      try {
        const data = await loadMyFormationJourney();
        setJourney(data);
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
  }, [userId]);

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
