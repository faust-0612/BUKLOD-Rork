import { BUNDLED_CHILDREN_STORIES } from './catalog';
import { getSundaySchoolLesson, SUNDAY_SCHOOL_LESSONS } from './sundaySchool';
import { SUNDAY_SCHOOL_DIALOGUES } from './sundaySchoolDialogues';
describe('Continuous bilingual Sunday School curriculum', () => {
  test('all twelve offline stories have full narratives, lessons, verse references and prayer', () => {
    expect(Object.keys(SUNDAY_SCHOOL_LESSONS)).toHaveLength(12);
    for (const story of BUNDLED_CHILDREN_STORIES) {
      const lesson = getSundaySchoolLesson(story);
      expect(lesson).toBeTruthy();
      if (!lesson) continue;
      for (const lang of ['tl','en'] as const) {
        expect(lesson.narrative[lang].trim().length).toBeGreaterThan(650);
        expect(lesson.moral[lang].length).toBeGreaterThan(35);
        expect(lesson.spiritual[lang].length).toBeGreaterThan(35);
        expect(lesson.prayer[lang].length).toBeGreaterThan(25);
      }
      expect(lesson.reference).toMatch(/[1-9]/);
      expect(lesson.discussion).toHaveLength(2);
      expect(lesson.questions).toHaveLength(3);
      for(const question of lesson.questions) {
        expect(question.choices).toHaveLength(3);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(3);
        expect(question.prompt.tl).toBeTruthy();
        expect(question.prompt.en).toBeTruthy();
        for(const option of question.choices) {
          expect(option.tl).toBeTruthy();
          expect(option.en).toBeTruthy();
        }
      }
    }
  });
  test('all lessons include dramatic bilingual conversations without altering original Sunday School questions', () => {
    expect(Object.values(SUNDAY_SCHOOL_DIALOGUES).flat().length).toBeGreaterThanOrEqual(45);
    for(const [id, scenes] of Object.entries(SUNDAY_SCHOOL_DIALOGUES)) {
      expect(scenes.length).toBeGreaterThanOrEqual(3);
      expect(SUNDAY_SCHOOL_LESSONS[id]).toBeTruthy();
    }
    const bibleStories = new Set(['david-at-ang-tapang','bangka-ng-pag-asa','ang-mabuting-kapitbahay','si-jonas-at-ang-dagat']);
    for (const story of BUNDLED_CHILDREN_STORIES) {
      const lesson = getSundaySchoolLesson(story);
      expect(lesson).toBeTruthy();
      if (!lesson) continue;
      for (const lang of ['tl','en'] as const) {
        expect(lesson.narrative[lang]).toMatch(/[“][^”]+[”]/);
        expect(lesson.narrative[lang].length).toBeGreaterThan(900);
      }
      if (bibleStories.has(story.id)) {
        expect(lesson.retellingNotice?.tl).toContain('hindi ito salita-sa-salitang');
        expect(lesson.retellingNotice?.en).toContain('not word-for-word');
      } else {
        expect(lesson.retellingNotice).toBeUndefined();
      }
    }
  });
  test('bundled lessons cannot silently attach to different published editorial revisions', () => {
    const story=BUNDLED_CHILDREN_STORIES[0];
    expect(getSundaySchoolLesson({...story,source:'published'})).toBeNull();
    expect(getSundaySchoolLesson(null)).toBeNull();
  });
});
