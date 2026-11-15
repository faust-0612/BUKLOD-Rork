import type { ChildrenStory } from './catalog';
import type { SundaySchoolLesson } from './sundaySchoolTypes';
import { LESSONS_A } from './sundaySchoolA';
import { LESSONS_B } from './sundaySchoolB';
import { LESSONS_C } from './sundaySchoolC';

/** Twelve complete bilingual Sunday School lessons. The three original short pages
 * remain as a fallback for published/legacy stories; these are read continuously. */
export const SUNDAY_SCHOOL_LESSONS: Record<string, SundaySchoolLesson> = {
  ...LESSONS_A, ...LESSONS_B, ...LESSONS_C,
};
/** Never attach bundled teaching text to a remotely edited story with the same slug. */
export function getSundaySchoolLesson(story: ChildrenStory | null | undefined): SundaySchoolLesson | null {
  return story?.source === 'bundled' ? (SUNDAY_SCHOOL_LESSONS[story.id] ?? null) : null;
}
