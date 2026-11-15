import type { StoryLocalized } from './catalog';

export type SundaySchoolQuestion = {
  prompt: StoryLocalized;
  choices: [StoryLocalized, StoryLocalized, StoryLocalized];
  answer: 0 | 1 | 2;
};
export type SundaySchoolLesson = {
  narrative: StoryLocalized;
  retellingNotice?: StoryLocalized;
  moral: StoryLocalized;
  spiritual: StoryLocalized;
  reference: string;
  prayer: StoryLocalized;
  discussion: StoryLocalized[];
  questions: SundaySchoolQuestion[];
};
