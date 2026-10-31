import { sceneAnchorSuggestions, validateSceneAnchor } from '../src/lib/kabihasnang-ligaw/sceneAnchorPicker';
describe('KL exact anchors from server manuscript', () => {
  const saved = '### Heading\n\n“Dito ang simula ng una at mahalagang pangungusap.”\n\nIto ang kasunod na talatang mahaba at natatangi.';
  it('rejects stale and cross-paragraph copy', () => {
    expect(validateSceneAnchor(saved, 'Dito ang mga bata na wala sa saved manuscript')).toContain('Wala');
    expect(validateSceneAnchor(saved, 'pangungusap.”\n\nIto ang kasunod')).toContain('talata');
  });
  it('provides unique exact selections for each paragraph', () => {
    const choices = sceneAnchorSuggestions(saved);
    expect(choices).toHaveLength(2);
    expect(choices.every((choice) => validateSceneAnchor(saved, choice.anchor) === null)).toBe(true);
  });
});
