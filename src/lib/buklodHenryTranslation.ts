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

/**
 * Small, high-confidence idiom normalization for the EN->Filipino ML Kit model.
 * This is not a second translator: it makes archaic English expressions
 * unambiguous BEFORE automatic translation. The displayed original is unchanged.
 * Avoid broad word swaps that could alter doctrine, speaker, names, or negation.
 */
export function prepareHenryEnglishForFilipino(source: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\\btokens of God[’']s presence\\b/gi, 'signs that God is present'],
    [/\\btokens of (?:his|the divine) presence\\b/gi, 'signs of his presence'],
    [/\\bthe more we abound in God[’']s work,? the more comfort we may expect in him\\b/gi,
      'The more we devote ourselves to God’s work, the more comfort we can expect from him'],
    [/\\bSilence and retirement befriend our communion with God\\b/gi,
      'Quiet moments alone help us grow closer to God'],
    [/\\bhis senses locked up\\b/gi, 'his senses at rest while he slept'],
    [/\\bGod[’']s access to his mind might be the more free and immediate\\b/gi,
      'God could communicate with his mind more directly'],
  ];
  return rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), source);
}

/**
 * Conservative contextual Filipino fixes for recurring literal ML Kit output.
 * No open-ended paraphrasing, new Scripture, changed pronouns or verse numbers.
 * Only specific unambiguous phrases are altered; other output stays intact.
 */
export function polishHenryFilipinoTranslation(translated: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\\bmga token ng presensya ng Diyos\\b/gi, 'mga tanda ng presensya ng Diyos'],
    [/\\btoken ng presensya ng Diyos\\b/gi, 'tanda ng presensya ng Diyos'],
    [/\\bpanuntunan sa ating pagsamba\\b/gi, 'tamang paraan ng pagsamba'],
    [/\\bmapagbigay na sakripisyo\\b/gi, 'masaganang handog'],
    [/\\bkatahimikan at pagreretiro\\b/gi, 'katahimikan at pag-iisa'],
    [/\\bang (?:kanyang|kaniyang) mga pandama ay naka-lock\\b/gi,
      'hindi niya namamalayan ang paligid habang natutulog'],
    [/\\bpag-access ng Diyos sa (?:kanyang|kaniyang) isip\\b/gi,
      'pakikipag-ugnayan ng Diyos sa kanyang isip'],
  ];
  const output = rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), translated);
  return output.replace(/\\s+([,;:.!?])/g, '$1').replace(/[ \\t]{2,}/g, ' ').trim();
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
  const key = `henry-translation-v2:${bookNo}:${chapterNo}:${startVerse}-${endVerse}:${targetLanguage}:${textFingerprint(text)}`;
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
        // Keep a few complete sentences per ML Kit request: more context than
        // isolated words, but not one very long archaic passage. Original English
        // is still the source of truth and remains available in the reader.
        const inputText = targetLanguage === 'tl' ? prepareHenryEnglishForFilipino(text) : text;
        for (const part of splitHenryTranslation(inputText, targetLanguage === 'tl' ? 700 : 1600)) {
          if (!active) return;
          // Wi-Fi only for first-time model downloads; installed models work offline.
          translated.push(await translateText(part, 'en', targetLanguage, true));
        }
        if (!active) return;
        const rawOutput = translated.join(' ').trim();
        const output = targetLanguage === 'tl' ? polishHenryFilipinoTranslation(rawOutput) : rawOutput;
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
