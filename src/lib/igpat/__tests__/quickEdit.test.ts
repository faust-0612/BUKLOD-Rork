import {
  DEFAULT_IGPAT_QUICK_EDIT,
  igpatOutputDurationSeconds,
  isDefaultIgpatQuickEdit,
  normalizeIgpatQuickEdit,
  parseIgpatQuickEdit,
  serializeIgpatQuickEdit,
  suggestIgpatAutoImprove,
} from '../quickEdit';

describe('IGPAT Quick Edit', () => {
  it('keeps at least one second of output and clamps the cover inside the clip', () => {
    const normalized = normalizeIgpatQuickEdit({
      ...DEFAULT_IGPAT_QUICK_EDIT,
      trimStartSeconds: 9.8,
      trimEndSeconds: 9.9,
      coverSeconds: 99,
    }, 10);

    expect(igpatOutputDurationSeconds(normalized, 10)).toBeGreaterThanOrEqual(1);
    expect(normalized.coverSeconds).toBeGreaterThanOrEqual(normalized.trimStartSeconds);
    expect(normalized.coverSeconds).toBeLessThanOrEqual(Number(normalized.trimEndSeconds));
  });

  it('falls back from unsupported speed and rotation values', () => {
    const parsed = parseIgpatQuickEdit({ speed: 9, rotation: 45, content_fit: 'contain' }, 30);
    expect(parsed.speed).toBe(1);
    expect(parsed.rotation).toBe(0);
    expect(parsed.contentFit).toBe('contain');
  });

  it('serializes bounded non-destructive metadata and limits overlay text', () => {
    const payload = serializeIgpatQuickEdit({
      ...DEFAULT_IGPAT_QUICK_EDIT,
      trimStartSeconds: 2,
      trimEndSeconds: 8,
      textOverlay: `  ${'x'.repeat(220)}  `,
      rotation: 90,
      muted: true,
    }, 10);

    expect(payload.trim_start_seconds).toBe(2);
    expect(payload.trim_end_seconds).toBe(8);
    expect(String(payload.text_overlay)).toHaveLength(160);
    expect(payload.rotation).toBe(90);
    expect(payload.muted).toBe(true);
  });

  it('auto improve is reversible metadata-only guidance for framing and cover', () => {
    const suggestion = suggestIgpatAutoImprove({
      ...DEFAULT_IGPAT_QUICK_EDIT,
      trimStartSeconds: 2,
      trimEndSeconds: 8,
      contentFit: 'contain',
      coverSeconds: 2,
    }, 10);

    expect(suggestion.edit.contentFit).toBe('cover');
    expect(suggestion.edit.coverSeconds).toBe(5);
    expect(suggestion.changes.length).toBeGreaterThan(0);
  });

  it('recognizes the untouched default edit', () => {
    expect(isDefaultIgpatQuickEdit(DEFAULT_IGPAT_QUICK_EDIT, 60)).toBe(true);
  });
});
