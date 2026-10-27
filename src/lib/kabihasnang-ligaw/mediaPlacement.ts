/** Chapter art follows the saved manuscript anchor, never an estimated page fraction. */
export type AnchoredKlMedia = {
  kind: string;
  anchor?: string | null;
  side?: string | null;
};

export function illustrationsAtParagraph<T extends AnchoredKlMedia>(
  media: readonly T[],
  paragraph: string,
  side: 'before' | 'after',
): T[] {
  return media.filter((item) => (
    item.kind === 'illustration'
    && typeof item.anchor === 'string'
    && item.anchor.trim().length >= 12
    && paragraph.includes(item.anchor)
    && (item.side === 'before' ? side === 'before' : side === 'after')
  ));
}
