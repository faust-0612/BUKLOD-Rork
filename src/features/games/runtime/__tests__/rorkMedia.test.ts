import { BUKLOD_GAMES } from '@/features/games/registry';
import { getRorkGameMedia } from '@/features/games/runtime/rorkMedia';

describe('Rork Kingdom media integration', () => {
  it('maps every canonical current game to a presentation profile', () => {
    for (const gameId of Object.keys(BUKLOD_GAMES)) {
      const media = getRorkGameMedia(gameId);
      expect(media).not.toBeNull();
      expect(media?.background.startsWith('https://r2-pub.rork.com/')).toBe(true);
      expect(media?.accent).toMatch(/^#/);
      expect(media?.ambience).toMatch(/^amb_/);
      expect(media?.signature).toBeTruthy();
    }
  });

  it('keeps media presentation metadata separate from game rules', () => {
    for (const gameId of Object.keys(BUKLOD_GAMES)) {
      const media = getRorkGameMedia(gameId);
      expect(media).toEqual(
        expect.objectContaining({
          background: expect.any(String),
          ambience: expect.any(String),
          signature: expect.any(String),
          accent: expect.any(String),
        }),
      );
    }
  });

  it('returns null for unknown game ids', () => {
    expect(getRorkGameMedia('not-a-real-game')).toBeNull();
  });
});
