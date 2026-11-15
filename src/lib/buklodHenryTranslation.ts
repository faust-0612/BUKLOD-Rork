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
    [/\btokens of God[’']s presence\b/gi, 'signs that God is present'],
    [/\btokens of (?:his|the divine) presence\b/gi, 'signs of his presence'],
    [/\bthe more we abound in God[’']s work,? the more comfort we may expect in him\b/gi,
      'The more we devote ourselves to God’s work, the more comfort we can expect from him'],
    [/\bSilence and retirement befriend our communion with God\b/gi,
      'Quiet moments alone help us grow closer to God'],
    [/\bhis senses locked up\b/gi, 'his senses at rest while he slept'],
    [/\bGod[’']s access to his mind might be the more free and immediate\b/gi,
      'God could communicate with his mind more directly'],
    [/\bHere we are told (?:concerning|about) Solomon\b/gi, 'We learn about Solomon'],
    [/\bfor which he is to be praised and wherein he is to be imitated\b/gi,
      'for which he deserves praise, and others should follow his example'],
    [/\bthe particular hint is taken from God[’']s love to him\b/gi,
      'This detail comes from God’s love for him'],
    [/\bhe walked in the statutes of David his father\b/gi,
      'He followed the practices of his father David'],
    [/\bwherein\b/gi, 'in which'],
    [/\btherein\b/gi, 'in it'],
    [/\bwhereby\b/gi, 'by which'],
    [/\bencomium\b/gi, 'high praise'],
    [/\bordinances\b/gi, 'instructions'],
    [/\bhath\b/gi, 'has'],
    [/\bdoth\b/gi, 'does'],
  ];
  return rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), source);
}


/**
 * A Bible reference is a citation, not translatable prose. Canonicalize
 * known reference abbreviations before ML Kit and again after translation;
 * never guess when the book code is unknown or a chapter is ambiguous.
 */
const HENRY_REFERENCE_BOOKS: Array<[string, string, string]> = [
  ['gen','Genesis','Genesis'],['exo','Exodus','Exodo'],['lev','Leviticus','Levitico'],
  ['num','Numbers','Bilang'],['deu','Deuteronomy','Deuteronomio'],
  ['jos','Joshua','Josue'],['jdg','Judges','Mga Hukom'],['rut','Ruth','Ruth'],
  ['1sa','1 Samuel','1 Samuel'],['2sa','2 Samuel','2 Samuel'],
  ['1ki','1 Kings','1 Hari'],['2ki','2 Kings','2 Hari'],
  ['1ch','1 Chronicles','1 Cronica'],['2ch','2 Chronicles','2 Cronica'],
  ['ezr','Ezra','Ezra'],['neh','Nehemiah','Nehemias'],['est','Esther','Esther'],
  ['job','Job','Job'],['psa','Psalms','Mga Awit'],['pro','Proverbs','Kawikaan'],
  ['ecc','Ecclesiastes','Mangangaral'],['sng','Song of Solomon','Awit ni Solomon'],
  ['isa','Isaiah','Isaias'],['jer','Jeremiah','Jeremias'],['lam','Lamentations','Mga Panaghoy'],
  ['ezk','Ezekiel','Ezekiel'],['dan','Daniel','Daniel'],
  ['hos','Hosea','Oseas'],['jol','Joel','Joel'],['amo','Amos','Amos'],
  ['oba','Obadiah','Obadias'],['jon','Jonah','Jonas'],['mic','Micah','Mikas'],
  ['nam','Nahum','Nahum'],['hab','Habakkuk','Habakuk'],['zep','Zephaniah','Sofonias'],
  ['hag','Haggai','Hagai'],['zec','Zechariah','Zacarias'],['mal','Malachi','Malakias'],
  ['mat','Matthew','Mateo'],['mrk','Mark','Marcos'],['luk','Luke','Lucas'],
  ['jhn','John','Juan'],['act','Acts','Mga Gawa'],['rom','Romans','Roma'],
  ['1co','1 Corinthians','1 Corinto'],['2co','2 Corinthians','2 Corinto'],
  ['gal','Galatians','Galacia'],['eph','Ephesians','Efeso'],
  ['php','Philippians','Filipos'],['col','Colossians','Colosas'],
  ['1th','1 Thessalonians','1 Tesalonica'],['2th','2 Thessalonians','2 Tesalonica'],
  ['1ti','1 Timothy','1 Timoteo'],['2ti','2 Timothy','2 Timoteo'],
  ['tit','Titus','Tito'],['phm','Philemon','Filemon'],
  ['heb','Hebrews','Hebreo'],['jas','James','Santiago'],
  ['1pe','1 Peter','1 Pedro'],['2pe','2 Peter','2 Pedro'],
  ['1jn','1 John','1 Juan'],['2jn','2 John','2 Juan'],['3jn','3 John','3 Juan'],
  ['jud','Jude','Judas'],['rev','Revelation','Pahayag'],
];
const HENRY_REFERENCE_ALIASES = new Map<string, { en: string; tl: string }>();
for (const [code, en, tl] of HENRY_REFERENCE_BOOKS) {
  const item = { en, tl };
  for (const alias of [code, en.replace(/\s/g, ''), tl.replace(/\s/g, '')]) {
    HENRY_REFERENCE_ALIASES.set(alias.toLowerCase(), item);
  }
}
for (const [alias, code] of [
  ['kg1','1ki'],['kg2','2ki'],['k1','1ki'],['k2','2ki'],
  ['sa1','1sa'],['sa2','2sa'],['ch1','1ch'],['ch2','2ch'],
  ['1kgs','1ki'],['2kgs','2ki'],['1sam','1sa'],['2sam','2sa'],
  ['1chr','1ch'],['2chr','2ch'],['ps','psa'],['jn','jhn'],
] as Array<[string, string]>) {
  const found = HENRY_REFERENCE_ALIASES.get(code);
  if (found) HENRY_REFERENCE_ALIASES.set(alias, found);
}

export function formatHenryBibleReferences(text: string, language: 'en' | 'tl'): string {
  return text.replace(
    /(^|[^A-Za-z0-9])((?:[1-3]\s*)?[A-Za-z]{2,14}|[A-Za-z]{2,6}[1-3])\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g,
    (whole, prefix: string, code: string, chapter: string, verse: string, through?: string) => {
      const entry = HENRY_REFERENCE_ALIASES.get(code.replace(/\s/g, '').toLowerCase());
      if (!entry) return whole;
      const c = Number(chapter), v = Number(verse);
      if (c < 1 || c > 150 || v < 1 || v > 176) return whole;
      return prefix + entry[language] + ' ' + c + ':' + v + (through ? '–' + Number(through) : '');
    },
  );
}

/** Section breaks are presentation-only. The original source stays intact. */
export function paragraphizeHenryEnglish(text: string): string[] {
  const roman: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10 };
  return text
    .replace(/,\s+(VIII|VII|VI|IV|IX|III|II|I|V|X)\.\s+(?=[A-Za-z])/g,
      (_, numeral: string) => '.\n\n' + roman[numeral] + '. ')
    .replace(/([.!?])\s+(?=[1-9]\d?\. [A-Za-z])/g, '$1\n\n')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

/**
 * Conservative contextual Filipino fixes for recurring literal ML Kit output.
 * No open-ended paraphrasing, new Scripture, changed pronouns or verse numbers.
 * Only specific unambiguous phrases are altered; other output stays intact.
 */
export function polishHenryFilipinoTranslation(translated: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\bmga token ng presensya ng Diyos\b/gi, 'mga tanda ng presensya ng Diyos'],
    [/\btoken ng presensya ng Diyos\b/gi, 'tanda ng presensya ng Diyos'],
    [/\bpanuntunan sa ating pagsamba\b/gi, 'tamang paraan ng pagsamba'],
    [/\bmapagbigay na sakripisyo\b/gi, 'masaganang handog'],
    [/\bkatahimikan at pagreretiro\b/gi, 'katahimikan at pag-iisa'],
    [/\bang (?:kanyang|kaniyang) mga pandama ay naka-lock\b/gi,
      'hindi niya namamalayan ang paligid habang natutulog'],
    [/\bpag-access ng Diyos sa (?:kanyang|kaniyang) isip\b/gi,
      'pakikipag-ugnayan ng Diyos sa kanyang isip'],
    [/\bpartikular na paunawa\b/gi, 'mahalagang pahiwatig'],
    [/\bpinakamaliwanag na encomium\b/gi, 'pinakamataas na papuri'],
    [/\bencomium\b/gi, 'papuri'],
    [/\bimitated\b/gi, 'tularan'],
    // Correct only verified literal mistranslations, preserving source meaning.
    [/\bmabait na pagdalaw na binayaran ng Diyos kay Solomon\b/gi, 'mapagpalang pagdalaw ng Diyos kay Solomon'],
    [/\bmabait na pagdalaw na binayaran ng Diyos\b/gi, 'mapagpalang pagdalaw ng Diyos'],
    [/\bpakikipag-isa na kasama niya sa Diyos dito\b/gi, 'pakikipag-ugnayan niya sa Diyos sa pagkakataong iyon'],
    [/\bdapat lamang ang isa\b/gi, 'dapat sana ay iyon lamang ang lugar'],
    [/\binalok ni Solomon ang (?:kanyang|kaniyang) mga dakilang sakripisyo\b/gi, 'naghandog si Solomon ng maraming hain'],
    [/\bsa Solomon\b/gi, 'kay Solomon'],
    [/\bmga ordinansa ng Diyos\b/gi, 'mga tuntunin ng Diyos'],
    [/\bsa kung ano ang ginawa niya para sa karangalan ng Diyos\b/gi,
      'sa mga ginawa niya upang parangalan ang Diyos'],
  ];
  const output = rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), translated);
  const clean = formatHenryBibleReferences(output, 'tl');
  return clean.replace(/\s+([,;:.!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
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
  const key = `henry-translation-v4:${bookNo}:${chapterNo}:${startVerse}-${endVerse}:${targetLanguage}:${textFingerprint(text)}`;
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
        // Keep cited verses as Scripture references; do not let the model
        // reinterpret abbreviated book codes as ordinary words.
        const inputText = targetLanguage === 'tl'
          ? prepareHenryEnglishForFilipino(formatHenryBibleReferences(text, 'en'))
          : text;
        const paragraphs = targetLanguage === 'tl'
          ? paragraphizeHenryEnglish(inputText) : [inputText];
        const translatedParagraphs: string[] = [];
        for (const paragraph of paragraphs) {
          const translated: string[] = [];
          for (const part of splitHenryTranslation(paragraph, targetLanguage === 'tl' ? 700 : 1600)) {
            if (!active) return;
            // Wi-Fi only for first-time model downloads; installed models work offline.
            translated.push(await translateText(part, 'en', targetLanguage, true));
          }
          translatedParagraphs.push(translated.join(' '));
        }
        if (!active) return;
        const rawOutput = translatedParagraphs.join('\n\n').trim();
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
