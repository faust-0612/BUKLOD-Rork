import {
  getBuklodVideoCuePointsSeconds,
} from '@/lib/buklodVideoMonetization';

describe('BUKLOD video monetization policy', () => {
  it('does not force mid-roll cues for videos under two minutes', () => {
    expect(getBuklodVideoCuePointsSeconds(30)).toEqual([]);
    expect(getBuklodVideoCuePointsSeconds(119)).toEqual([]);
  });

  it('uses one bounded mid-roll cue for 2 to under 20 minute videos', () => {
    expect(getBuklodVideoCuePointsSeconds(120)).toEqual([60]);
    expect(getBuklodVideoCuePointsSeconds(480)).toEqual([240]);
    expect(getBuklodVideoCuePointsSeconds(1199)).toEqual([600]);
  });

  it('uses at most two spaced cues for long videos', () => {
    expect(getBuklodVideoCuePointsSeconds(1200)).toEqual([400, 800]);
    expect(getBuklodVideoCuePointsSeconds(1800)).toEqual([600, 1200]);
  });
});
