/** Android Bible TTS locale selection: ASD cannot silently use an English voice. */
export type BibleVoice = {
  language?: string;
  identifier?: string;
  name?: string;
  quality?: string | number;
};

export function chooseBibleNarrationVoice<T extends BibleVoice>(
  voices: readonly T[],
  requested: string,
  rank: (voice: T) => number = () => 0,
): { voice: T | undefined; language: string; available: boolean } {
  const wanted = String(requested || '').trim().toLowerCase();
  const base = wanted.split('-')[0];
  const filipino = base === 'fil' || base === 'tl';
  const aliases = filipino ? ['fil', 'tl'] : [base];
  const candidates = voices.filter(voice => {
    const locale = String(voice.language || '').toLowerCase();
    return aliases.some(alias => locale === alias || locale.startsWith(alias + '-'));
  });
  const quality = (voice: T) => {
    const locale = String(voice.language || '').toLowerCase();
    return (locale === wanted ? 1000 : filipino && locale.endsWith('-ph') ? 500 : 0) + rank(voice);
  };
  candidates.sort((a, b) => quality(b) - quality(a));
  const voice = candidates[0];
  return {
    voice,
    language: voice?.language || requested,
    available: !filipino || Boolean(voice?.identifier),
  };
}
