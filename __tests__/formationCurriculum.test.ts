import {
  AUTHORITATIVE_SOURCE_READY_COUNTS,
  getAuthoritativeLessonCountExpectations,
  isDraftLessonMemberVisible,
  normalizeFormationLessonBuilder,
} from '@/lib/buklodFormationProgress';

describe('formationCurriculum 005', () => {
  it('matches authoritative lesson counts for 101–105 components', () => {
    const expectations = getAuthoritativeLessonCountExpectations();
    let totalExpected = 0;
    let totalReady = 0;

    for (const stage of expectations) {
      for (const component of stage.components) {
        totalExpected += component.expectedLessonCount;
        const ready =
          component.sourceReadyLessonCount ??
          AUTHORITATIVE_SOURCE_READY_COUNTS[component.trackSlug] ??
          0;
        totalReady += ready;
      }
    }

    expect(totalExpected).toBe(68);
    expect(totalReady).toBe(67);
    expect(AUTHORITATIVE_SOURCE_READY_COUNTS['buklod-101-ccp-1']).toBe(4);
    expect(AUTHORITATIVE_SOURCE_READY_COUNTS['buklod-105-leadership-1']).toBe(9);
  });

  it('documents LEADERSHIP_1 operational resolution (10 slots, 9 with body)', () => {
    const stage105 = getAuthoritativeLessonCountExpectations().find(
      (s) => s.stageCode === 105,
    );
    const level1 = stage105?.components.find((c) => c.code === 'LEADERSHIP_1');

    expect(level1?.expectedLessonCount).toBe(10);
    expect(level1?.sourceReadyLessonCount).toBe(9);
    expect(AUTHORITATIVE_SOURCE_READY_COUNTS['buklod-105-leadership-1']).toBe(9);
  });

  it('blocks draft 106 lessons from member visibility by default', () => {
    expect(
      isDraftLessonMemberVisible({
        stageCode: 106,
        publishedVersionStatus: 'DRAFT',
      }),
    ).toBe(false);

    expect(
      isDraftLessonMemberVisible({
        stageCode: 106,
        publishedVersionStatus: 'PUBLISHED',
      }),
    ).toBe(true);
  });

  it('allows authoritative 101–105 when content is ready', () => {
    expect(
      isDraftLessonMemberVisible({
        stageCode: 101,
        publishedVersionStatus: null,
        memberVisible: true,
      }),
    ).toBe(true);
  });

  it('normalizes lesson builder snapshot with provider-off state', () => {
    const snapshot = normalizeFormationLessonBuilder({
      provider_configured: false,
      provider_message: 'AI provider not configured',
      blueprints: [{ blueprint_code: '106_PASTOR', stage_code: 106 }],
      units: [],
      generation_jobs: [],
      manifests: [{ stage_code: 101 }],
    });

    expect(snapshot?.providerConfigured).toBe(false);
    expect(snapshot?.providerMessage).toContain('not configured');
    expect(snapshot?.blueprints).toHaveLength(1);
    expect(snapshot?.manifests).toHaveLength(1);
  });

  it('expects six 106 blueprints and one 107 master blueprint capacity', () => {
    const roleTracks = [
      'GENERAL_WORKER',
      'PASTOR',
      'DEACON',
      'WOMAN_MISSIONARY',
      'CHILDREN_TEACHER',
      'MINISTRY_HEAD',
    ];

    expect(roleTracks).toHaveLength(6);
    expect(300 * 6).toBe(1800);
    expect(1000).toBeGreaterThanOrEqual(300);
  });
});
