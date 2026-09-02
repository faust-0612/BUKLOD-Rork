import {
  computeCurrentWeek,
  computeMaxReleasedSequence,
  isLessonReleasedByCalendar,
  isPreviousLessonApprovedForSequentialLock,
  mergeLessonAccessWithLegacySequentialLock,
  releaseWeekForLesson,
  shouldApplyClientSequentialLock,
  requiresFormationSequentialLock,
} from '@/lib/formationPacing';
import { friendlyLessonBlockingReason } from '@/lib/formationCopy';
import { normalizeFormationLessonAccess } from '@/lib/buklodFormationProgress';

describe('formationPacing', () => {
  const weekMs = 7 * 86400000;
  const start = Date.parse('2026-01-05T00:00:00Z');

  it('releases 1 lesson in week 1 at 1/week', () => {
    expect(computeCurrentWeek(start, start, 0)).toBe(1);
    expect(computeMaxReleasedSequence(1, 1)).toBe(1);
    expect(isLessonReleasedByCalendar(1, 1, 1)).toBe(true);
    expect(isLessonReleasedByCalendar(2, 1, 1)).toBe(false);
  });

  it('releases lesson 2 in week 2 at 1/week', () => {
    expect(computeCurrentWeek(start, start + weekMs, 0)).toBe(2);
    expect(isLessonReleasedByCalendar(2, 2, 1)).toBe(true);
    expect(isLessonReleasedByCalendar(3, 2, 1)).toBe(false);
  });

  it('releases lessons 1-3 in week 1 at 3/week', () => {
    expect(computeMaxReleasedSequence(1, 3)).toBe(3);
    expect(isLessonReleasedByCalendar(3, 1, 3)).toBe(true);
    expect(isLessonReleasedByCalendar(4, 1, 3)).toBe(false);
  });

  it('releases lessons 4-6 in week 2 at 3/week', () => {
    expect(isLessonReleasedByCalendar(4, 2, 3)).toBe(true);
    expect(isLessonReleasedByCalendar(6, 2, 3)).toBe(true);
    expect(isLessonReleasedByCalendar(7, 2, 3)).toBe(false);
  });

  it('computes release week from sequence', () => {
    expect(releaseWeekForLesson(1, 2)).toBe(1);
    expect(releaseWeekForLesson(3, 2)).toBe(2);
    expect(releaseWeekForLesson(5, 2)).toBe(3);
  });
});

describe('formation lesson access normalizer', () => {
  it('maps LESSON_NOT_RELEASED blocking payload', () => {
    const result = normalizeFormationLessonAccess({
      allowed: false,
      stage_code: 106,
      blocking_reason: 'LESSON_NOT_RELEASED',
      release_week: 3,
    });

    expect(result?.allowed).toBe(false);
    expect(result?.blocking_reason).toBe('LESSON_NOT_RELEASED');
    expect(friendlyLessonBlockingReason(result?.blocking_reason)).toContain(
      'not available yet',
    );
  });

  it('maps REPEAT_REQUIRED to pastor-friendly copy', () => {
    expect(friendlyLessonBlockingReason('REPEAT_REQUIRED')).toContain('Pastor');
  });
});

describe('legacy sequential lesson lock', () => {
  const lessons = [
    { id: 'l1', lesson_number: 1 },
    { id: 'l2', lesson_number: 2 },
    { id: 'l3', lesson_number: 3 },
  ];

  it('requires previous lesson admin approval', () => {
    const statusByLessonId = new Map([
      ['l1', { official_status: 'awaiting_pastor' }],
    ]);

    expect(
      isPreviousLessonApprovedForSequentialLock(lessons, 'l2', statusByLessonId),
    ).toBe(false);
  });

  it('requires client sequential lock for stages 101-105', () => {
    expect(shouldApplyClientSequentialLock(101, 'available')).toBe(true);
    expect(shouldApplyClientSequentialLock(105, 'legacy')).toBe(true);
    expect(shouldApplyClientSequentialLock(106, 'available')).toBe(false);
    expect(shouldApplyClientSequentialLock(106, 'legacy')).toBe(true);
  });

  it('requires sequential lock for 101-105 even when engine is off', () => {
    expect(requiresFormationSequentialLock(101, false)).toBe(true);
    expect(requiresFormationSequentialLock(105, false)).toBe(true);
    expect(requiresFormationSequentialLock(106, false)).toBe(false);
    expect(requiresFormationSequentialLock(106, true)).toBe(true);
  });

  it('locks lesson 2 for stage 101 when engine is off', () => {
    const statusByLessonId = new Map([
      ['l1', { official_status: 'pending_admin' }],
    ]);

    const merged = mergeLessonAccessWithLegacySequentialLock(null, {
      engineEnabled: false,
      isFormation: true,
      lessonId: 'l2',
      stageCode: 101,
      lessons,
      statusByLessonId,
    });

    expect(merged?.allowed).toBe(false);
    expect(merged?.blocking_reason).toBe('PREREQUISITE_LESSON_INCOMPLETE');
  });

  it('locks lesson 2 when server returns legacy access', () => {
    const statusByLessonId = new Map([
      ['l1', { official_status: 'pending_admin' }],
    ]);

    const merged = mergeLessonAccessWithLegacySequentialLock(
      {
        allowed: true,
        stage_code: 101,
        release_status: 'legacy',
        release_week: null,
        available_from: null,
        blocking_reason: null,
      },
      {
        engineEnabled: true,
        isFormation: true,
        lessonId: 'l2',
        lessons,
        statusByLessonId,
      },
    );

    expect(merged?.allowed).toBe(false);
    expect(merged?.blocking_reason).toBe('PREREQUISITE_LESSON_INCOMPLETE');
  });

  it('locks lesson 2 when server returns available access for stage 101', () => {
    const statusByLessonId = new Map([
      ['l1', { official_status: 'pending_admin' }],
    ]);

    const merged = mergeLessonAccessWithLegacySequentialLock(
      {
        allowed: true,
        stage_code: 101,
        release_status: 'available',
        release_week: null,
        available_from: null,
        blocking_reason: null,
        track_lesson_id: 'tl-2',
        lesson_sequence: 2,
      },
      {
        engineEnabled: true,
        isFormation: true,
        lessonId: 'l2',
        stageCode: 101,
        lessons,
        statusByLessonId,
      },
    );

    expect(merged?.allowed).toBe(false);
    expect(merged?.blocking_reason).toBe('PREREQUISITE_LESSON_INCOMPLETE');
  });

  it('keeps canonical server denial', () => {
    const merged = mergeLessonAccessWithLegacySequentialLock(
      {
        allowed: false,
        stage_code: 106,
        release_status: 'locked',
        release_week: null,
        available_from: null,
        blocking_reason: 'LESSON_NOT_RELEASED',
      },
      {
        engineEnabled: true,
        isFormation: true,
        lessonId: 'l2',
        lessons,
        statusByLessonId: new Map(),
      },
    );

    expect(merged?.blocking_reason).toBe('LESSON_NOT_RELEASED');
  });
});
