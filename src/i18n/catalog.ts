export type BuklodLocaleCode =
  | 'en'
  | 'fil'
  | 'zh-CN'
  | 'zh-TW'
  | 'de'
  | 'ar';

export type BuklodLanguagePreference = 'device' | BuklodLocaleCode;

export type BuklodLanguageMeta = {
  code: BuklodLocaleCode;
  englishName: string;
  nativeName: string;
  intlLocale: string;
  direction: 'ltr' | 'rtl';
  packVersion: string;
  completionPercent: number;
  approved: boolean;
  productionReady: boolean;
};

export const BUKLOD_LANGUAGE_CATALOG: BuklodLanguageMeta[] = [
  {
    code: 'en',
    englishName: 'English',
    nativeName: 'English',
    intlLocale: 'en-PH',
    direction: 'ltr',
    packVersion: 'en-v1',
    completionPercent: 100,
    approved: true,
    productionReady: true,
  },
  {
    code: 'fil',
    englishName: 'Filipino',
    nativeName: 'Filipino',
    intlLocale: 'fil-PH',
    direction: 'ltr',
    packVersion: 'fil-v1',
    completionPercent: 0,
    approved: false,
    productionReady: false,
  },
  {
    code: 'zh-CN',
    englishName: 'Chinese (Simplified)',
    nativeName: '中文（简体）',
    intlLocale: 'zh-CN',
    direction: 'ltr',
    packVersion: 'zh-CN-v1',
    completionPercent: 0,
    approved: false,
    productionReady: false,
  },
  {
    code: 'zh-TW',
    englishName: 'Chinese (Traditional)',
    nativeName: '中文（繁體）',
    intlLocale: 'zh-TW',
    direction: 'ltr',
    packVersion: 'zh-TW-v1',
    completionPercent: 0,
    approved: false,
    productionReady: false,
  },
  {
    code: 'de',
    englishName: 'German',
    nativeName: 'Deutsch',
    intlLocale: 'de-DE',
    direction: 'ltr',
    packVersion: 'de-v1',
    completionPercent: 0,
    approved: false,
    productionReady: false,
  },
  {
    code: 'ar',
    englishName: 'Arabic',
    nativeName: 'العربية',
    intlLocale: 'ar-SA',
    direction: 'rtl',
    packVersion: 'ar-v1',
    completionPercent: 0,
    approved: false,
    productionReady: false,
  },
];

export const BUKLOD_PLANNED_LANGUAGE_NAMES = [
  'Spanish / Español',
  'French / Français',
  'Portuguese / Português',
  'Japanese / 日本語',
  'Korean / 한국어',
  'Hindi / हिन्दी',
  'Indonesian / Bahasa Indonesia',
  'Malay / Bahasa Melayu',
  'Vietnamese / Tiếng Việt',
  'Thai / ไทย',
  'Bengali / বাংলা',
  'Urdu / اردو',
  'Russian / Русский',
  'Italian / Italiano',
] as const;

export function buklodLanguageMeta(code: BuklodLocaleCode) {
  return (
    BUKLOD_LANGUAGE_CATALOG.find(item => item.code === code) ??
    BUKLOD_LANGUAGE_CATALOG[0]
  );
}

export function productionBuklodLanguages() {
  return BUKLOD_LANGUAGE_CATALOG.filter(
    item => item.productionReady && item.approved,
  );
}

export function normalizeBuklodLocale(value: unknown): BuklodLocaleCode | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (
    lower === 'en' ||
    lower.startsWith('en-') ||
    lower === 'english'
  ) return 'en';

  if (
    lower === 'fil' ||
    lower.startsWith('fil-') ||
    lower === 'tl' ||
    lower.startsWith('tl-') ||
    lower === 'filipino' ||
    lower === 'tagalog'
  ) return 'fil';

  if (
    lower === 'zh-cn' ||
    lower === 'zh-hans' ||
    lower.startsWith('zh-hans-') ||
    lower.includes('simplified')
  ) return 'zh-CN';

  if (
    lower === 'zh-tw' ||
    lower === 'zh-hk' ||
    lower === 'zh-hant' ||
    lower.startsWith('zh-hant-') ||
    lower.includes('traditional')
  ) return 'zh-TW';

  if (lower === 'de' || lower.startsWith('de-') || lower === 'german') {
    return 'de';
  }

  if (lower === 'ar' || lower.startsWith('ar-') || lower === 'arabic') {
    return 'ar';
  }

  return null;
}

export function detectBuklodDeviceLocale(): BuklodLocaleCode {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return normalizeBuklodLocale(locale) ?? 'en';
  } catch {
    return 'en';
  }
}

export function effectiveBuklodLocale(
  preference: BuklodLanguagePreference,
): BuklodLocaleCode {
  const desired =
    preference === 'device'
      ? detectBuklodDeviceLocale()
      : preference;
  const meta = buklodLanguageMeta(desired);
  return meta.productionReady && meta.approved ? desired : 'en';
}
