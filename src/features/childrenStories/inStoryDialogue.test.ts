import { BIBLE_EXPANSION_STORIES, BIBLE_EXPANSION_LESSONS } from './bibleExpansion';
import { inStoryOnly, REVISED_BIBLICAL_SCENES } from './inStoryDialogue';

describe('Biblical dialogue belongs inside the story, not in an invented classroom exchange', () => {
  test('all 132 added Bible narratives keep separate discussion and stop appending post-story class dialogue', () => {
    expect(BIBLE_EXPANSION_STORIES).toHaveLength(132);
    for (const story of BIBLE_EXPANSION_STORIES) {
      const lesson = BIBLE_EXPANSION_LESSONS[story.id];
      expect(lesson).toBeTruthy();
      for (const language of ['tl', 'en'] as const) {
        const narrative = lesson.narrative[language];
        expect(narrative.length).toBeGreaterThan(350);
        expect(narrative).not.toMatch(/Pagkatapos ng kuwento, nagtanong ang guro|After the story, the teacher asked/i);
        expect(narrative).not.toMatch(/tanong ng bata|paliwanag ng guro|sagot ng guro|sagot ng klase|the teacher (asked|explains|said)|(?:a|the) child (asks|said|wondered)/i);
        expect(lesson.discussion.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
  test('the two reported Genesis episodes use dialogue from the biblical action', () => {
    expect(REVISED_BIBLICAL_SCENES['joseph-panaginip']).toHaveLength(4);
    expect(REVISED_BIBLICAL_SCENES['abraham-bituin']).toHaveLength(4);
    for (const id of ['joseph-panaginip', 'abraham-bituin']) {
      const lesson = BIBLE_EXPANSION_LESSONS[id];
      expect(lesson.narrative.tl).not.toMatch(/guro|klase/);
      expect(lesson.narrative.en).not.toMatch(/teacher|classroom/);
      expect(lesson.narrative.tl).toMatch(/“[^”]+”/);
      expect(lesson.narrative.en).toMatch(/“[^”]+”/);
    }
    expect(BIBLE_EXPANSION_LESSONS['joseph-panaginip'].narrative.tl).toContain('bigkis');
    expect(BIBLE_EXPANSION_LESSONS['abraham-bituin'].narrative.tl).toContain('bituin');
  });
  test('classroom censorship stops at the first exchange, preserving spoken Bible scene', () => {
    const scene='Sinabi ni Jose: “Nanaginip ako tungkol sa trigo.” “Bakit?” tanong ng bata. “Makinig,” sagot ng guro.';
    expect(inStoryOnly(scene, 'tl')).toBe('Sinabi ni Jose: “Nanaginip ako tungkol sa trigo.”');
    const english='Joseph answered: “I had a dream.” “Why?” a child asks. “Listen,” the teacher says.';
    expect(inStoryOnly(english, 'en')).toBe('Joseph answered: “I had a dream.”');
  });
});
