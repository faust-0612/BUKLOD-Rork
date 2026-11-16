import type { ChildrenStory } from './catalog';
import type { SundaySchoolLesson } from './sundaySchoolTypes';
import { LESSONS_A } from './sundaySchoolA';
import { LESSONS_B } from './sundaySchoolB';
import { LESSONS_C } from './sundaySchoolC';
import { BIBLE_EXPANSION_LESSONS } from './bibleExpansion';
import { SUNDAY_SCHOOL_DIALOGUES } from './sundaySchoolDialogues';
import { inStoryOnly } from './inStoryDialogue';

/** Complete bilingual Sunday School lessons for original and expanded narratives. The three original short pages
 * remain as a fallback for published/legacy stories; these are read continuously. */
function withStorytellingDialogue(id: string, lesson: SundaySchoolLesson): SundaySchoolLesson {
  const scenes = SUNDAY_SCHOOL_DIALOGUES[id] ?? [];
  if (!scenes.length) return lesson;
  const expand = (language: 'tl' | 'en') => lesson.narrative[language]
    .split(/\n\s*\n/)
    .map((paragraph, index) => [
      paragraph.trim(),
      ...scenes.filter(scene => scene.afterParagraph === index).map(scene => biblical ? inStoryOnly(scene.speech[language], language) : scene.speech[language]),
    ].filter(Boolean).join('\n\n'))
    .join('\n\n');
  const biblical = ['david-at-ang-tapang','bangka-ng-pag-asa','ang-mabuting-kapitbahay','si-jonas-at-ang-dagat'].includes(id);
  return { ...lesson, narrative: { tl: expand('tl'), en: expand('en') },
    ...(biblical ? { retellingNotice: {
      tl: 'Batay sa nakasaad na Biblia. May mga salitang isinadula o pinasimple para sa mga bata; hindi ito salita-sa-salitang sipi ng talata.',
      en: 'Based on the cited Scripture. Some conversations are dramatized or paraphrased for children, not word-for-word quotations of Bible verses.',
    } } : {}),
  };
}
/** Retain ALL expanded Bible narratives, quiz keys and offline lessons from Nov16 Henry staging. */
export const SUNDAY_SCHOOL_LESSONS: Record<string,SundaySchoolLesson> = Object.fromEntries(
  Object.entries({ ...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...BIBLE_EXPANSION_LESSONS })
    .map(([id,lesson]) => [id, withStorytellingDialogue(id, lesson)])
);
/** Never attach bundled teaching text to a remotely edited story with the same slug. */
export function getSundaySchoolLesson(story: ChildrenStory | null | undefined): SundaySchoolLesson | null {
  return story?.source === 'bundled' ? (SUNDAY_SCHOOL_LESSONS[story.id] ?? null) : null;
}
