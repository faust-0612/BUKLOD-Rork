import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';

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
  const refreshConsent =
    async (): Promise<void> => {
      // Native Google Mobile Ads / UMP is not used on web.
    };

  const value =
    useMemo(
      () => ({
        ready: true,
        canRequestAds: false,
        testMode: false,
        refreshConsent,
      }),
      []
    );

  return (
    <AdsContext.Provider value={value}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  const context =
    useContext(AdsContext);

  if (!context) {
    throw new Error(
      'useAds must be used inside AdsProvider.'
    );
  }

  return context;
}
