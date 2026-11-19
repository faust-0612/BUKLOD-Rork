import { resolveBuklodLifeLanguage } from '@/lib/buklodLifeLanguage';

describe('LIFE language consistency', () => {
  it('honors explicit English app choice ahead of geographic defaults', () => {
    expect(resolveBuklodLifeLanguage({ appPreference:'en', profileLanguage:'fil', country:'Philippines' })).toBe('en');
  });
  it('honors Filipino app and profile choices', () => {
    expect(resolveBuklodLifeLanguage({ appPreference:'fil', profileLanguage:'en' })).toBe('fil');
    expect(resolveBuklodLifeLanguage({ appPreference:'device', profileLanguage:'tl-PH' })).toBe('fil');
    expect(resolveBuklodLifeLanguage({ profileLanguage:'Filipino' })).toBe('fil');
  });
  it('uses a Filipino fallback for regional profiles without native LIFE copy', () => {
    expect(resolveBuklodLifeLanguage({ profileLanguage:'Cebuano', deviceLanguage:'en' })).toBe('fil');
    expect(resolveBuklodLifeLanguage({ profileLanguage:'ilo', deviceLanguage:'en' })).toBe('fil');
  });
  it('uses Filipino for Philippine profiles and Filipino device locales', () => {
    expect(resolveBuklodLifeLanguage({ country:'PH', deviceLanguage:'en' })).toBe('fil');
    expect(resolveBuklodLifeLanguage({ deviceLanguage:'fil-PH' })).toBe('fil');
    expect(resolveBuklodLifeLanguage({ deviceLanguage:'en' })).toBe('en');
  });
});
