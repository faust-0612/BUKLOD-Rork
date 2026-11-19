import {canUserSelectTheme,GENESIS_GLOBAL_ROLES} from '@/features/season2/genesis/seasonThemeAuthority';
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
    () => {
      const base = resolveMessagesTheme(seasonLocked ? 'followGlobal' : messagesPreference, globalPreference, colorScheme);
      if (!seasonLocked) return base;
      // A seasonal social palette with no old green/white Messages override.
      return {
        ...base,
        followingGlobal: true,
        effectivePaletteId: 'nightPine' as const,
        roles: {
          ...base.roles, ...GENESIS_GLOBAL_ROLES,
          bubbleSent: '#1C5268', bubbleReceived: '#1A294A',
          textOnAccent: '#081625', textOnSentBubble: '#F8FAFF',
          accentMuted: '#244B66', composerSurface: '#142440',
          borderSubtle: '#354A6D', unreadBadgeText: '#081625',
          reactionSurface: '#203450', reactionStamp: '#203450',
          callControlSurface: '#1A3654', fabBg: '#65D8CC',
          fabText: '#081625', fabIconBackdrop: 'rgba(2,8,25,.2)',
          filterPillActive: '#1D4860', filterPillActiveText: '#FFE5B4',
          tabActive: '#1D4860', sentIndicator: '#8EE0C8',
          fileChipOwn: 'rgba(255,255,255,.12)', fileChipOther: '#243A57',
          noteSurface: '#1A294A', attachPopover: '#142440',
          pickerSheet: '#142440', pickerTabTrack: '#1A294A',
          pickerTabActive: '#244B66',
        },
      };
    },
    [messagesPreference,globalPreference,colorScheme,seasonLocked]
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
    const fallback = resolveMessagesTheme(
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
      options: MESSAGES_PREFERENCE_OPTIONS,
      themeId: DEFAULT_MESSAGES_THEME_PREFERENCE,
      setThemeId: () => {},
      presets: MESSAGES_PREFERENCE_OPTIONS,
    };
  }

  return ctx;
}
