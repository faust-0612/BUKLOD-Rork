import { BUNDLED_CHILDREN_STORIES, STORY_CATEGORIES, findBundledStory, isValidChildrenStory, localize } from './catalog';

describe('BUKLOD Children Story World offline catalog', () => {
  test('12 unique original stories are bundled across the four categories', () => {
    expect(BUNDLED_CHILDREN_STORIES).toHaveLength(12);
    expect(new Set(BUNDLED_CHILDREN_STORIES.map(item => item.id)).size).toBe(12);
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
  test('invalid shapes cannot enter the editorial reader', () => {
    const original = BUNDLED_CHILDREN_STORIES[0];
    expect(isValidChildrenStory({...original, id:'../../elsewhere'})).toBe(false);
    expect(isValidChildrenStory({...original, pages:[]})).toBe(false);
    expect(isValidChildrenStory({...original, choices:[]})).toBe(false);
    expect(isValidChildrenStory({...original, answer:9})).toBe(false);
    expect(isValidChildrenStory({...original, minAge:1})).toBe(false);
  });
});
