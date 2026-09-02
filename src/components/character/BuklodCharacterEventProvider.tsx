import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as Speech from 'expo-speech';

import { useAuth } from '@/providers/AuthProvider';
import {
  type ActiveCharacterPresentation,
  type CharacterEventPayload,
  type CharacterReactionsMode,
  CharacterEventType,
  canShowDialogue,
  canSpeakEquip,
  compareEventPriority,
  greetingShownInMemory,
  isGreetingEvent,
  loadCharacterReactionsMode,
  loadCharacterVoiceEnabled,
  loadGreetingSessionMarker,
  markDialogueShown,
  markEquipSpoken,
  markGreetingSession,
  reactionDurationMs,
  resolvePresentation,
  safeDisplayName,
  saveCharacterReactionsMode,
  saveCharacterVoiceEnabled,
  speakCharacterLine,
} from '@/lib/buklodCharacterEvents';

type CharacterEventContextValue = {
  presentation: ActiveCharacterPresentation;
  emit: (event: CharacterEventPayload) => void;
  emitCharacterEvent: (event: CharacterEventPayload) => void;
  dismissDialogue: () => void;
  setPointPresent: (active: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  reactionsMode: CharacterReactionsMode;
  setReactionsMode: (mode: CharacterReactionsMode) => void;
};

const IDLE_PRESENTATION: ActiveCharacterPresentation = {
  pose: 'IDLE',
  reactionId: 'neutral',
  reactionKey: 0,
  dialogue: null,
  celebrating: false,
  pointPresent: false,
  talking: false,
};

const CharacterEventContext =
  createContext<CharacterEventContextValue | null>(null);

function sessionMarker(userId?: string | null) {
  const day = new Date().toISOString().slice(0, 10);
  return `${userId ?? 'anon'}:${day}`;
}

export function BuklodCharacterEventProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;
  const displayName =
    profile?.first_name ?? profile?.full_name ?? null;

  const [presentation, setPresentation] =
    useState<ActiveCharacterPresentation>(IDLE_PRESENTATION);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [reactionsMode, setReactionsModeState] =
    useState<CharacterReactionsMode>('full');

  const queueRef = useRef<CharacterEventPayload[]>([]);
  const processingRef = useRef(false);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pointPresentRef = useRef(false);

  useEffect(() => {
    void loadCharacterVoiceEnabled().then(setVoiceEnabledState);
    void loadCharacterReactionsMode().then(setReactionsModeState);
  }, []);

  const clearReactionTimer = useCallback(() => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = null;
    }
  }, []);

  const returnToIdle = useCallback(() => {
    setPresentation((prev) => ({
      ...prev,
      pose: 'IDLE',
      reactionId: 'neutral',
      reactionKey: Date.now(),
      celebrating: false,
      dialogue: null,
      talking: false,
      pointPresent: pointPresentRef.current,
    }));
  }, []);

  const applyPresentation = useCallback(
    (next: ActiveCharacterPresentation) => {
      clearReactionTimer();
      setPresentation({
        ...next,
        pointPresent: pointPresentRef.current,
      });

      if (next.reactionId !== 'neutral') {
        const duration = reactionDurationMs(next.pose, next.reactionId);
        reactionTimerRef.current = setTimeout(returnToIdle, duration + 80);
      }
    },
    [clearReactionTimer, returnToIdle]
  );

  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const run = async () => {
      while (queueRef.current.length > 0) {
        queueRef.current.sort(compareEventPriority);
        const event = queueRef.current.shift();
        if (!event) break;

        if (event.type === CharacterEventType.IDLE) {
          returnToIdle();
          continue;
        }

        if (isGreetingEvent(event.type)) {
          const marker = sessionMarker(userId);
          const stored = await loadGreetingSessionMarker();
          if (greetingShownInMemory() || stored === marker) {
            continue;
          }
          await markGreetingSession(marker);
        }

        const resolved = resolvePresentation(
          event,
          displayName,
          reactionsMode
        );
        if (!resolved) continue;

        const dialogueAllowed =
          !resolved.dialogue || canShowDialogue();
        const spoken =
          event.spokenText ??
          (dialogueAllowed ? resolved.dialogue : null);

        if (resolved.dialogue && dialogueAllowed) {
          markDialogueShown();
        }

        const shouldSpeak =
          voiceEnabled &&
          !!spoken &&
          (event.type !== CharacterEventType.ITEM_EQUIPPED ||
            canSpeakEquip());

        if (event.type === CharacterEventType.ITEM_EQUIPPED && shouldSpeak) {
          markEquipSpoken();
        }

        applyPresentation(resolved);

        if (shouldSpeak && spoken) {
          speakCharacterLine(spoken, voiceEnabled);
        }

        const waitMs = reactionDurationMs(
          resolved.pose,
          resolved.reactionId
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      processingRef.current = false;
    };

    void run();
  }, [
    applyPresentation,
    displayName,
    reactionsMode,
    returnToIdle,
    userId,
    voiceEnabled,
  ]);

  const emitInternal = useCallback(
    (event: CharacterEventPayload) => {
      if (event.success === false) return;
      queueRef.current.push(event);
      processQueue();
    },
    [processQueue]
  );

  const emit = useCallback(
    (event: CharacterEventPayload) => {
      emitInternal(event);
    },
    [emitInternal]
  );

  const emitCharacterEvent = emit;

  const dismissDialogue = useCallback(() => {
    setPresentation((prev) => ({
      ...prev,
      dialogue: null,
      talking: false,
    }));
  }, []);

  const setPointPresent = useCallback((active: boolean) => {
    pointPresentRef.current = active;
    setPresentation((prev) => ({ ...prev, pointPresent: active }));
  }, []);

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled);
    void saveCharacterVoiceEnabled(enabled);
    if (!enabled) {
      try {
        Speech.stop();
      } catch {
        /* noop */
      }
    }
  }, []);

  const setReactionsMode = useCallback((mode: CharacterReactionsMode) => {
    setReactionsModeState(mode);
    void saveCharacterReactionsMode(mode);
  }, []);

  const value = useMemo<CharacterEventContextValue>(
    () => ({
      presentation,
      emit,
      emitCharacterEvent,
      dismissDialogue,
      setPointPresent,
      voiceEnabled,
      setVoiceEnabled,
      reactionsMode,
      setReactionsMode,
    }),
    [
      dismissDialogue,
      emit,
      emitCharacterEvent,
      presentation,
      reactionsMode,
      setPointPresent,
      setReactionsMode,
      setVoiceEnabled,
      voiceEnabled,
    ]
  );

  return (
    <CharacterEventContext.Provider value={value}>
      {children}
    </CharacterEventContext.Provider>
  );
}

export function useBuklodCharacterEvents() {
  const ctx = useContext(CharacterEventContext);
  if (!ctx) {
    throw new Error(
      'useBuklodCharacterEvents must be used within BuklodCharacterEventProvider'
    );
  }
  return ctx;
}

/** Safe hook for screens that may render outside the provider. */
export function useBuklodCharacterEventsOptional() {
  return useContext(CharacterEventContext);
}

export function useCharacterDisplayName() {
  const { profile } = useAuth();
  return safeDisplayName(profile?.first_name ?? profile?.full_name);
}
