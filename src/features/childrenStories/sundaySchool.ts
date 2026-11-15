import type { ChildrenStory } from './catalog';
import type { SundaySchoolLesson } from './sundaySchoolTypes';
import { LESSONS_A } from './sundaySchoolA';
import { LESSONS_B } from './sundaySchoolB';
import { LESSONS_C } from './sundaySchoolC';
import { SUNDAY_SCHOOL_DIALOGUES } from './sundaySchoolDialogues';

/** Compose original continuous story paragraphs with character dialogue in
 * sequence. This is a display-and-narration transformation: the same complete
 * text is read aloud, so the voice never skips conversations. */
function withStorytellingDialogue(id: string, lesson: SundaySchoolLesson): SundaySchoolLesson {
  const scenes = SUNDAY_SCHOOL_DIALOGUES[id] ?? [];
  if (!scenes.length) return lesson;
  const expand = (language: 'tl' | 'en') => lesson.narrative[language]
    .split(/\n\s*\n/)
    .map((paragraph, index) => [
      paragraph.trim(),
      ...scenes.filter(scene => scene.afterParagraph === index).map(scene => scene.speech[language]),
    ].filter(Boolean).join('\n\n'))
    .join('\n\n');
  const biblicalStory = ['david-at-ang-tapang', 'bangka-ng-pag-asa',
    'ang-mabuting-kapitbahay', 'si-jonas-at-ang-dagat'].includes(id);
  return {
    ...lesson,
    narrative: { tl: expand('tl'), en: expand('en') },
    ...(biblicalStory ? { retellingNotice: {
      tl: 'Batay sa nakasaad na Biblia. May mga salitang isinadula o pinasimple para sa mga bata; hindi ito salita-sa-salitang sipi ng talata.',
      en: 'Based on the cited Scripture. Some conversations are dramatized or paraphrased for children, not word-for-word quotations of Bible verses.',
    } } : {}),
  };
}

/** Twelve complete, bilingual Sunday School lessons, with naturally placed
 * spoken dialogue and unchanged moral, spiritual, prayer and quiz contracts. */
export const SUNDAY_SCHOOL_LESSONS: Record<string, SundaySchoolLesson> = Object.fromEntries(
  Object.entries({ ...LESSONS_A, ...LESSONS_B, ...LESSONS_C }).map(
    ([id, lesson]) => [id, withStorytellingDialogue(id, lesson)]
  )
);
/** Never attach bundled teaching text to a remotely edited story with the same slug. */
export function getSundaySchoolLesson(story: ChildrenStory | null | undefined): SundaySchoolLesson | null {
  return story?.source === 'bundled' ? (SUNDAY_SCHOOL_LESSONS[story.id] ?? null) : null;
}
