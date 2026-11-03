import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  initializeBuklodAds,
  refreshBuklodAdConsent,
} from '@/lib/adMob';

import {
  buklodAdsTestMode,
} from '@/lib/buklodAdUnits';
import {
  flushBuklodAdOperationalTelemetry,
} from '@/lib/buklodAdOperationalTelemetry';

type AdsContextValue = {
  ready: boolean;
  canRequestAds: boolean;
  testMode: boolean;
  refreshConsent: () => Promise<void>;
};

const AdsContext =
  createContext<
    AdsContextValue | undefined
  >(undefined);

export function AdsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    ready,
    setReady,
  ] =
    useState(false);

  const [
    canRequestAds,
    setCanRequestAds,
  ] =
    useState(false);

  useEffect(
    () => {
      let mounted = true;

      // Kick off the native SDK immediately after the provider commits.
      // SDK initialization is asynchronous and never blocks the app shell.
      void initializeBuklodAds()
        .then(result => {
          if (!mounted) return;
          setReady(result.ready);
          setCanRequestAds(result.canRequestAds);

          // Returning users with valid previous consent need not wait for
          // UMP's refresh round-trip before their first banner request.
          if (result.consentRefreshPending) {
            void refreshBuklodAdConsent()
              .then(updated => {
                if (!mounted) return;
                setReady(updated.ready);
                setCanRequestAds(updated.canRequestAds);
              })
              .catch(error => console.warn('BUKLOD Ads consent refresh:', error));
          }
        })
        .catch(error => console.warn('BUKLOD Ads bootstrap:', error));

      return () => {
        mounted = false;
      };
    },
    []
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active' && !ready) {
          void initializeBuklodAds()
            .then(result => {
              setReady(result.ready);
              setCanRequestAds(result.canRequestAds);
            })
            .catch(error => console.warn('BUKLOD Ads resume:', error));
        }
        if (
          nextState === 'background' ||
          nextState === 'inactive'
        ) {
          void flushBuklodAdOperationalTelemetry();
        }
      },
    );

    return () => {
      subscription.remove();
      void flushBuklodAdOperationalTelemetry();
    };
  }, [ready]);

  const refreshConsent =
    async () => {

      const result =
        await refreshBuklodAdConsent();

      setReady(
        result.ready
      );

      setCanRequestAds(
        result.canRequestAds
      );
    };

  const value =
    useMemo(
      () => ({
        ready,
        canRequestAds,
        testMode:
          buklodAdsTestMode,
        refreshConsent,
      }),
      [
        ready,
        canRequestAds,
      ]
    );

  return (
    <AdsContext.Provider
      value={value}
    >
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  const context =
    useContext(
      AdsContext
    );

  if (!context) {
    throw new Error(
      'useAds must be used inside AdsProvider.'
    );
  }

  return context;
}