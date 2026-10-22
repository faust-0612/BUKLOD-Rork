import { isKlReaction, klCommentIdempotencyKey, validateKlComment } from './engagement';

describe('Kabihasnang Ligaw engagement safety', () => {
  it('rejects empty, short, and emoji-only comments', () => {
    expect(validateKlComment('')).toMatchObject({ ok: false });
    expect(validateKlComment('wow')).toMatchObject({ ok: false });
    expect(validateKlComment('😀😀😀😀😀😀😀')).toMatchObject({ ok: false });
  });
  it('normalizes a meaningful comment', () => {
    expect(validateKlComment('  Napakaganda   ng kabanatang ito.  ')).toEqual({
      ok: true, text: 'Napakaganda ng kabanatang ito.',
    });
  });
  it('accepts only supported reactions', () => {
    expect(isKlReaction('love')).toBe(true);
    expect(isKlReaction('invalid')).toBe(false);
  });
  it('requires valid idempotency identifiers', () => {
    expect(() => klCommentIdempotencyKey('bad', 'bad')).toThrow();
    expect(klCommentIdempotencyKey('11111111-1111-4111-8111-000000000001', '123456789012')).toBe(
      'kl-comment:11111111-1111-4111-8111-000000000001:123456789012',
    );
  });
});
