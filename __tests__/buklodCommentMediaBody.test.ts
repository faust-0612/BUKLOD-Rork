import {
  buklodCommentHasSendableContent,
  encodeBuklodCommentMediaBody,
  parseBuklodCommentMediaBody,
} from '@/lib/buklodCommentMediaBody';

describe('buklodCommentMediaBody', () => {
  it('round-trips image media with caption', () => {
    const encoded = encodeBuklodCommentMediaBody(
      { kind: 'image', ref: 'user/comment-photo-1.jpg' },
      'Salamat!',
    );
    const parsed = parseBuklodCommentMediaBody(encoded);
    expect(parsed.media).toEqual({
      kind: 'image',
      ref: 'user/comment-photo-1.jpg',
    });
    expect(parsed.caption).toBe('Salamat!');
  });

  it('round-trips gif-only comments', () => {
    const encoded = encodeBuklodCommentMediaBody(
      {
        kind: 'gif',
        ref: 'https://media.giphy.com/media/example/giphy.gif',
      },
      '',
    );
    const parsed = parseBuklodCommentMediaBody(encoded);
    expect(parsed.media?.kind).toBe('gif');
    expect(parsed.media?.ref).toContain('giphy.gif');
    expect(parsed.caption).toBe('');
    expect(buklodCommentHasSendableContent('', parsed.media)).toBe(true);
  });

  it('leaves plain text untouched', () => {
    const parsed = parseBuklodCommentMediaBody('Plain comment');
    expect(parsed.media).toBeNull();
    expect(parsed.caption).toBe('Plain comment');
  });
});
