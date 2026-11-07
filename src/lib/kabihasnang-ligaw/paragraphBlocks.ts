/**
 * The editor and released reader must agree on manuscript paragraph borders.
 *
 * Some approved manuscripts contain a blank line with a stray space or tab
 * ("\\n \\n"). Splitting only on /\\n{2,}/ merges independent paragraphs,
 * which can produce clipped multiline Text spans in Android's nested Text
 * renderer. Blank-line spacing is formatting, not manuscript content.
 *
 * Keep single newlines within a paragraph. Preserve all non-whitespace text.
 */
export function splitKlManuscriptBlocks(source: string): string[] {
  if (!source) return [];
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return normalized
    .split(/\n[ \t]*\n(?:[ \t]*\n)*/)
    .map(block => block.trim())
    .filter(Boolean);
}
