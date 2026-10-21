import {
  KABANATA_01_CANONICAL_SHA256,
  KABANATA_01_CANONICAL_TEXT,
  PANIMULA_CANONICAL_SHA256,
  PANIMULA_CANONICAL_TEXT,
} from './canonicalManuscriptText';
import type { ParagraphRange } from './types';

export type { ParagraphRange };

export type ParagraphKind = 'heading' | 'body';

export type CanonParagraph = {
  id: string;
  index: number;
  text: string;
  kind: ParagraphKind;
};

export type AnchorFailure = 'anchor_empty' | 'anchor_missing' | 'anchor_not_unique' | 'range_inverted';

export type AnchorResolution =
  | { ok: true; range: ParagraphRange }
  | { ok: false; reason: AnchorFailure };

/** Blank-line blocks, in file order. Heading markers stay in `text` so the hash still matches the file. */
export function splitCanonicalParagraphs(source: string, episodeNumber: number): CanonParagraph[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  const episode = String(episodeNumber).padStart(2, '0');
  return blocks.map((text, offset) => {
    const index = offset + 1;
    return {
      id: `kl-e${episode}-p${String(index).padStart(3, '0')}`,
      index,
      text,
      kind: text.startsWith('### ') ? 'heading' : 'body',
    };
  });
}

/** Member display hides a leading markdown heading marker. The stored paragraph text does not change. */
export function paragraphDisplayText(paragraph: CanonParagraph): string {
  if (paragraph.kind === 'heading') return paragraph.text.replace(/^###\s+/, '');
  return paragraph.text;
}

/**
 * An anchor must land in exactly one paragraph. Zero matches, repeated matches,
 * or an end that precedes the start all fail closed with no range.
 */
export function resolveAnchorRange(
  paragraphs: readonly CanonParagraph[],
  startAnchor: string,
  endAnchor: string,
): AnchorResolution {
  const startNeedle = startAnchor.trim();
  const endNeedle = endAnchor.trim();
  if (!startNeedle || !endNeedle) return { ok: false, reason: 'anchor_empty' };
  const starts = paragraphs.filter((paragraph) => paragraph.text.includes(startNeedle));
  const ends = paragraphs.filter((paragraph) => paragraph.text.includes(endNeedle));
  if (starts.length === 0 || ends.length === 0) return { ok: false, reason: 'anchor_missing' };
  if (starts.length !== 1 || ends.length !== 1) return { ok: false, reason: 'anchor_not_unique' };
  const start = starts[0];
  const end = ends[0];
  if (start.index > end.index) return { ok: false, reason: 'range_inverted' };
  return {
    ok: true,
    range: {
      start: start.index,
      end: end.index,
      startId: start.id,
      endId: end.id,
    },
  };
}

/** Scenes must sit in reading order and must not share a paragraph. */
export function sceneRangesAreOrdered(ranges: readonly ParagraphRange[]): boolean {
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start <= ranges[index - 1].end) return false;
  }
  return true;
}

export function paragraphsForEpisode(episodeNumber: number): CanonParagraph[] {
  if (episodeNumber === 0) return PANIMULA_PARAGRAPHS;
  if (episodeNumber === 1) return KABANATA_01_PARAGRAPHS;
  return [];
}

export function canonicalProse(episodeNumber: number): {
  text: string;
  sha256: string;
  path: string;
} | null {
  if (episodeNumber === 0) {
    return {
      text: PANIMULA_CANONICAL_TEXT,
      sha256: PANIMULA_CANONICAL_SHA256,
      path: 'content/kabihasnang-ligaw/panimula.md',
    };
  }
  if (episodeNumber === 1) {
    return {
      text: KABANATA_01_CANONICAL_TEXT,
      sha256: KABANATA_01_CANONICAL_SHA256,
      path: 'content/kabihasnang-ligaw/kabanata-01.md',
    };
  }
  return null;
}

export const PANIMULA_PARAGRAPHS = splitCanonicalParagraphs(PANIMULA_CANONICAL_TEXT, 0);
export const KABANATA_01_PARAGRAPHS = splitCanonicalParagraphs(KABANATA_01_CANONICAL_TEXT, 1);
