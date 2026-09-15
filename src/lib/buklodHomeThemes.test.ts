import {
  BUKLOD_HOME_THEMES,
  DEFAULT_BUKLOD_HOME_THEME,
  getBuklodHomeTheme,
  isBuklodHomeThemeId,
} from '@/lib/buklodHomeThemes';

describe('buklodHomeThemes', () => {
  it('provides the requested Home styles', () => {
    const ids = BUKLOD_HOME_THEMES.map((theme) => theme.id);
    expect(ids).toEqual(expect.arrayContaining([
      'cozy-family',
      'classic-dad',
      'young-men',
      'teen',
      'professional',
      'retro-80s',
      'senior-ease',
    ]));
  });

  it('falls back safely when a stored theme is invalid', () => {
    expect(getBuklodHomeTheme('not-a-theme').id).toBe(DEFAULT_BUKLOD_HOME_THEME);
  });

  it('validates persisted theme IDs', () => {
    expect(isBuklodHomeThemeId('professional')).toBe(true);
    expect(isBuklodHomeThemeId('unknown')).toBe(false);
  });
});
