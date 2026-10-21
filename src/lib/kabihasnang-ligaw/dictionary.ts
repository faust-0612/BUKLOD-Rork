/** Terms copied from the tested R5 HTML. No extra names. */

export type DictionaryEntry = {
  name: string;
  kind: string;
  meaning: string;
};

export const KL_DICTIONARY: readonly DictionaryEntry[] = [
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

export function dictionaryByName(name: string): DictionaryEntry | null {
  return KL_DICTIONARY.find((entry) => entry.name === name) ?? null;
}

export function splitDictionaryTerms(text: string): Array<{ term: string | null; text: string }> {
  const names = KL_DICTIONARY.map((entry) => entry.name).sort((left, right) => right.length - left.length);
  const pattern = new RegExp(`(${names.join('|')})`, 'g');
  const parts: Array<{ term: string | null; text: string }> = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ term: null, text: text.slice(last, index) });
    parts.push({ term: match[1], text: match[1] });
    last = index + match[1].length;
  }
  if (last < text.length) parts.push({ term: null, text: text.slice(last) });
  return parts.length > 0 ? parts : [{ term: null, text }];
}
