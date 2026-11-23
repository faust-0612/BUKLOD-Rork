import { encodeBuklodCommentMediaBody, parseBuklodCommentMediaBody, buklodCommentHasSendableContent } from '@/lib/buklodCommentMediaBody';
import { BUKLOD_COMMENT_VIDEO_MAX_BYTES, inspectBuklodCommentVideoSelection,
  validateBuklodCommentVideoMetadata, buklodCommentVideoFormat } from '@/lib/buklodCommentVideo';

describe('BUKLOD short video comments', () => {
  test('encodes and parses a private video and caption', () => {
    const media = { kind: 'video' as const, ref: 'user/comment-video-12.mp4' };
    expect(parseBuklodCommentMediaBody(encodeBuklodCommentMediaBody(media, 'Salamat po'))).toEqual({
      media, caption: 'Salamat po',
    });
    expect(buklodCommentHasSendableContent('', media)).toBe(true);
  });
  test('legacy photo, GIF and plain text formats still work', () => {
    for (const kind of ['gif', 'image'] as const) {
      const media = { kind, ref: 'user/media-file' };
      expect(parseBuklodCommentMediaBody(encodeBuklodCommentMediaBody(media, 'hi'))).toEqual({
        media, caption: 'hi',
      });
    }
    expect(parseBuklodCommentMediaBody('text only')).toEqual({ media: null, caption: 'text only' });
  });
  test('rejects oversize and overlong videos', () => {
    expect(validateBuklodCommentVideoMetadata(30, BUKLOD_COMMENT_VIDEO_MAX_BYTES)).toBeNull();
    expect(validateBuklodCommentVideoMetadata(31, 100)).toMatch(/30 seconds/);
    expect(validateBuklodCommentVideoMetadata(30, BUKLOD_COMMENT_VIDEO_MAX_BYTES + 1)).toMatch(/25 MB/);
    expect(validateBuklodCommentVideoMetadata(0, 100)).toMatch(/duration/);
  });
  test('picker normalizes duration and enforces media format', () => {
    expect(inspectBuklodCommentVideoSelection({
      uri: 'file:///cache/clip.mp4', mimeType: 'video/mp4', duration: 30000, fileSize: 1000,
    })).toEqual({ mimeType: 'video/mp4', extension: 'mp4', durationSeconds: 30, sizeBytes: 1000 });
    expect(() => inspectBuklodCommentVideoSelection({
      uri: 'file:///cache/clip.mp4', mimeType: 'video/mp4', duration: 31000, fileSize: 1000,
    })).toThrow(/30 seconds/);
    expect(buklodCommentVideoFormat({ mimeType: 'video/quicktime' }).extension).toBe('mov');
    expect(() => buklodCommentVideoFormat({ mimeType: 'application/octet-stream' })).toThrow();
  });
});
