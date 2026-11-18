import { useMemo } from 'react';
import { detectBuklodDeviceLocale } from '@/i18n/catalog';
import { resolveBuklodLifeLanguage } from '@/lib/buklodLifeLanguage';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';

/** The same language policy is used by all LIFE pages and its Wall preview. */
export function useBuklodLifeLanguage() {
  const { preference } = useBuklodI18n();
  const { profile } = useAuth();
  const preferredLanguage = (profile as any)?.preferred_language;
  const country = (profile as any)?.country;
  const province = (profile as any)?.province;
  return useMemo(() => resolveBuklodLifeLanguage({
    appPreference: preference,
    profileLanguage: preferredLanguage,
    deviceLanguage: detectBuklodDeviceLocale(),
    country,
    province,
  }), [preference, preferredLanguage, country, province]);
}
