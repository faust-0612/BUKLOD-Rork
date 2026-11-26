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

// Canonical aliases map to the same entry, without duplicate dictionary cards.
const DICTIONARY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Maestro Calen": [
    "Calen"
  ],
  "Balat-bato": [
    "Balat-batong"
  ],
  "Gagamba ng Pisi": [
    "Gagambang Pisi"
  ],
  "Mga Hindi Nakalimot": [
    "Hindi Nakalimot"
  ],
  "Mga ilog na umaakyat": [
    "ilog na umaakyat",
    "ilog na dumadaloy paakyat",
    "mga ilog na dumadaloy paakyat",
    "mga ilog na hindi dumadaloy pababa",
    "ilog na hindi dumadaloy pababa"
  ],
  "Mapulang latak": [
    "pulang latak"
  ],
  "Katipunan ng mga Tagapag-ingat": [
    "Katipunan"
  ],
  "Pilak na hibla": [
    "pilak na hiblang"
  ],
  "Tagapag-alaga ng mga balon": [
    "tagapag-alaga ng balon"
  ]
};
const DICTIONARY_BY_KEY = new Map<string, DictionaryEntry>(
  KL_DICTIONARY.map(entry => [entry.name.toLowerCase(), entry]),
);
for (const [name, aliases] of Object.entries(DICTIONARY_ALIASES)) {
  const entry = DICTIONARY_BY_KEY.get(name.toLowerCase());
  if (!entry) continue;
  for (const alias of aliases) {
    if (!DICTIONARY_BY_KEY.has(alias.toLowerCase())) DICTIONARY_BY_KEY.set(alias.toLowerCase(), entry);
  }
}
const DICTIONARY_NAMES = Array.from(DICTIONARY_BY_KEY.keys())
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
    // Lower-case tali is a rope/tie, not the character. El is a proper name fragment.
    if (term === 'tali' || term === 'el') continue;
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
