import { isNewKlRelease, verifiedChapterReward } from '../src/lib/kabihasnang-ligaw/releaseBadge';

describe('KL official release encouragement and rewards', () => {
  it('never shows a new-release badge for draft/unreleased chapters', () => {
    expect(isNewKlRelease(null, null)).toBe(false);
    expect(isNewKlRelease(undefined, 'old')).toBe(false);
    expect(isNewKlRelease('chapter-2', 'chapter-2')).toBe(false);
    expect(isNewKlRelease('chapter-2', 'chapter-1')).toBe(true);
  });

  it('attributes only server-confirmed first-completion points', () => {
    expect(verifiedChapterReward({ new_completion: true, points_awarded: 7 })).toBe(7);
    expect(verifiedChapterReward({ new_completion: false, points_awarded: 0 })).toBe(0);
    expect(verifiedChapterReward({ completed: false, new_completion: true, points_awarded: 7 })).toBe(0);
    expect(verifiedChapterReward(null)).toBe(0);
  });
});
