import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  initializeBuklodAds,
  refreshBuklodAdConsent,
} from '@/lib/adMob';

import {
  buklodAdsTestMode,
} from '@/lib/buklodAdUnits';

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

      void initializeBuklodAds()
        .then(result => {
          if (!mounted) {
            return;
          }

          setReady(
            result.ready
          );

          setCanRequestAds(
            result.canRequestAds
          );
        })
        .catch(error => {
          console.warn(
            'BUKLOD Ads bootstrap:',
            error
          );
        });

      return () => {
        mounted = false;
      };
    },
    []
  );

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