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
export type DictionaryPart = { term: string | null; text: string };

/** Untrusted server payload is limited to a chapter and contains no executable markup. */
export function parseKlDictionaryRows(value: unknown): DictionaryEntry[] {
  if (!Array.isArray(value)) return [];
  const output: DictionaryEntry[] = [];
  const seen = new Set<string>();
  for (const row of value.slice(0, 600)) {
    if (!row || typeof row !== 'object') continue;
    const { name, kind, meaning } = row as Record<string, unknown>;
    if (typeof name !== 'string' || typeof kind !== 'string' || typeof meaning !== 'string') continue;
    const n = name.trim(), k = kind.trim(), m = meaning.trim();
    const key = n.toLowerCase();
    if (n.length < 2 || n.length > 100 || k.length < 2 || k.length > 50 ||
        m.length < 8 || m.length > 500 || /[\r\n\u0000-\u001f]/.test(n) || seen.has(key)) continue;
    seen.add(key); output.push({ name: n, kind: k, meaning: m });
  }
  return output;
}

/** Build one matcher per chapter update, never per paragraph. Preserve bundled
 * terms offline and canonical aliases when automatic candidates collide. */
export function createKlDictionary(remote: unknown = []) {
  const byKey = new Map<string, DictionaryEntry>(
    KL_DICTIONARY.map(entry => [entry.name.toLowerCase(), entry]),
  );
  for (const [name, aliases] of Object.entries(DICTIONARY_ALIASES)) {
    const entry = byKey.get(name.toLowerCase());
    if (!entry) continue;
    for (const alias of aliases) if (!byKey.has(alias.toLowerCase())) byKey.set(alias.toLowerCase(), entry);
  }
  const entries = [...KL_DICTIONARY];
  for (const entry of parseKlDictionaryRows(remote)) {
    const key = entry.name.toLowerCase();
    if (byKey.has(key)) continue;
    entries.push(entry); byKey.set(key, entry);
  }
  const names = Array.from(byKey.keys()).sort((a,b) => b.length-a.length)
    .map(name => name.replace(/[.*+?^$()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    '(^|[^\\p{L}\\p{M}\\p{N}])(' + names.join('|') + ')(?=$|[^\\p{L}\\p{M}\\p{N}])', 'giu',
  );
  const byName = (name: string): DictionaryEntry | null => byKey.get(name.toLowerCase()) ?? null;
  const split = (text: string): DictionaryPart[] => {
    const parts: DictionaryPart[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      const term = match[2];
      if (term === 'tali' || term === 'el') continue;
      const index = (match.index ?? 0) + match[1].length;
      if (index > last) parts.push({ term: null, text: text.slice(last,index) });
      parts.push({ term: byName(term)?.name ?? term, text: term });
      last = index + term.length;
    }
    if (last < text.length) parts.push({term:null,text:text.slice(last)});
    return parts.length ? parts : [{term:null,text}];
  };
  const forManuscript = (readableText: string): readonly DictionaryEntry[] => {
    const mentioned = new Set(split(readableText).filter(part => part.term !== null).map(part => part.term));
    return entries.filter(entry => BASE_KL_DICTIONARY.includes(entry) || mentioned.has(entry.name));
  };
  return { byName, split, forManuscript };
}

const local = createKlDictionary();
export const dictionaryByName = local.byName;
export const splitDictionaryTerms = local.split;
export const dictionaryForManuscript = local.forManuscript;
