import {
  getBuklodLifeCopy,
  getBuklodLifeWallCopy,
  normalizeBuklodLifeLanguage,
} from '@/lib/buklodLifeContent';

describe('BUKLOD LIFE content', () => {
  it('uses real Filipino copy for Filipino users', () => {
    const copy = getBuklodLifeCopy('fil');

    expect(copy.languageLabel).toBe('FILIPINO');
    expect(copy.needTitle).toBe('Ano ang kailangan mo ngayon?');
    expect(copy.primaryTopics.map(item => item.title)).toEqual([
      'Pag-asa',
      'Kapayapaan',
      'Layunin',
      'Kapatawaran',
      'Lakas',
      'Bagong Simula',
    ]);
    expect(copy.exploreTitle).toBe('Kilalanin si Jesus');
    expect(copy.helpTitle).toBe('Tulungan ang iba');
  });

  it('keeps English available and falls back safely for non-Filipino language packs', () => {
    expect(normalizeBuklodLifeLanguage('fil')).toBe('fil');
    expect(normalizeBuklodLifeLanguage('en')).toBe('en');
    expect(normalizeBuklodLifeLanguage('ceb')).toBe('en');
    expect(normalizeBuklodLifeLanguage('ilo')).toBe('en');

    const wall = getBuklodLifeWallCopy('en');
    expect(wall.subtitle).toBe('Hope • Purpose • Direction');
    expect(wall.cta).toBe('Explore');
  });

  it('keeps LIFE human-need-first and pressure-free in Filipino copy', () => {
    const copy = getBuklodLifeCopy('fil');

    expect(copy.details.hope.practicalBody.length).toBeGreaterThan(40);
    expect(copy.details.hope.truthBody).toContain('Christian Gospel');
    expect(copy.notNowLabel).toBe('Hindi muna');
    expect(copy.askLabel).toBe('May tanong ako');
  });
});
