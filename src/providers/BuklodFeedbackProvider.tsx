import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuklodFeedbackBanner } from '@/components/BuklodFeedbackBanner';
import type { BuklodUserFeedback } from '@/lib/buklodUserFeedback';

type ShowOptions = {
  autoHideMs?: number | null;
  helpParams?: Record<string, string | null | undefined>;
};

type FeedbackState = {
  feedback: BuklodUserFeedback;
  helpParams?: ShowOptions['helpParams'];
};

type BuklodFeedbackContextValue = {
  showFeedback: (
    feedback: BuklodUserFeedback,
    options?: ShowOptions,
  ) => void;
  clearFeedback: () => void;
};

const BuklodFeedbackContext =
  createContext<BuklodFeedbackContextValue | null>(null);

export function BuklodFeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] =
    useState<FeedbackState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrent(null);
  }, []);

  const showFeedback = useCallback(
    (
      feedback: BuklodUserFeedback,
      options: ShowOptions = {},
    ) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setCurrent({
        feedback,
        helpParams: options.helpParams,
      });

      const autoHideMs =
        options.autoHideMs ??
        (feedback.tone === 'success' ? 4200 : null);

      if (autoHideMs && autoHideMs > 0) {
        timerRef.current = setTimeout(() => {
          setCurrent(null);
          timerRef.current = null;
        }, autoHideMs);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      showFeedback,
      clearFeedback,
    }),
    [clearFeedback, showFeedback],
  );

  const openHelp = useCallback(() => {
    if (!current) return;
    const params = Object.fromEntries(
      Object.entries({
        category: 'TECHNICAL',
        errorCode: current.feedback.supportCode ?? undefined,
        message: current.feedback.message,
        ...current.helpParams,
      }).filter(([, value]) => value != null && String(value).trim()),
    );

    router.push({
      pathname: '/help' as any,
      params: params as any,
    });
    clearFeedback();
  }, [clearFeedback, current]);

  return (
    <BuklodFeedbackContext.Provider value={value}>
      {children}
      {!!current && (
        <View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            { top: Math.max(insets.top + 8, 12) },
          ]}
        >
          <View style={styles.card}>
            <BuklodFeedbackBanner
              feedback={current.feedback}
              onNeedHelp={
                current.feedback.needsSupport
                  ? openHelp
                  : null
              }
              onDismiss={clearFeedback}
              compact
            />
          </View>
        </View>
      )}
    </BuklodFeedbackContext.Provider>
  );
}

export function useBuklodFeedback() {
  const value = useContext(BuklodFeedbackContext);
  if (!value) {
    throw new Error(
      'useBuklodFeedback must be used inside BuklodFeedbackProvider',
    );
  }
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10000,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 720,
  },
});
