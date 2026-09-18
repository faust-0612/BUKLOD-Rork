import { BUKLOD_GAMES } from '@/features/games/registry';
import { getRorkGameMedia, RORK_AUDIO } from '@/features/games/runtime/rorkMedia';

describe('Rork Kingdom media integration', () => {
  it('maps every canonical current game to a presentation profile', () => {
    for (const gameId of Object.keys(BUKLOD_GAMES)) {
      const media = getRorkGameMedia(gameId);
      expect(media).not.toBeNull();
      expect(media?.background.startsWith('https://')).toBe(true);
      expect(media?.accent).toMatch(/^#/);
    }
  });

  it('declares remote audio sources without changing game rules', () => {
    for (const source of Object.values(RORK_AUDIO)) {
      expect(source.startsWith('https://')).toBe(true);
    }
  });

  it('returns null for unknown game ids', () => {
    expect(getRorkGameMedia('not-a-real-game')).toBeNull();
  });
});
