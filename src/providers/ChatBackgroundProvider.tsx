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
  CHAT_BACKGROUND_GLOBAL_STORAGE_KEY,
  CHAT_BACKGROUND_THREADS_STORAGE_KEY,
  DEFAULT_CHAT_BACKGROUND,
  isChatBackgroundConfig,
  normalizeChatBackgroundConfig,
  resolveEffectiveChatBackground,
  type ChatBackgroundConfig,
  type ChatBackgroundScope,
} from '@/lib/chatBackground';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';

type ThreadBackgroundMap = Record<
  string,
  ChatBackgroundConfig
>;

type ChatBackgroundContextValue = {
  ready: boolean;
  /** Active thread id when inside a conversation. */
  threadId?: string | null;
  globalBackground: ChatBackgroundConfig;
  threadBackground: ChatBackgroundConfig | null;
  effectiveBackground: ChatBackgroundConfig;
  effectiveSource: 'theme' | 'global' | 'thread';
  setBackground: (
    config: ChatBackgroundConfig,
    scope: ChatBackgroundScope
  ) => void;
  resetBackground: (
    scope: ChatBackgroundScope
  ) => void;
  /** Preview without persisting (immediate UI feedback). */
  previewBackground: (
    config: ChatBackgroundConfig | null
  ) => void;
  previewConfig: ChatBackgroundConfig | null;
};

const ChatBackgroundContext =
  createContext<ChatBackgroundContextValue | null>(
    null
  );

async function loadGlobalBackground(): Promise<ChatBackgroundConfig> {
  try {
    const stored = await AsyncStorage.getItem(
      CHAT_BACKGROUND_GLOBAL_STORAGE_KEY
    );

    if (stored) {
      const parsed = JSON.parse(stored);

      if (isChatBackgroundConfig(parsed)) {
        return normalizeChatBackgroundConfig(parsed);
      }
    }
  }
  catch {
    /* session default */
  }

  return { ...DEFAULT_CHAT_BACKGROUND };
}

async function loadThreadBackgrounds(): Promise<ThreadBackgroundMap> {
  try {
    const stored = await AsyncStorage.getItem(
      CHAT_BACKGROUND_THREADS_STORAGE_KEY
    );

    if (stored) {
      const parsed = JSON.parse(stored) as Record<
        string,
        unknown
      >;

      const result: ThreadBackgroundMap = {};

      for (const [key, value] of Object.entries(parsed)) {
        if (isChatBackgroundConfig(value)) {
          result[key] =
            normalizeChatBackgroundConfig(value);
        }
      }

      return result;
    }
  }
  catch {
    /* session default */
  }

  return {};
}

export function ChatBackgroundProvider({
  children,
  threadId,
}: {
  children: React.ReactNode;
  threadId?: string | null;
}) {
  const { theme } = useConnectTheme();
  const [ready, setReady] = useState(false);
  const [
    globalBackground,
    setGlobalBackground,
  ] = useState<ChatBackgroundConfig>(
    DEFAULT_CHAT_BACKGROUND
  );
  const [
    threadBackgrounds,
    setThreadBackgrounds,
  ] = useState<ThreadBackgroundMap>({});
  const [
    previewConfig,
    setPreviewConfig,
  ] = useState<ChatBackgroundConfig | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [global, threads] = await Promise.all([
        loadGlobalBackground(),
        loadThreadBackgrounds(),
      ]);

      if (active) {
        setGlobalBackground(global);
        setThreadBackgrounds(threads);
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const threadBackground =
    threadId && threadBackgrounds[threadId]
      ? threadBackgrounds[threadId]
      : null;

  const resolved = useMemo(() => {
    const effective = resolveEffectiveChatBackground({
      themeCanvas: theme.canvas,
      globalConfig: globalBackground,
      threadConfig: threadBackground,
      threadId,
    });

    if (previewConfig) {
      return {
        config: previewConfig,
        source: 'thread' as const,
      };
    }

    return effective;
  }, [
    theme.canvas,
    globalBackground,
    threadBackground,
    threadId,
    previewConfig,
  ]);

  const persistGlobal = useCallback(
    (config: ChatBackgroundConfig) => {
      void AsyncStorage.setItem(
        CHAT_BACKGROUND_GLOBAL_STORAGE_KEY,
        JSON.stringify(config)
      ).catch(() => {
        /* session selection still applies */
      });
    },
    []
  );

  const persistThreads = useCallback(
    (map: ThreadBackgroundMap) => {
      void AsyncStorage.setItem(
        CHAT_BACKGROUND_THREADS_STORAGE_KEY,
        JSON.stringify(map)
      ).catch(() => {
        /* session selection still applies */
      });
    },
    []
  );

  const setBackground = useCallback(
    (
      config: ChatBackgroundConfig,
      scope: ChatBackgroundScope
    ) => {
      const normalized =
        normalizeChatBackgroundConfig(config);

      setPreviewConfig(null);

      if (scope === 'global') {
        setGlobalBackground(normalized);
        persistGlobal(normalized);
        return;
      }

      if (!threadId) {
        return;
      }

      setThreadBackgrounds(prev => {
        const next = {
          ...prev,
          [threadId]: normalized,
        };

        persistThreads(next);
        return next;
      });
    },
    [threadId, persistGlobal, persistThreads]
  );

  const resetBackground = useCallback(
    (scope: ChatBackgroundScope) => {
      setPreviewConfig(null);

      if (scope === 'global') {
        const reset = { ...DEFAULT_CHAT_BACKGROUND };

        setGlobalBackground(reset);
        persistGlobal(reset);
        return;
      }

      if (!threadId) {
        return;
      }

      setThreadBackgrounds(prev => {
        const next = { ...prev };

        delete next[threadId];
        persistThreads(next);
        return next;
      });
    },
    [threadId, persistGlobal, persistThreads]
  );

  const previewBackground = useCallback(
    (config: ChatBackgroundConfig | null) => {
      setPreviewConfig(
        config
          ? normalizeChatBackgroundConfig(config)
          : null
      );
    },
    []
  );

  const value = useMemo(
    () => ({
      ready,
      threadId,
      globalBackground,
      threadBackground,
      effectiveBackground: resolved.config,
      effectiveSource: resolved.source,
      setBackground,
      resetBackground,
      previewBackground,
      previewConfig,
    }),
    [
      ready,
      threadId,
      globalBackground,
      threadBackground,
      resolved.config,
      resolved.source,
      setBackground,
      resetBackground,
      previewBackground,
      previewConfig,
    ]
  );

  return (
    <ChatBackgroundContext.Provider
      value={value}
    >
      {children}
    </ChatBackgroundContext.Provider>
  );
}

export function useChatBackground() {
  const ctx = useContext(ChatBackgroundContext);

  if (!ctx) {
    return {
      ready: true,
      threadId: null,
      globalBackground: DEFAULT_CHAT_BACKGROUND,
      threadBackground: null,
      effectiveBackground: DEFAULT_CHAT_BACKGROUND,
      effectiveSource: 'theme' as const,
      setBackground: () => {},
      resetBackground: () => {},
      previewBackground: () => {},
      previewConfig: null,
    };
  }

  return ctx;
}
