import {
  BUKLOD_FOUNDER,
  BUKLOD_PITCHES,
  BUKLOD_PRESENTATION_DISCLOSURE,
  BUKLOD_PRINCIPLES,
  formatBuklodPitch,
  getBuklodPitch,
} from '../aboutBuklodContent';

describe('About BUKLOD content contract', () => {
  it('provides a complete founder story and non-fabricated principle themes', () => {
    expect(BUKLOD_FOUNDER.name).toBe('Faustino Jr. M. Gabut');
    expect(BUKLOD_FOUNDER.story.length).toBeGreaterThanOrEqual(3);
    expect(BUKLOD_PRINCIPLES.length).toBeGreaterThanOrEqual(5);
  });

  it('covers six distinct target audiences with speaking and demo content', () => {
    expect(BUKLOD_PITCHES).toHaveLength(6);
    expect(new Set(BUKLOD_PITCHES.map(pitch => pitch.key)).size).toBe(6);
    for (const pitch of BUKLOD_PITCHES) {
      expect(pitch.opener.length).toBeGreaterThan(20);
      expect(pitch.shortTalk.length).toBeGreaterThan(100);
      expect(pitch.fullTalk.length).toBeGreaterThan(250);
      expect(pitch.demo.length).toBeGreaterThanOrEqual(3);
      expect(pitch.questions.length).toBeGreaterThanOrEqual(2);
      expect(pitch.close.length).toBeGreaterThan(20);
    }
  });

  it('keeps distinct Christian identity, commercial transparency, and no guaranteed income', () => {
    expect(BUKLOD_PRESENTATION_DISCLOSURE).toContain('Christian roots');
    expect(BUKLOD_PRESENTATION_DISCLOSURE).toContain('Walang garantisadong kita');
    expect(BUKLOD_PRESENTATION_DISCLOSURE).toContain('hiwalay sa commercial transaction');
    expect(getBuklodPitch('faith').shortTalk).toContain('Christian roots');
    expect(getBuklodPitch('faith').fullTalk).toContain('Walang nakatagong');
  });

  it('generates self-contained, actionable, shareable scripts for every audience', () => {
    for (const pitch of BUKLOD_PITCHES) {
      const output = formatBuklodPitch(pitch);
      expect(output).toContain(pitch.fullTalk);
      expect(output).toContain(pitch.close);
      expect(output).toContain(BUKLOD_PRESENTATION_DISCLOSURE);
      expect(output).toContain('https://buklod.expo.app');
    }
  });
});
