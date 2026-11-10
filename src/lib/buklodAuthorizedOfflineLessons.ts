/**
 * Offline lessons must originate from server-confirmed permissions.
 * A track catalogue is not proof that every lesson was released.
 */
export type OfflineLessonGrant = {
  learning_lesson_id: string | null;
  calendar_released: boolean;
  access_allowed: boolean;
  approved: boolean;
};

export function selectAuthorizedOfflineLessonIds(input: {
  lessonIds: string[];
  isFormation: boolean;
  enrolled: boolean;
  sequential: boolean;
  access: Array<[string, { allowed: boolean }]>;
  weeklyStage: boolean;
  weekly: { delivery_assigned: boolean; lessons?: OfflineLessonGrant[] } | null;
}): { allowed: string[]; denied: string[] } {
  const known = new Set(input.lessonIds.filter(Boolean));
  const allowed = new Set<string>();
  const denied = new Set<string>();

  if (!input.isFormation) {
    if (input.enrolled) for (const id of known) allowed.add(id);
  } else if (input.sequential) {
    for (const [id, status] of input.access) {
      if (!known.has(id)) continue;
      if (status?.allowed === true) allowed.add(id);
      else if (status?.allowed === false) denied.add(id);
    }
  } else if (input.weeklyStage && input.weekly?.delivery_assigned) {
    for (const lesson of input.weekly.lessons ?? []) {
      const id = lesson.learning_lesson_id;
      if (!id || !known.has(id)) continue;
      if (lesson.access_allowed === true &&
          (lesson.calendar_released === true || lesson.approved === true)) {
        allowed.add(id);
      } else if (lesson.access_allowed === false) {
        denied.add(id);
      }
    }
  }
  for (const id of allowed) denied.delete(id);
  return { allowed: [...allowed], denied: [...denied] };
}
