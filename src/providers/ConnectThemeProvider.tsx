import AsyncStorage from '@react-native-async-storage/async-storage';
import {canUserSelectTheme,getLockedSeasonMessagesTheme} from '@/features/season2/genesis/seasonThemeAuthority';
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
  LEGACY_CONNECT_THEME_STORAGE_KEY,
} from '@/lib/buklodTheme';
import {
  BUKLOD_MESSAGES_THEME_STORAGE_KEY,
  DEFAULT_MESSAGES_THEME_PREFERENCE,
  MESSAGES_PREFERENCE_OPTIONS,
  resolveMessagesTheme,
  isMessagesThemePreferenceId,
  type MessagesPaletteId,
  type MessagesPreferenceOption,
  type MessagesThemePreferenceId,
  type MessagesThemeRoles,
} from '@/lib/messagesTheme';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

type ConnectThemeContextValue = {
  /** Messages layer preference (followGlobal or override). */
  messagesPreference: MessagesThemePreferenceId;
  /** Effective palette after precedence resolution. */
  effectivePaletteId: MessagesPaletteId;
  /** Whether Messages is following global theme. */
  followingGlobal: boolean;
  /** Resolved Messages theme roles. */
  theme: MessagesThemeRoles;
  ready: boolean;
  setMessagesPreference: (
    preference: MessagesThemePreferenceId
  ) => void;
  options: MessagesPreferenceOption[];
  /** @deprecated Use messagesPreference */
  themeId: MessagesThemePreferenceId;
  /** @deprecated Use setMessagesPreference */
  setThemeId: (
    preference: MessagesThemePreferenceId
  ) => void;
  /** @deprecated Use options */
  presets: MessagesPreferenceOption[];
};

const ConnectThemeContext =
  createContext<ConnectThemeContextValue | null>(
    null
  );

async function loadStoredMessagesPreference(): Promise<MessagesThemePreferenceId> {
  try {
    const [
      storedMessages,
      storedLegacyConnect,
    ] = await Promise.all([
      AsyncStorage.getItem(
        BUKLOD_MESSAGES_THEME_STORAGE_KEY
      ),
      AsyncStorage.getItem(
        LEGACY_CONNECT_THEME_STORAGE_KEY
      ),
    ]);

    if (
      isMessagesThemePreferenceId(storedMessages)
    ) {
      return storedMessages;
    }

    // Legacy key: treat as messages override (user had chosen a palette)
    if (
      storedLegacyConnect &&
      isMessagesThemePreferenceId(storedLegacyConnect)
    ) {
      return storedLegacyConnect;
    }

    // If legacy was a palette id directly
    if (
      storedLegacyConnect &&
      storedLegacyConnect !== 'followGlobal' &&
      isMessagesThemePreferenceId(storedLegacyConnect)
    ) {
      return storedLegacyConnect;
    }
  }
  catch {
    /* session default */
  }

  return DEFAULT_MESSAGES_THEME_PREFERENCE;
}

export function ConnectThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const colorScheme = useColorScheme();
  const seasonLocked = !canUserSelectTheme();
  const { preference: globalPreference } =
    useBuklodTheme();
  const [
    messagesPreference,
    setMessagesPreferenceState,
  ] = useState<MessagesThemePreferenceId>(
    DEFAULT_MESSAGES_THEME_PREFERENCE
  );
  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored =
        await loadStoredMessagesPreference();

      if (active) {
        setMessagesPreferenceState(stored);
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setMessagesPreference = useCallback(
    (next: MessagesThemePreferenceId) => {
      if (seasonLocked) return;
      setMessagesPreferenceState(next);

      void AsyncStorage.setItem(
        BUKLOD_MESSAGES_THEME_STORAGE_KEY,
        next
      ).catch(() => {
        /* session selection still applies */
      });
    },
    [seasonLocked]
  );

  const resolved = useMemo(
    () => seasonLocked
      ? {
          messagesPreference: 'followGlobal' as const,
          effectivePaletteId: 'nightPine' as const,
          followingGlobal: true,
          roles: getLockedSeasonMessagesTheme(),
        }
      : resolveMessagesTheme(
          messagesPreference,
          globalPreference,
          colorScheme
        ),
    [messagesPreference, globalPreference, colorScheme, seasonLocked]
  );

  const value = useMemo(
    () => ({
      messagesPreference: seasonLocked ? 'followGlobal' as const : messagesPreference,
      effectivePaletteId:
        resolved.effectivePaletteId,
      followingGlobal:
        resolved.followingGlobal,
      theme: resolved.roles,
      ready,
      setMessagesPreference,
      options: seasonLocked ? [] : MESSAGES_PREFERENCE_OPTIONS,
      themeId: seasonLocked ? 'followGlobal' as const : messagesPreference,
      setThemeId: setMessagesPreference,
      presets: seasonLocked ? [] : MESSAGES_PREFERENCE_OPTIONS,
    }),
    [
      messagesPreference,
      resolved.effectivePaletteId,
      resolved.followingGlobal,
      resolved.roles,
      ready,
      setMessagesPreference,
      seasonLocked,
    ]
  );

  return (
    <ConnectThemeContext.Provider
      value={value}
    >
      {children}
    </ConnectThemeContext.Provider>
  );
}

export function useConnectTheme() {
  const ctx = useContext(ConnectThemeContext);
  const { preference: globalPreference } =
    useBuklodTheme();
  const colorScheme = useColorScheme();

  if (!ctx) {
    const seasonLocked = !canUserSelectTheme();
    const fallback = seasonLocked
      ? {
          effectivePaletteId: 'nightPine' as const,
          roles: getLockedSeasonMessagesTheme(),
        }
      : resolveMessagesTheme(
          DEFAULT_MESSAGES_THEME_PREFERENCE,
          globalPreference,
          colorScheme
        );

    return {
      messagesPreference:
        DEFAULT_MESSAGES_THEME_PREFERENCE,
      effectivePaletteId:
        fallback.effectivePaletteId,
      followingGlobal: true,
      theme: fallback.roles,
      ready: true,
      setMessagesPreference: () => {},
      options: seasonLocked ? [] : MESSAGES_PREFERENCE_OPTIONS,
      themeId: DEFAULT_MESSAGES_THEME_PREFERENCE,
      setThemeId: () => {},
      presets: seasonLocked ? [] : MESSAGES_PREFERENCE_OPTIONS,
    };
  }

  return ctx;
}
