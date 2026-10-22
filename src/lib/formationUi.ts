import type { FormationJourneyStage } from '@/types/buklodFormation';

export type FormationCardStatus =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'AWAITING_VALIDATION'
  | 'REPEAT_REQUIRED'
  | 'COMPLETE'
  | 'HISTORICALLY_LOCKED';

export function mapStageCardStatus(
  stage: FormationJourneyStage,
): FormationCardStatus {
  if (stage.status === 'historically_complete_locked') {
    return 'HISTORICALLY_LOCKED';
  }
  if (stage.completed || stage.status === 'completed') {
    return 'COMPLETE';
  }
  if (stage.repeat_required || stage.status === 'repeat_required') {
    return 'REPEAT_REQUIRED';
  }
  if (!stage.access_allowed || stage.is_locked) {
    return 'LOCKED';
  }
  if (stage.next_action === 'VALIDATION_PENDING') {
    return 'AWAITING_VALIDATION';
  }
  if (stage.current || stage.status === 'current') {
    return 'IN_PROGRESS';
  }
  return 'AVAILABLE';
}

export function stageProgressPercent(stage: FormationJourneyStage): number {
  const expected = Number(stage.progress?.expected_lessons ?? 0);
  const approved = Number(stage.progress?.approved_lessons ?? 0);
  if (expected > 0) {
    return Math.min(100, Math.round((approved / expected) * 100));
  }

  let parts = 0;
  let progressTotal = 0;

  if (stage.lessons_complete !== undefined) {
    parts += 1;
    progressTotal += stage.lessons_complete ? 1 : 0;
  }
  if (stage.documents_or_milestones_complete !== undefined) {
    parts += 1;
    progressTotal += stage.documents_or_milestones_complete ? 1 : 0;
  }

  const pointsRequired = Number(stage.stage_points_required ?? 0);
  if (pointsRequired > 0) {
    parts += 1;
    const pointsCurrent = Number(stage.stage_points_current ?? 0);
    progressTotal += Math.max(0, Math.min(1, pointsCurrent / pointsRequired));
  }

  const bayanihanRequired = Number(stage.stage_bayanihan_required ?? 0);
  if (bayanihanRequired > 0) {
    parts += 1;
    const bayanihanCurrent = Number(stage.stage_bayanihan_current ?? 0);
    progressTotal += Math.max(
      0,
      Math.min(1, bayanihanCurrent / bayanihanRequired),
    );
  }

  if (parts === 0) return 0;
  return Math.min(99, Math.round((progressTotal / parts) * 100));
}

export function statusLabel(status: FormationCardStatus): string {
  switch (status) {
    case 'LOCKED':
      return 'Locked';
    case 'AVAILABLE':
      return 'Available';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'AWAITING_VALIDATION':
      return 'Awaiting Validation';
    case 'REPEAT_REQUIRED':
      return 'Repeat Required';
    case 'COMPLETE':
      return 'Complete';
    case 'HISTORICALLY_LOCKED':
      return 'Completed Previously';
    default:
      return 'In Progress';
  }
}
