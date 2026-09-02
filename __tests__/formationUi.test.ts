import {
  friendlyBlockingReason,
  primaryActionLabel,
} from '@/lib/formationCopy';
import {
  mapStageCardStatus,
  stageProgressPercent,
  statusLabel,
} from '@/lib/formationUi';
import type { FormationJourneyStage } from '@/types/buklodFormation';

describe('formationCopy', () => {
  it('maps CURRICULUM_NOT_ASSIGNED to friendly copy', () => {
    expect(friendlyBlockingReason('CURRICULUM_NOT_ASSIGNED')).toContain(
      'curriculum',
    );
  });

  it('maps primary actions to member-friendly labels', () => {
    expect(primaryActionLabel('CONTINUE_LESSON')).toBe('Continue Lesson');
    expect(primaryActionLabel(null)).toBe('Continue Learning');
  });
});

describe('formationUi', () => {
  const baseStage: FormationJourneyStage = {
    stage_code: 106,
    stage_order: 6,
    title_en: 'Workers',
    title_fil: 'Kamanggagawa',
    status: 'current',
    access_allowed: true,
    is_locked: false,
    locked: false,
    current: true,
    completed: false,
    historically_complete: false,
    downstream_repeat_locked: false,
    repeat_required: false,
    is_completable: true,
    stage_points_current: 4,
    stage_points_required: 10,
    stage_bayanihan_current: 2,
    stage_bayanihan_required: 10,
    progress: {
      expected_lessons: 0,
      approved_lessons: 0,
      required_records: 0,
      verified_records: 0,
      lessons_complete: false,
      requirements_complete: false,
      stage_complete: false,
    },
    blocking_reasons: ['CURRICULUM_NOT_ASSIGNED'],
    next_action: 'CONFIRM_TRACK',
  };

  it('does not show complete when curriculum is empty for 106', () => {
    expect(mapStageCardStatus(baseStage)).toBe('IN_PROGRESS');
    expect(stageProgressPercent(baseStage)).toBeGreaterThan(0);
    expect(stageProgressPercent(baseStage)).toBeLessThan(100);
  });

  it('shows historically locked state', () => {
    const stage: FormationJourneyStage = {
      ...baseStage,
      status: 'historically_complete_locked',
      historically_complete: true,
    };
    expect(mapStageCardStatus(stage)).toBe('HISTORICALLY_LOCKED');
    expect(statusLabel('HISTORICALLY_LOCKED')).toBe('Completed Previously');
  });

  it('locks stage 102 when access is denied', () => {
    const stage: FormationJourneyStage = {
      ...baseStage,
      stage_code: 102,
      access_allowed: false,
      is_locked: true,
      current: false,
      blocking_reasons: ['PREVIOUS_STAGE_INCOMPLETE'],
    };
    expect(mapStageCardStatus(stage)).toBe('LOCKED');
  });
});
