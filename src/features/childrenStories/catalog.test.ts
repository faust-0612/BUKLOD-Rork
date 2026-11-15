import { BUNDLED_CHILDREN_STORIES, STORY_CATEGORIES, findBundledStory, isValidChildrenStory, localize } from './catalog';
import { BIBLE_STORY_METADATA, BIBLE_EXPANSION_LESSONS, BIBLE_EXPANSION_STORIES } from './bibleExpansion';

describe('BUKLOD Children Story World offline catalog', () => {
  test('144 unique original stories are bundled across the four categories', () => {
    expect(BUNDLED_CHILDREN_STORIES).toHaveLength(144);
    expect(new Set(BUNDLED_CHILDREN_STORIES.map(item => item.id)).size).toBe(144);
    expect(new Set(BUNDLED_CHILDREN_STORIES.map(item => item.category))).toEqual(new Set(STORY_CATEGORIES));
  });
  test.each(BUNDLED_CHILDREN_STORIES.map(s => [s.id,s] as const))('%s is age-safe, bilingual, complete and usable offline', (_id,story) => {
    expect(isValidChildrenStory(story)).toBe(true);
    expect(story.pages).toHaveLength(3);
    expect(story.choices).toHaveLength(3);
    expect(story.choices[story.answer].tl.length).toBeGreaterThan(0);
    expect(story.choices[story.answer].en.length).toBeGreaterThan(0);
    expect(localize(story.title,'tl')).toBeTruthy();
    expect(localize(story.title,'en')).toBeTruthy();
    expect(findBundledStory(story.id)).toBe(story);
  });
  test('132 added Bible narratives have original references and complete offline lesson format', () => {
    expect(BIBLE_EXPANSION_STORIES).toHaveLength(132);
    expect(Object.keys(BIBLE_EXPANSION_LESSONS)).toHaveLength(132);
    expect(new Set(Object.values(BIBLE_STORY_METADATA).map(m=>m.testament))).toEqual(new Set(['old','new']));
    for(const story of BIBLE_EXPANSION_STORIES) {
      const lesson=BIBLE_EXPANSION_LESSONS[story.id];
      expect(lesson).toBeTruthy();
      expect(lesson.reference).toBe(BIBLE_STORY_METADATA[story.id].reference);
      expect(lesson.narrative.tl.length).toBeGreaterThan(130);
      expect(lesson.narrative.en.length).toBeGreaterThan(130);
      expect(lesson.narrative.tl.split('\n\n')).toHaveLength(3);
      expect(lesson.discussion.length).toBeGreaterThanOrEqual(2);
      expect(lesson.questions.length).toBeGreaterThanOrEqual(3);
      expect(story.category).toBe('Bible');
    }
  });
  test('invalid shapes cannot enter the editorial reader', () => {
    const original = BUNDLED_CHILDREN_STORIES[0];
    expect(isValidChildrenStory({...original, id:'../../elsewhere'})).toBe(false);
    expect(isValidChildrenStory({...original, pages:[]})).toBe(false);
    expect(isValidChildrenStory({...original, choices:[]})).toBe(false);
    expect(isValidChildrenStory({...original, answer:9})).toBe(false);
    expect(isValidChildrenStory({...original, minAge:1})).toBe(false);
  });
});
