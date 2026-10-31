/** A saved illustration anchor must exist exactly once inside one saved paragraph. */
export type SceneAnchorOption = { paragraph: number; anchor: string };
export function sceneAnchorSuggestions(manuscript: string): SceneAnchorOption[] {
  return manuscript.split(/\r?\n[ \t]*\r?\n+/).map((text, offset) => ({ text: text.trim(), paragraph: offset + 1 }))
    .filter(({ text }) => text.length >= 12 && !text.startsWith('### '))
    .flatMap(({ text, paragraph }) => {
      const anchor = text.slice(0, 100);
      return manuscript.split(anchor).length === 2 ? [{ paragraph, anchor }] : [];
    });
}
export function validateSceneAnchor(manuscript: string, anchor: string): string | null {
  const exact = anchor.trim();
  if (exact.length < 12) return 'Kailangan ng hindi bababa sa 12 character na eksaktong sipi.';
  if (!manuscript.includes(exact)) return 'Wala ang siping ito sa saved manuscript. Hindi ito masi-save kahit may nakalagay.';
  if (manuscript.split(exact).length !== 2) return 'Paulit-ulit ang sipi sa manuscript. Pumili ng unique na pangungusap.';
  const paragraphs = manuscript.split(/\r?\n[ \t]*\r?\n+/);
  if (!paragraphs.some((paragraph) => paragraph.includes(exact))) return 'Tumatawid sa magkahiwalay na talata ang sipi. Pumili ng isang talata lamang.';
  return null;
}
