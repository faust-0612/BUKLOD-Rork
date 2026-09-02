import type { FormationBlockingReason } from '@/types/buklodFormation';

/** Centralized formation strings — swap for i18n packs later. */
export const formationCopy = {
  journeyTitle: 'Formation Journey',
  continueLearning: 'Continue Learning',
  lockedPrefix: 'Locked',
  completePrevious: (stage: number) =>
    `Complete BUKLOD ${stage} first.`,
  lessons: 'Lessons',
  documents: 'Documents',
  buklodPoints: 'BUKLOD Points',
  bayanihan: 'Bayanihan',
  missionActions: 'Mission Actions',
  noPointRequirement: 'No point requirement',
  repeatRequired: 'Repeat Required',
  historicallyLocked: 'Completed Previously · Temporarily Locked',
  awaitingTrack: 'Awaiting Track Assignment',
  trackAssignmentHint:
    'Your Pastor or Mentor will confirm the formation track appropriate for your ministry assignment.',
  thisWeek: 'This Week',
  futureFormation:
    'Next lessons will be released according to your formation schedule.',
  lessonNotReleased: 'This lesson is not available yet.',
  lessonStageLockedGuide:
    'Complete the previous BUKLOD stage first. Your finished lessons stay saved — you just need to finish the stage before this one opens.',
  lessonPendingReleaseGuide:
    'This lesson is on your track but not released yet. Your Pastor or organization admin will open it when it is ready.',
  lessonCouldNotOpenGuide:
    'We could not open this lesson right now. Go back and try again, or ask your Pastor or organization admin if this keeps happening.',
  lessonOpeningTitle: 'Opening lesson',
  lessonUnavailableTitle: 'Lesson not available',
  curriculumPreparing: 'Your formation lessons are being prepared.',
  repeatPastorMessage:
    'Your Pastor or Mentor has asked you to complete part of this formation again.',
  continue: 'Continue',
  primaryActions: {
    CONTINUE_LESSON: 'Continue Lesson',
    COMPLETE_REFLECTION: 'Complete Reflection',
    FINISH_QUICK_CHECK: 'Finish Quick Check',
    SUBMIT_COVENANT: 'Submit Covenant',
    AWAITING_VALIDATION: 'Awaiting Pastor Validation',
    COMPLETE_BAYANIHAN: 'Complete Bayanihan Challenge',
    REPEAT_LESSON: 'Repeat Required Lesson',
    CONFIRM_TRACK: 'Confirm Formation Track',
    COMPLETE_LESSONS: 'Continue Lessons',
    SUBMIT_DOCUMENTS: 'Submit Documents',
    CONTINUE_FORMATION: 'Continue Formation',
    REPEAT_REQUIRED: 'Complete Repeat Requirements',
  } as Record<string, string>,
};

const blockingFriendly: Record<FormationBlockingReason, string> = {
  PREVIOUS_STAGE_INCOMPLETE: 'Complete the previous stage first.',
  LESSONS_INCOMPLETE: 'Finish required lessons.',
  DOCUMENT_PENDING: 'Submit required documents or milestones.',
  VALIDATION_PENDING: 'Waiting for validation.',
  POINTS_REQUIREMENT_NOT_MET: 'More qualifying BUKLOD Points needed for this stage.',
  BAYANIHAN_REQUIREMENT_NOT_MET: 'More verified service actions needed for this stage.',
  REPEAT_REQUIRED: 'A repeat is required before you can continue.',
  STAGE_DISABLED: 'This stage is not available yet.',
  CURRICULUM_NOT_ASSIGNED: 'Your formation curriculum has not been assigned yet.',
};

const lessonBlockingExtraGuide: Record<string, string> = {
  STAGE_LOCKED: formationCopy.lessonStageLockedGuide,
  LESSON_NOT_RELEASED: formationCopy.lessonPendingReleaseGuide,
  CURRICULUM_NOT_ASSIGNED: formationCopy.curriculumPreparing,
  FORMATION_TRACK_NOT_ASSIGNED: formationCopy.trackAssignmentHint,
};

export function lessonBlockingGuide(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return lessonBlockingExtraGuide[code] ?? null;
}

const lessonBlockingFriendly: Record<string, string> = {
  LESSON_NOT_RELEASED: 'This lesson is not available yet.',
  PREREQUISITE_LESSON_INCOMPLETE: 'Complete the previous lesson first.',
  FORMATION_TRACK_NOT_ASSIGNED: 'Your formation track has not been assigned yet.',
  CURRICULUM_NOT_ASSIGNED: 'Your formation lessons are being prepared.',
  STAGE_LOCKED: 'Complete the previous stage first.',
  REPEAT_REQUIRED:
    'Your Pastor or Mentor has asked you to complete part of this formation again.',
};

export function friendlyLessonBlockingReason(code: string | null | undefined): string {
  if (!code) return formationCopy.continueLearning;
  return lessonBlockingFriendly[code] ?? friendlyBlockingReason(code);
}

export function friendlyBlockingReason(code: string): string {
  return (
    blockingFriendly[code as FormationBlockingReason] ??
    'Complete the remaining requirements to continue.'
  );
}

export function primaryActionLabel(code: string | null | undefined): string {
  if (!code) return formationCopy.continueLearning;
  return (
    formationCopy.primaryActions[code] ??
    formationCopy.continueLearning
  );
}

export const STAGE_SUBTITLES: Record<number, string> = {
  101: 'Preparation',
  102: 'Membership',
  103: 'Apprenticeship',
  104: 'Discipleship',
  105: 'Leadership',
  106: 'Workers Training',
  107: 'Mission Formation',
};

export const STAGE_PHASES: Record<number, string> = {
  101: 'PAGHAHANDA',
  102: 'PAGTATANIM',
  103: 'PAGPAPALALIM',
  104: 'PAGPAPATABA',
  105: 'PAMUMUNGA',
  106: 'KAMANGGAGAWA',
  107: 'PANG-MISYONG GAWAIN',
};
