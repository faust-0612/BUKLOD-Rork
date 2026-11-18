import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useContext, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { BuklodLifeLanguage } from '@/lib/buklodLifeContent';
import { detectBuklodDeviceLocale } from '@/i18n/catalog';
import { resolveBuklodLifeLanguage } from '@/lib/buklodLifeLanguage';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import { BuklodLifeLanguageContext } from '@/providers/BuklodLifeLanguageProvider';

/** The same language policy is used by all LIFE pages and its Wall preview. */
export function useBuklodLifeLanguage() {
  const scoped = useContext(BuklodLifeLanguageContext);
  const { preference } = useBuklodI18n();
  const { profile, user } = useAuth();
  const [savedChoice, setSavedChoice] = useState<BuklodLifeLanguage | null>(null);
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
  // Community Wall renders outside the LIFE route provider. Re-read the same
  // per-account setting when Wall regains focus, without network requests.
  useFocusEffect(useCallback(() => {
    if (scoped) return;
    let active = true;
    void AsyncStorage.getItem('@buklod/life-language-v1:' + (user?.id ?? 'guest'))
      .then(value => {
        if (active) setSavedChoice(value === 'fil' || value === 'en' ? value : null);
      })
      .catch(() => { if (active) setSavedChoice(null); });
    return () => { active = false; };
  }, [scoped, user?.id]));

  return scoped?.language ?? savedChoice ?? inferred;
}

export function useBuklodLifeLanguageSettings() {
  const scoped = useContext(BuklodLifeLanguageContext);
  if (!scoped) throw new Error('LIFE language settings require the LIFE route provider');
  return scoped.setLifeLanguage;
}

