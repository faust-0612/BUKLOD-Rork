import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase';
import { enMessages } from '@/i18n/messages/en';
import {
  BUKLOD_LANGUAGE_CATALOG,
  type BuklodLanguagePreference,
  type BuklodLocaleCode,
  buklodLanguageMeta,
  effectiveBuklodLocale,
  normalizeBuklodLocale,
  productionBuklodLanguages,
} from '@/i18n/catalog';

const STORAGE_KEY = '@buklod/language-preference-v1';

type MessageTree = Record<string, unknown>;

const PACKS: Partial<Record<BuklodLocaleCode, MessageTree>> = {
  en: enMessages as unknown as MessageTree,
};

const missingKeys = new Set<string>();

function readPath(tree: MessageTree | undefined, key: string): string | null {
  if (!tree) return null;
  let current: unknown = tree;
  for (const part of key.split('.')) {
    if (
      !current ||
      typeof current !== 'object' ||
      !(part in (current as Record<string, unknown>))
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

function interpolate(
  value: string,
  vars?: Record<string, string | number>,
) {
  if (!vars) return value;
  return value.replace(/\{\{([^}]+)\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const next = vars[key];
    return next == null ? '' : String(next);
  });
}

type BuklodI18nContextValue = {
  preference: BuklodLanguagePreference;
  locale: BuklodLocaleCode;
  intlLocale: string;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
  languageName: string;
  ready: boolean;
  availableLanguages: ReturnType<typeof productionBuklodLanguages>;
  allLanguageMetadata: typeof BUKLOD_LANGUAGE_CATALOG;
  setPreference: (preference: BuklodLanguagePreference) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, maximumFractionDigits?: number) => string;
  formatPhp: (value: number) => string;
  formatDate: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
};

const BuklodI18nContext = createContext<BuklodI18nContextValue | null>(null);

export function BuklodI18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] =
    useState<BuklodLanguagePreference>('device');
  const [ready, setReady] = useState(false);
  const localPreferenceRef = useRef(false);
  const serverSyncUserRef = useRef<string | null>(null);

  const locale = effectiveBuklodLocale(preference);
  const meta = buklodLanguageMeta(locale);

  useEffect(() => {
    let alive = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!alive) return;

        if (raw === 'device') {
          localPreferenceRef.current = true;
          setPreferenceState('device');
          return;
        }

        const normalized = normalizeBuklodLocale(raw);
        if (normalized) {
          localPreferenceRef.current = true;
          setPreferenceState(normalized);
        }
      })
      .finally(() => {
        if (alive) setReady(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  const syncFromServer = useCallback(async (userId: string) => {
    if (!userId || serverSyncUserRef.current === userId) return;
    serverSyncUserRef.current = userId;

    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (localPreferenceRef.current) return;

      const serverValue = String(data?.preferred_language ?? '').trim();

      if (serverValue === 'device') {
        setPreferenceState('device');
        await AsyncStorage.setItem(STORAGE_KEY, 'device');
        localPreferenceRef.current = true;
        return;
      }

      const normalized = normalizeBuklodLocale(serverValue);
      if (normalized) {
        setPreferenceState(normalized);
        await AsyncStorage.setItem(STORAGE_KEY, normalized);
        localPreferenceRef.current = true;
      }
    } catch (error) {
      console.warn(
        'BUKLOD language server restore:',
        error instanceof Error ? error.message : error,
      );
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!disposed && data.session?.user?.id) {
        void syncFromServer(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (!userId) {
        serverSyncUserRef.current = null;
        return;
      }
      queueMicrotask(() => {
        if (!disposed) void syncFromServer(userId);
      });
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [syncFromServer]);

  const setPreference = useCallback(
    async (next: BuklodLanguagePreference) => {
      if (next !== 'device') {
        const nextMeta = buklodLanguageMeta(next);
        if (!nextMeta.productionReady || !nextMeta.approved) {
          throw new Error(
            'This language pack is not production-ready yet.',
          );
        }
      }

      localPreferenceRef.current = true;
      setPreferenceState(next);
      await AsyncStorage.setItem(STORAGE_KEY, next);

      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return;

        const { error } = await (supabase as any)
          .from('profiles')
          .update({ preferred_language: next })
          .eq('id', userId);

        if (error) throw error;
      } catch (error) {
        console.warn(
          'BUKLOD language sync:',
          error instanceof Error ? error.message : error,
        );
      }
    },
    [],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const active =
        readPath(PACKS[locale], key) ??
        readPath(PACKS.en, key);

      if (!active) {
        if (!missingKeys.has(key)) {
          missingKeys.add(key);
          console.warn('BUKLOD missing translation key:', key);
        }
        return key;
      }

      return interpolate(active, vars);
    },
    [locale],
  );

  const value = useMemo<BuklodI18nContextValue>(() => {
    const formatNumber = (
      input: number,
      options?: Intl.NumberFormatOptions,
    ) =>
      new Intl.NumberFormat(meta.intlLocale, options).format(
        Number.isFinite(input) ? input : 0,
      );

    return {
      preference,
      locale,
      intlLocale: meta.intlLocale,
      direction: meta.direction,
      isRTL: meta.direction === 'rtl',
      languageName: meta.nativeName,
      ready,
      availableLanguages: productionBuklodLanguages(),
      allLanguageMetadata: BUKLOD_LANGUAGE_CATALOG,
      setPreference,
      t,
      formatNumber,
      formatPercent: (input: number, maximumFractionDigits = 2) =>
        new Intl.NumberFormat(meta.intlLocale, {
          style: 'percent',
          maximumFractionDigits,
        }).format(Number.isFinite(input) ? input : 0),
      formatPhp: (input: number) =>
        new Intl.NumberFormat(meta.intlLocale, {
          style: 'currency',
          currency: 'PHP',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number.isFinite(input) ? input : 0),
      formatDate: (
        input: Date | string | number,
        options?: Intl.DateTimeFormatOptions,
      ) => {
        const date = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(
          meta.intlLocale,
          options ?? {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          },
        ).format(date);
      },
    };
  }, [locale, meta.direction, meta.intlLocale, meta.nativeName, preference, ready, setPreference, t]);

  return (
    <BuklodI18nContext.Provider value={value}>
      {children}
    </BuklodI18nContext.Provider>
  );
}

export function useBuklodI18n() {
  const context = useContext(BuklodI18nContext);
  if (!context) {
    throw new Error('useBuklodI18n must be used inside BuklodI18nProvider');
  }
  return context;
}
