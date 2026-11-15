import type { ChildrenStory, StoryLocalized } from './catalog';
import type { SundaySchoolLesson, SundaySchoolQuestion } from './sundaySchoolTypes';

/** Bundled original retellings. No outside downloads, AI calls, child profile or ads. */
export type BibleCurriculumSeed = {
  id: string;
  emoji: string;
  age: 3 | 6 | 9;
  title: StoryLocalized;
  reference: string;
  narrative: StoryLocalized;
  moral: StoryLocalized;
  spiritual: StoryLocalized;
  prayer: StoryLocalized;
  event: { question: StoryLocalized; correct: StoryLocalized; wrong: [StoryLocalized, StoryLocalized] };
  lessonAnswer: StoryLocalized;
  application: StoryLocalized;
};

const loc = (tl: string, en: string): StoryLocalized => ({ tl, en });
const question = (prompt: StoryLocalized, correct: StoryLocalized, wrong: [StoryLocalized, StoryLocalized], position: 0|1|2): SundaySchoolQuestion => ({
  prompt,
  choices: position === 0 ? [correct, ...wrong] : position === 1 ? [wrong[0], correct, wrong[1]] : [...wrong, correct],
  answer: position,
});

/** Each original story remains a single continuous narrated narrative, not a page slideshow. */
export function createBibleCurriculum(seeds: BibleCurriculumSeed[]) {
  const stories: ChildrenStory[] = [];
  const lessons: Record<string, SundaySchoolLesson> = {};
  for (const seed of seeds) {
    const tl = seed.narrative.tl.trim().split(/\n\s*\n/);
    const en = seed.narrative.en.trim().split(/\n\s*\n/);
    if (tl.length !== 3 || en.length !== 3 || tl.some(p=>!p.trim()) || en.some(p=>!p.trim()))
      throw new Error('Bible story needs exactly three complete narrative sections: ' + seed.id);
    if (lessons[seed.id]) throw new Error('Duplicate Bible curriculum story: '+seed.id);
    const eventQuestion = question(seed.event.question,seed.event.correct,seed.event.wrong,0);
    stories.push({
      id:seed.id,category:'Bible',minAge:seed.age,maxAge:12,
      emoji:seed.emoji,palette:['#20594E','#A5CCAD'],
      title:seed.title,summary:seed.moral,
      pages:tl.map((text,i)=>({text:{tl:text.trim(),en:en[i].trim()}})),
      question:eventQuestion.prompt,choices:eventQuestion.choices,answer:eventQuestion.answer,
      version:1,source:'bundled',
    });
    lessons[seed.id] = {
      narrative:seed.narrative,moral:seed.moral,spiritual:seed.spiritual,
      reference:seed.reference,prayer:seed.prayer,
      discussion:[
        loc('Ano ang pinakamahirap na pasiya sa kuwento? Bakit?','What was the hardest decision in the story? Why?'),
        loc('Paano mo maipapakita sa tahanan ang aral mula sa '+seed.title.tl+'?',
          'How can you live out the lesson from '+seed.title.en+' at home?'),
      ],
      questions:[
        question(loc('Aling aral ang pinatitingkad ng kuwentong ito?','Which teaching does this story emphasize?'),
          seed.lessonAnswer,[loc('Sariling yabang lang ang mahalaga','Only our pride matters'),loc('Walang pananagutan sa kapwa','We have no responsibility to others')],1),
        question(loc('Ano ang ipinapakita ng kuwento tungkol sa Diyos?','What does this story reveal about God?'),
          seed.spiritual,[loc('Walang pakialam ang Diyos sa tao','God does not care about people'),loc('Laging panalo ang pinakamalakas','The strongest person always wins')],2),
        question(loc('Anong mabuting hakbang ang maaari mong gawin?','What good action can you take?'),
          seed.application,[loc('Manakit o manisi ng iba','Hurt or blame others'),loc('Huwag makinig sa nangangailangan','Ignore those who need help')],0),
      ],
    };
  }
  return { stories, lessons };
}
