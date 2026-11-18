import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { detectBuklodDeviceLocale } from '@/i18n/catalog';
import type { BuklodLifeLanguage } from '@/lib/buklodLifeContent';
import { resolveBuklodLifeLanguage } from '@/lib/buklodLifeLanguage';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';

type LifeLanguageContextValue = {
  language: BuklodLifeLanguage;
  setLifeLanguage: (next: BuklodLifeLanguage) => Promise<void>;
};

export const BuklodLifeLanguageContext = createContext<LifeLanguageContextValue | null>(null);

/**
 * LIFE's language choice is per-account and offline. It does not activate an
 * unapproved app-wide language pack or modify any spiritual progress data.
 */
export function BuklodLifeLanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { preference, ready: appReady } = useBuklodI18n();
  const storageKey = '@buklod/life-language-v1:' + (user?.id ?? 'guest');
  const preferredLanguage = (profile as any)?.preferred_language;
  const country = (profile as any)?.country;
  const province = (profile as any)?.province;
  const inferred = useMemo(() => resolveBuklodLifeLanguage({
    appPreference: preference,
    profileLanguage: preferredLanguage,
    deviceLanguage: detectBuklodDeviceLocale(),
    country,
    province,
  }), [preference, preferredLanguage, country, province]);

  const [chosen, setChosen] = useState<BuklodLifeLanguage | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    setLoadedKey(null);
    setChosen(null);
    void AsyncStorage.getItem(storageKey)
      .then(saved => {
        if (!active) return;
        setChosen(saved === 'fil' || saved === 'en' ? saved : null);
      })
      .catch(() => {
        if (active) setChosen(null);
      })
      .finally(() => {
        if (active) setLoadedKey(storageKey);
      });
    return () => { active = false; };
  }, [storageKey]);

  const setLifeLanguage = useCallback(async (next: BuklodLifeLanguage) => {
    if (next !== 'en' && next !== 'fil') return;
    const request = ++revision.current;
    const previous = chosen;
    setChosen(next);
    const write = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(storageKey, next));
    writeQueue.current = write;
    try {
      await write;
    } catch (error) {
      if (revision.current === request) setChosen(previous);
      throw error;
    }
  }, [chosen, storageKey]);

  const value = useMemo(() => ({
    language: chosen ?? inferred,
    setLifeLanguage,
  }), [chosen, inferred, setLifeLanguage]);

  if (!appReady || loadedKey !== storageKey) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF7' }}>
        <ActivityIndicator color="#2F6946" accessibilityLabel="Loading LIFE language" />
      </View>
    );
  }

  return (
    <BuklodLifeLanguageContext.Provider value={value}>
      {children}
    </BuklodLifeLanguageContext.Provider>
  );
}
