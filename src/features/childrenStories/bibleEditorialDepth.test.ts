import { BIBLE_EXPANSION_STORIES, BIBLE_EXPANSION_LESSONS } from './bibleExpansion';
import { BIBLE_EDITORIAL_DEPTH_OLD } from './bibleEditorialDepthOld';
import { BIBLE_EDITORIAL_DEPTH_NEW_A } from './bibleEditorialDepthNewA';
import { BIBLE_EDITORIAL_DEPTH_NEW_B } from './bibleEditorialDepthNewB';

describe('All 132 grounded Sunday School Bible narratives', () => {
  const editorial = {
    ...BIBLE_EDITORIAL_DEPTH_OLD,
    ...BIBLE_EDITORIAL_DEPTH_NEW_A,
    ...BIBLE_EDITORIAL_DEPTH_NEW_B,
  };

  test('all 132 episodes have uniquely authored bilingual passage details', () => {
    expect(BIBLE_EXPANSION_STORIES).toHaveLength(132);
    expect(Object.keys(editorial).sort()).toEqual(BIBLE_EXPANSION_STORIES.map(item => item.id).sort());
    for (const story of BIBLE_EXPANSION_STORIES) {
      for (const language of ['tl','en'] as const) {
        expect(editorial[story.id][language].length).toBeGreaterThanOrEqual(200);
      }
    }
  });

  test('full screen reader and speech share complete in-story content without classroom Q&A', () => {
    for (const story of BIBLE_EXPANSION_STORIES) {
      const lesson = BIBLE_EXPANSION_LESSONS[story.id];
      expect(lesson).toBeTruthy();
      expect(lesson.questions).toHaveLength(3);
      expect(lesson.discussion).toHaveLength(2);
      expect(lesson.reference).toMatch(/[0-9]/);
      expect(lesson.retellingNotice?.tl).toContain('hindi ito eksaktong sipi');
      for (const language of ['tl','en'] as const) {
        const body = lesson.narrative[language];
        expect(body.length).toBeGreaterThanOrEqual(650);
        expect(body.split(/\\n\\s*\\n/).length).toBeGreaterThanOrEqual(4);
        expect(body).not.toMatch(/Pagkatapos ng kuwento, nagtanong ang guro|After the story, the teacher asked|tanong ng bata|paliwanag ng guro|sagot ng klase|the teacher asked|a child asks/i);
        const left = (body.match(/“/g) ?? []).length;
        const right = (body.match(/”/g) ?? []).length;
        expect(left).toBe(right);
      }
    }
  });

  test('canonical details are kept without fictional innkeeper or numbered Magi', () => {
    const wise = BIBLE_EXPANSION_LESSONS['mga-pantas'].narrative;
    expect(wise.tl).toContain('bahay');
    expect(wise.en).toContain('house');
    expect(wise.tl).not.toMatch(/tatlong pantas|tatlong hari/i);
    const dreams = BIBLE_EXPANSION_LESSONS['joseph-panaginip'].narrative;
    expect(dreams.tl).toContain('bigkis');
    expect(dreams.en).toContain('sheaf');
  });
});
