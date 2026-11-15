/**
 * Optional on-device commentary translation. The public-domain English source
 * remains authoritative; a machine translation is never attributed to Henry.
 * No network translation service, credentials, or paid API.
 */
import { useEffect, useState } from 'react';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { getSupportedTranslationLanguages, translateText } from '@/lib/nativeTranslation';

type TranslationState = {
  key: string;
  status: 'loading' | 'translated' | 'unavailable';
  text: string;
};

export function normalizeHenryLanguage(languageCode: string | null | undefined, translation: string): string {
  const source = (languageCode || (translation === 'ASD' ? 'fil' : 'en')).trim().toLowerCase();
  const code = source.split(/[-_]/)[0];
  // Bible translation metadata may use ISO-639-3 rather than the ML Kit
  // BCP-47 language tags. Never attempt to download an "eng" model.
  const aliases: Record<string, string> = {
    fil: 'tl', tgl: 'tl', eng: 'en', spa: 'es', fra: 'fr',
    deu: 'de', por: 'pt', ita: 'it', ind: 'id', hin: 'hi',
  };
  return aliases[code] ?? (/^[a-z]{2}$/.test(code) ? code : 'en');
}

export function splitHenryTranslation(text: string, maxLength = 1600): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > maxLength) {
    let end = rest.lastIndexOf('. ', maxLength);
    if (end < Math.floor(maxLength / 2)) end = rest.lastIndexOf(' ', maxLength);
    if (end < Math.floor(maxLength / 2)) end = maxLength;
    else if (rest.slice(end, end + 2) === '. ') end++;
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function textFingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return text.length + '-' + (hash >>> 0).toString(16);
}

export function useMatthewHenryTranslation(input: {
  enabled: boolean;
  accountId: string;
  bookNo: number;
  chapterNo: number;
  startVerse: number;
  endVerse: number;
  text: string;
  targetLanguage: string;
}): TranslationState {
  const { enabled, accountId, bookNo, chapterNo, startVerse, endVerse, text, targetLanguage } = input;
  const key = `henry-translation-v1:${bookNo}:${chapterNo}:${startVerse}-${endVerse}:${targetLanguage}:${textFingerprint(text)}`;
  const [state, setState] = useState<TranslationState>({ key: '', status: 'unavailable', text: '' });
  useEffect(() => {
    if (!enabled || !accountId || !text || targetLanguage === 'en') {
      setState({ key: '', status: 'unavailable', text: '' });
      return;
    }
    let active = true;
    setState({ key, status: 'loading', text: '' });
    void (async () => {
      try {
        const saved = await getOfflineCache<{text: string}>(key, { userId: accountId, allowStale: true });
        if (!active) return;
        if (saved?.data?.text) {
          setState({ key, status: 'translated', text: saved.data.text });
          return;
        }
        // requireOptionalNativeModule fails safely on web or on older APKs.
        if (!getSupportedTranslationLanguages().includes(targetLanguage)) {
          throw new Error('Unsupported on-device commentary language');
        }
        const translated: string[] = [];
        for (const part of splitHenryTranslation(text)) {
          if (!active) return;
          // Wi-Fi only for first-time model downloads; installed models work offline.
          translated.push(await translateText(part, 'en', targetLanguage, true));
        }
        if (!active) return;
        const output = translated.join(' ').trim();
        if (!output) throw new Error('No translation produced');
        setState({ key, status: 'translated', text: output });
        void setOfflineCache(key, {text: output}, {
          userId: accountId, ttlMs: 90 * 24 * 60 * 60 * 1000,
        }).catch(() => undefined);
      } catch {
        if (active) setState({ key, status: 'unavailable', text: '' });
      }
    })();
    return () => { active = false; };
  }, [enabled, accountId, key, text, targetLanguage]);
  return state.key === key ? state : { key, status: 'loading', text: '' };
}
