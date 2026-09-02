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
  let done = 0;

  if (stage.lessons_complete !== undefined) {
    parts += 1;
    if (stage.lessons_complete) done += 1;
  }
  if (stage.documents_or_milestones_complete !== undefined) {
    parts += 1;
    if (stage.documents_or_milestones_complete) done += 1;
  }
  if ((stage.stage_points_required ?? 0) > 0) {
    parts += 1;
    if (stage.stage_points_met) done += 1;
  }
  if ((stage.stage_bayanihan_required ?? 0) > 0) {
    parts += 1;
    if (stage.stage_bayanihan_met) done += 1;
  }

  if (parts === 0) return 0;
  return Math.round((done / parts) * 100);
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
