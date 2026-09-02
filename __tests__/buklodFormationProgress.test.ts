import {
  normalizeFormationJourney,
  normalizeFormationStageAccess,
} from '@/lib/buklodFormationProgress';

describe('buklodFormationProgress', () => {
  it('normalizes stage access payload with blocking codes', () => {
    const result = normalizeFormationStageAccess({
      access_allowed: false,
      allowed: false,
      stage_code: 106,
      prerequisite_stage_code: 105,
      prerequisite_complete: true,
      stage_points_current: 4,
      stage_points_required: 10,
      stage_bayanihan_current: 2,
      stage_bayanihan_required: 10,
      blocking_reasons: [
        'POINTS_REQUIREMENT_NOT_MET',
        'BAYANIHAN_REQUIREMENT_NOT_MET',
      ],
    });

    expect(result?.access_allowed).toBe(false);
    expect(result?.stage_code).toBe(106);
    expect(result?.blocking_reasons).toEqual([
      'POINTS_REQUIREMENT_NOT_MET',
      'BAYANIHAN_REQUIREMENT_NOT_MET',
    ]);
  });

  it('normalizes formation journey payload', () => {
    const result = normalizeFormationJourney({
      engine_v2_enabled: false,
      next_action: 'COMPLETE_LESSONS',
      stages: [
        {
          stage_code: 101,
          status: 'current',
          locked: false,
        },
      ],
    });

    expect(result?.engine_v2_enabled).toBe(false);
    expect(result?.stages).toHaveLength(1);
    expect(result?.next_action).toBe('COMPLETE_LESSONS');
  });

  it('normalizes CURRICULUM_NOT_ASSIGNED blocking reason', () => {
    const result = normalizeFormationStageAccess({
      access_allowed: true,
      stage_code: 107,
      blocking_reasons: ['CURRICULUM_NOT_ASSIGNED'],
    });

    expect(result?.blocking_reasons).toContain('CURRICULUM_NOT_ASSIGNED');
  });
});
