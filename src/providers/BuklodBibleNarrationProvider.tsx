import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  BIBLE_NARRATION_STORAGE_KEY,
  DEFAULT_SFX_VOLUME,
  DEFAULT_VOICE_VOLUME,
  type BibleNarrationMode,
} from '@/lib/buklodBibleNarration';
import {
  bibleNarrationEngine,
  type BibleNarrationPlayInput,
  type BibleNarrationSnapshot,
} from '@/lib/buklodBibleNarrationEngine';

const KEEP_AWAKE_TAG = 'buklod-bible-narration';

type StoredSettings = {
  mode?: BibleNarrationMode;
  sfxEnabled?: boolean;
  voiceVolume?: number;
  sfxVolume?: number;
  translation?: string;
  bookNo?: number;
  bookName?: string;
  chapterNo?: number;
  verseNo?: number;
};

type BibleNarrationContextValue = {
  snapshot: BibleNarrationSnapshot;
  play: (input: BibleNarrationPlayInput) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  setMode: (mode: BibleNarrationMode) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setVoiceVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
};

const BibleNarrationContext =
  createContext<BibleNarrationContextValue | null>(null);

function parseStoredSettings(raw: string | null): StoredSettings | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSettings;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function BuklodBibleNarrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(
    bibleNarrationEngine.getSnapshot()
  );
  const restoredRef = useRef(false);

  useEffect(() => {
    return bibleNarrationEngine.subscribe(setSnapshot);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const stored = parseStoredSettings(
        await AsyncStorage.getItem(BIBLE_NARRATION_STORAGE_KEY)
      );
      if (cancelled || !stored) {
        return;
      }

      const mode: BibleNarrationMode =
        stored.mode === 'pure' ||
        stored.mode === 'expressive' ||
        stored.mode === 'dramatized'
          ? stored.mode
          : 'expressive';

      bibleNarrationEngine.applySettings({
        mode,
        sfxEnabled: stored.sfxEnabled !== false,
        voiceVolume:
          typeof stored.voiceVolume === 'number'
            ? stored.voiceVolume
            : DEFAULT_VOICE_VOLUME,
        sfxVolume:
          typeof stored.sfxVolume === 'number'
            ? stored.sfxVolume
            : DEFAULT_SFX_VOLUME,
      });

      if (Number(stored.bookNo) > 0) {
        bibleNarrationEngine.restoreIdlePosition({
          translation: stored.translation,
          bookNo: stored.bookNo,
          bookName: stored.bookName,
          chapterNo: stored.chapterNo,
          verseNo: stored.verseNo,
        });
      }

      restoredRef.current = true;
    };

    void restore().finally(() => {
      restoredRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restoredRef.current) {
      return;
    }

    const payload: StoredSettings = {
      mode: snapshot.mode,
      sfxEnabled: snapshot.sfxEnabled,
      voiceVolume: snapshot.voiceVolume,
      sfxVolume: snapshot.sfxVolume,
      translation: snapshot.translation,
      bookNo: snapshot.bookNo,
      bookName: snapshot.bookName,
      chapterNo: snapshot.chapterNo,
      verseNo: snapshot.verseNo,
    };

    const timer = setTimeout(() => {
      void AsyncStorage.setItem(
        BIBLE_NARRATION_STORAGE_KEY,
        JSON.stringify(payload)
      );
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [
    snapshot.mode,
    snapshot.sfxEnabled,
    snapshot.voiceVolume,
    snapshot.sfxVolume,
    snapshot.translation,
    snapshot.bookNo,
    snapshot.bookName,
    snapshot.chapterNo,
    snapshot.verseNo,
  ]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    if (snapshot.status !== 'playing') {
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // ignore
      }
      return;
    }

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(
      () => undefined
    );

    return () => {
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // ignore
      }
    };
  }, [snapshot.status]);

  const play = useCallback(
    (input: BibleNarrationPlayInput) =>
      bibleNarrationEngine.play(input),
    []
  );
  const pause = useCallback(
    () => bibleNarrationEngine.pause(),
    []
  );
  const resume = useCallback(
    () => bibleNarrationEngine.resume(),
    []
  );
  const stop = useCallback(
    () => bibleNarrationEngine.stop(),
    []
  );
  const setMode = useCallback(
    (mode: BibleNarrationMode) => {
      bibleNarrationEngine.setMode(mode);
    },
    []
  );
  const setSfxEnabled = useCallback(
    (enabled: boolean) => {
      bibleNarrationEngine.setSfxEnabled(enabled);
    },
    []
  );
  const setVoiceVolume = useCallback(
    (volume: number) => {
      bibleNarrationEngine.setVoiceVolume(volume);
    },
    []
  );
  const setSfxVolume = useCallback(
    (volume: number) => {
      bibleNarrationEngine.setSfxVolume(volume);
    },
    []
  );

  const value = useMemo(
    () => ({
      snapshot,
      play,
      pause,
      resume,
      stop,
      setMode,
      setSfxEnabled,
      setVoiceVolume,
      setSfxVolume,
    }),
    [
      snapshot,
      play,
      pause,
      resume,
      stop,
      setMode,
      setSfxEnabled,
      setVoiceVolume,
      setSfxVolume,
    ]
  );

  return (
    <BibleNarrationContext.Provider value={value}>
      {children}
    </BibleNarrationContext.Provider>
  );
}

export function useBuklodBibleNarration() {
  const value = useContext(BibleNarrationContext);
  if (!value) {
    throw new Error(
      'useBuklodBibleNarration must be used within BuklodBibleNarrationProvider'
    );
  }
  return value;
}
