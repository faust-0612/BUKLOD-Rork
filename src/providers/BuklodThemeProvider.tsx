import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useColorScheme,
} from 'react-native';

import {
  BUKLOD_GLOBAL_PREFERENCE_OPTIONS,
  BUKLOD_GLOBAL_THEME_STORAGE_KEY,
  DEFAULT_BUKLOD_THEME_PREFERENCE,
  LEGACY_BUKLOD_THEME_PREFERENCE_KEY,
  LEGACY_CONNECT_THEME_STORAGE_KEY,
  getBuklodGlobalTheme,
  isBuklodThemePreferenceId,
  type BuklodGlobalPreferenceOption,
  type BuklodPaletteId,
  type BuklodThemePreferenceId,
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';

type BuklodThemeContextValue = {
  preference: BuklodThemePreferenceId;
  paletteId: BuklodPaletteId;
  theme: BuklodThemeRoles;
  ready: boolean;
  setPreference: (
    preference: BuklodThemePreferenceId
  ) => void;
  options: BuklodGlobalPreferenceOption[];
};

const BuklodThemeContext =
  createContext<BuklodThemeContextValue | null>(
    null
  );

async function loadStoredGlobalPreference(): Promise<BuklodThemePreferenceId> {
  try {
    const [
      storedGlobal,
      storedLegacyPref,
      storedLegacyConnect,
    ] = await Promise.all([
      AsyncStorage.getItem(
        BUKLOD_GLOBAL_THEME_STORAGE_KEY
      ),
      AsyncStorage.getItem(
        LEGACY_BUKLOD_THEME_PREFERENCE_KEY
      ),
      AsyncStorage.getItem(
        LEGACY_CONNECT_THEME_STORAGE_KEY
      ),
    ]);

    if (isBuklodThemePreferenceId(storedGlobal)) {
      return storedGlobal;
    }

    if (isBuklodThemePreferenceId(storedLegacyPref)) {
      return storedLegacyPref;
    }

    // Legacy messages-only key becomes global default if nothing else stored
    if (
      storedLegacyConnect &&
      storedLegacyConnect !== 'followGlobal' &&
      isBuklodThemePreferenceId(storedLegacyConnect)
    ) {
      return storedLegacyConnect;
    }
  }
  catch {
    /* session default */
  }

  return DEFAULT_BUKLOD_THEME_PREFERENCE;
}

export function BuklodThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const colorScheme = useColorScheme();
  const [
    preference,
    setPreferenceState,
  ] = useState<BuklodThemePreferenceId>(
    DEFAULT_BUKLOD_THEME_PREFERENCE
  );
  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored =
        await loadStoredGlobalPreference();

      if (active) {
        setPreferenceState(stored);
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(
    (next: BuklodThemePreferenceId) => {
      setPreferenceState(next);

      void AsyncStorage.setItem(
        BUKLOD_GLOBAL_THEME_STORAGE_KEY,
        next
      ).catch(() => {
        /* session selection still applies */
      });
    },
    []
  );

  const resolved = useMemo(
    () =>
      getBuklodGlobalTheme(
        preference,
        colorScheme
      ),
    [preference, colorScheme]
  );

  const value = useMemo(
    () => ({
      preference,
      paletteId: resolved.paletteId,
      theme: resolved.roles,
      ready,
      setPreference,
      options: BUKLOD_GLOBAL_PREFERENCE_OPTIONS,
    }),
    [
      preference,
      resolved.paletteId,
      resolved.roles,
      ready,
      setPreference,
    ]
  );

  return (
    <BuklodThemeContext.Provider
      value={value}
    >
      {children}
    </BuklodThemeContext.Provider>
  );
}

export function useBuklodTheme() {
  const ctx = useContext(BuklodThemeContext);

  if (!ctx) {
    const fallback = getBuklodGlobalTheme(
      DEFAULT_BUKLOD_THEME_PREFERENCE
    );

    return {
      preference: DEFAULT_BUKLOD_THEME_PREFERENCE,
      paletteId: fallback.paletteId,
      theme: fallback.roles,
      ready: true,
      setPreference: () => {},
      options: BUKLOD_GLOBAL_PREFERENCE_OPTIONS,
    };
  }

  return ctx;
}
