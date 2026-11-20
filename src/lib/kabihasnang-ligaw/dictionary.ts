/** Kabihasnang Ligaw glossary. Original R5 entries preserved. */
import { KL_EXTRA_TERMS } from './dictionaryExtras';

export type DictionaryEntry = {
  name: string;
  kind: string;
  meaning: string;
};

const BASE_KL_DICTIONARY: readonly DictionaryEntry[] = [
  {
    name: 'Lunawen',
    kind: 'Lugar',
    meaning: 'Pamayanang nasa gilid ng malawak na lambak. Ang mga tahanan nito ay hinuhubog mula sa isang batong tumitigas kapag nasisikatan ng liwanag.',
  },
  {
    name: 'Dumalir',
    kind: 'Lugar',
    meaning: 'Lupang sinasabing may kakayahang mag-ingat ng bakas ng mga lumipas.',
  },
  {
    name: 'Sanghira',
    kind: 'Nilalang / Puno',
    meaning: 'Isang sinaunang punong may mga ugat na nagtataglay ng gumagalaw na liwanag.',
  },
  {
    name: 'Marukha',
    kind: 'Nilalang',
    meaning: 'Isang nilalang sa mga salaysay na sinasabing nanghihiram ng pamilyar na mukha.',
  },
  {
    name: 'Nalimor',
    kind: 'Pangyayari',
    meaning: 'Pangalan sa kakaibang pagkawala ng mga alaala at mga bagay.',
  },
];


/** Additional names remain references, not new manuscript/canon approvals. */
const EXTRA_KL_DICTIONARY: readonly DictionaryEntry[] = KL_EXTRA_TERMS.map(
  ([name, kind, meaning]) => ({ name, kind, meaning }),
);
export const KL_DICTIONARY: readonly DictionaryEntry[] = [
  ...BASE_KL_DICTIONARY,
  ...EXTRA_KL_DICTIONARY,
];

const DICTIONARY_BY_KEY = new Map(
  KL_DICTIONARY.map(entry => [entry.name.toLowerCase(), entry]),
);
const DICTIONARY_NAMES = KL_DICTIONARY.map(entry => entry.name)
  .sort((left, right) => right.length - left.length)
  .map(name => name.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&'));
const DICTIONARY_PATTERN = new RegExp(
  '(^|[^\\p{L}\\p{M}\\p{N}])(' + DICTIONARY_NAMES.join('|') + ')(?=$|[^\\p{L}\\p{M}\\p{N}])',
  'giu',
);

export function dictionaryByName(name: string): DictionaryEntry | null {
  return DICTIONARY_BY_KEY.get(name.toLowerCase()) ?? null;
}

export function splitDictionaryTerms(text: string): Array<{ term: string | null; text: string }> {
  const parts: Array<{ term: string | null; text: string }> = [];
  let last = 0;
  for (const match of text.matchAll(DICTIONARY_PATTERN)) {
    const term = match[2];
    const index = (match.index ?? 0) + match[1].length;
    if (index > last) parts.push({ term: null, text: text.slice(last, index) });
    parts.push({ term: dictionaryByName(term)?.name ?? term, text: term });
    last = index + term.length;
  }
  if (last < text.length) parts.push({ term: null, text: text.slice(last) });
  return parts.length ? parts : [{ term: null, text }];
}

/** Avoid revealing unreleased chapters: only show new terms occurring in readable prose. */
export function dictionaryForManuscript(readableText: string): readonly DictionaryEntry[] {
  const mentioned = new Set(splitDictionaryTerms(readableText)
    .filter(part => part.term !== null).map(part => part.term));
  return KL_DICTIONARY.filter(entry =>
    BASE_KL_DICTIONARY.includes(entry) || mentioned.has(entry.name));
}
