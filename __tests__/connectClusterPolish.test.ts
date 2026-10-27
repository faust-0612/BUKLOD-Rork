import {
  connectComposerDockBottom,
  connectMediaOnlyMessage,
} from '../src/lib/connectChatWindow';

describe('embedded Connect keyboard docking', () => {
  it('does not add phone navigation clearance to an open resized keyboard', () => {
    expect(connectComposerDockBottom(true, 0, 36)).toBe(0);
    expect(connectComposerDockBottom(true, 12, 36)).toBe(12);
    expect(connectComposerDockBottom(true, 72, 36)).toBe(72);
  });

  it('restores the phone clearance only after keyboard closes', () => {
    expect(connectComposerDockBottom(false, 0, 36)).toBe(36);
    expect(connectComposerDockBottom(false, 15, 36)).toBe(36);
  });
});

describe('full-bleed Connect attachments', () => {
  const bare = {
    deleted: false,
    bodyText: '',
    hasReply: false,
    hasSharedPost: false,
    hasReaction: false,
    hasMedia: true,
  };

  it('removes only the outside bubble from photo, album, GIF, and file cards', () => {
    expect(connectMediaOnlyMessage(bare)).toBe(true);
  });

  it('retains a readable bubble for captions, replies, and nonmedia content', () => {
    expect(connectMediaOnlyMessage({ ...bare, bodyText: 'caption' })).toBe(false);
    expect(connectMediaOnlyMessage({ ...bare, hasReply: true })).toBe(false);
    expect(connectMediaOnlyMessage({ ...bare, hasSharedPost: true })).toBe(false);
    expect(connectMediaOnlyMessage({ ...bare, hasReaction: true })).toBe(false);
    expect(connectMediaOnlyMessage({ ...bare, deleted: true })).toBe(false);
    expect(connectMediaOnlyMessage({ ...bare, hasMedia: false })).toBe(false);
  });
});
