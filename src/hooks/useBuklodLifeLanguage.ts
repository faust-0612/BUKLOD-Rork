import { useContext, useMemo } from 'react';
import { detectBuklodDeviceLocale } from '@/i18n/catalog';
import { resolveBuklodLifeLanguage } from '@/lib/buklodLifeLanguage';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import { BuklodLifeLanguageContext } from '@/providers/BuklodLifeLanguageProvider';

/** The same language policy is used by all LIFE pages and its Wall preview. */
export function useBuklodLifeLanguage() {
  const scoped = useContext(BuklodLifeLanguageContext);
  const { preference } = useBuklodI18n();
  const { profile } = useAuth();
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
  return scoped?.language ?? inferred;
}

export function useBuklodLifeLanguageSettings() {
  const scoped = useContext(BuklodLifeLanguageContext);
  if (!scoped) throw new Error('LIFE language settings require the LIFE route provider');
  return scoped.setLifeLanguage;
}

