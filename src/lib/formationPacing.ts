import type { FormationLessonAccess } from '@/types/buklodFormation';

/** Pure helpers mirroring server release math for unit tests. */
export function computeCurrentWeek(
  startedAtMs: number,
  nowMs: number,
  totalPausedMs = 0,
): number {
  const effective = nowMs - totalPausedMs;
  const elapsedDays = (effective - startedAtMs) / 86400000;
  if (elapsedDays < 0) return 0;
  return Math.floor(elapsedDays / 7) + 1;
}

export function computeMaxReleasedSequence(
  currentWeek: number,
  lessonsPerWeek: number,
): number {
  if (currentWeek <= 0 || lessonsPerWeek <= 0) return 0;
  return currentWeek * lessonsPerWeek;
}

export function isLessonReleasedByCalendar(
  lessonSequence: number,
  currentWeek: number,
  lessonsPerWeek: number,
): boolean {
  return lessonSequence <= computeMaxReleasedSequence(currentWeek, lessonsPerWeek);
}

export function releaseWeekForLesson(
  lessonSequence: number,
  lessonsPerWeek: number,
): number {
  return Math.ceil(lessonSequence / Math.max(lessonsPerWeek, 1));
}

export function pickPrimaryWeeklyLesson(
  lessons: Array<{
    in_current_week?: boolean;
    access_allowed?: boolean;
    approved?: boolean;
    lesson_sequence?: number;
    learning_lesson_id?: string | null;
    track_lesson_id?: string;
  }>,
) {
  const inWeek = lessons.filter((l) => l.in_current_week);
  const continueLesson = inWeek.find((l) => l.access_allowed && !l.approved);
  if (continueLesson) return continueLesson;
  return inWeek.find((l) => l.access_allowed) ?? inWeek[0] ?? null;
}

export type LessonOrderItem = {
  id: string;
  lesson_number: number;
};

export type LessonOfficialStatus = {
  official_status?: string | null;
};

export function isFormationLessonApproved(
  status: LessonOfficialStatus | undefined,
): boolean {
  return status?.official_status === 'approved';
}

export function isPreviousLessonApprovedForSequentialLock(
  lessons: LessonOrderItem[],
  lessonId: string,
  statusByLessonId: Map<string, LessonOfficialStatus>,
): boolean {
  const current = lessons.find((lesson) => lesson.id === lessonId);
  if (!current || current.lesson_number <= 1) {
    return true;
  }

  const previous = lessons.find(
    (lesson) => lesson.lesson_number === current.lesson_number - 1,
  );
  if (!previous) {
    return true;
  }

  return isFormationLessonApproved(statusByLessonId.get(previous.id));
}

export function isEarlyFormationStage(
  stageCode: number | null | undefined,
): boolean {
  return stageCode != null && stageCode >= 101 && stageCode <= 105;
}

/** Stages 101–105 always enforce sequential order; 106–107 only when engine is off or release is legacy. */
export function shouldApplyClientSequentialLock(
  stageCode: number | null | undefined,
  releaseStatus: string | null | undefined,
): boolean {
  if (isEarlyFormationStage(stageCode)) {
    return true;
  }

  return releaseStatus === 'legacy' || releaseStatus == null;
}

/** True when client must enforce admin-approved prerequisite order (101–105 always; 106–107 with engine). */
export function requiresFormationSequentialLock(
  stageCode: number | null | undefined,
  engineEnabled: boolean,
): boolean {
  if (isEarlyFormationStage(stageCode)) {
    return true;
  }

  return engineEnabled;
}

/** Enforce sequential lock client-side when RPC grants open access without track-lesson gating. */
export function mergeLessonAccessWithLegacySequentialLock(
  access: FormationLessonAccess | null | undefined,
  input: {
    engineEnabled: boolean;
    isFormation: boolean;
    lessonId: string;
    lessons: LessonOrderItem[];
    statusByLessonId: Map<string, LessonOfficialStatus>;
    stageCode?: number | null;
  },
): FormationLessonAccess | null {
  const stageCode = input.stageCode ?? access?.stage_code ?? null;

  if (
    !input.isFormation ||
    !requiresFormationSequentialLock(stageCode, input.engineEnabled)
  ) {
    return access ?? null;
  }

  if (access && !access.allowed) {
    return access;
  }

  if (
    access &&
    access.allowed &&
    !shouldApplyClientSequentialLock(stageCode, access.release_status)
  ) {
    return access;
  }

  const prerequisitesMet = isPreviousLessonApprovedForSequentialLock(
    input.lessons,
    input.lessonId,
    input.statusByLessonId,
  );

  if (prerequisitesMet) {
    return (
      access ?? {
        allowed: true,
        stage_code: stageCode,
        release_status: null,
        release_week: null,
        available_from: null,
        blocking_reason: null,
      }
    );
  }

  return {
    allowed: false,
    stage_code: stageCode,
    release_status: access?.release_status ?? 'legacy',
    release_week: access?.release_week ?? null,
    available_from: access?.available_from ?? null,
    blocking_reason: 'PREREQUISITE_LESSON_INCOMPLETE',
    track_lesson_id: access?.track_lesson_id,
    lesson_sequence: access?.lesson_sequence,
    current_week: access?.current_week,
    lessons_per_week: access?.lessons_per_week,
  };
}
