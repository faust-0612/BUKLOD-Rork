import {
  privacyNotice,
  communityGuidelines,
  pastoralCareNotice,
  PRIVACY_NOTICE_VERSION,
  COMMUNITY_GUIDELINES_VERSION,
  PASTORAL_CARE_NOTICE_VERSION,
} from '@/lib/legal';

describe('BUKLOD policy copy', () => {
  it('has explicit versions', () => {
    expect(PRIVACY_NOTICE_VERSION).toBeTruthy();
    expect(COMMUNITY_GUIDELINES_VERSION).toBeTruthy();
    expect(PASTORAL_CARE_NOTICE_VERSION).toBeTruthy();
  });

  it('states that participation is not a spiritual score', () => {
    expect(`${privacyNotice} ${pastoralCareNotice}`.toLowerCase()).toContain('spiritual');
    expect(pastoralCareNotice.toLowerCase()).toContain('does not calculate');
  });

  it('contains community privacy guidance', () => {
    expect(communityGuidelines.toLowerCase()).toContain('privacy');
    expect(communityGuidelines.toLowerCase()).toContain('report');
  });
});
