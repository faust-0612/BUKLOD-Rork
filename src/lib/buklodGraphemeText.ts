export function splitGraphemes(value: string): string[] {
  const text = String(value ?? '');

  if (
    typeof Intl !== 'undefined' &&
    'Segmenter' in Intl
  ) {
    const segmenter = new Intl.Segmenter(
      undefined,
      { granularity: 'grapheme' }
    );

    return Array.from(
      segmenter.segment(text),
      segment => segment.segment
    );
  }

  return Array.from(text);
}

export function graphemeLength(value: string): number {
  return splitGraphemes(value).length;
}

export function truncateGraphemes(
  value: string,
  max: number
): string {
  if (max <= 0) {
    return '';
  }

  return splitGraphemes(value)
    .slice(0, max)
    .join('');
}
