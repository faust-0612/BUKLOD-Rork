import type { ChildrenStory, StoryLocalized } from './catalog';
import type { SundaySchoolLesson, SundaySchoolQuestion } from './sundaySchoolTypes';
import { BIBLE_OLD_RECORDS } from './bibleExpansionOld';
import { BIBLE_NEW_RECORDS } from './bibleExpansionNew';
import { BIBLE_EXPANSION_DIALOGUES_OLD } from './bibleExpansionDialoguesOld';
import { BIBLE_EXPANSION_DIALOGUES_NEW_A } from './bibleExpansionDialoguesNewA';
import { BIBLE_EXPANSION_DIALOGUES_NEW_B } from './bibleExpansionDialoguesNewB';
import { inStoryOnly, REVISED_BIBLICAL_SCENES } from './inStoryDialogue';
import { BIBLE_EDITORIAL_DEPTH_OLD } from './bibleEditorialDepthOld';
import { BIBLE_EDITORIAL_DEPTH_NEW_A } from './bibleEditorialDepthNewA';
import { BIBLE_EDITORIAL_DEPTH_NEW_B } from './bibleEditorialDepthNewB';

/** Original, offline, book-referenced children's adaptations; not verbatim Bible translations.
 * Narratives are not standalone translations. Consult each canonical passage for details.
 */
export type BibleTestament = 'old' | 'new';
type BibleRecord = {
  id: string; book: string; reference: string; emoji: string;
  title: StoryLocalized; testament: BibleTestament;
  acts: readonly StoryLocalized[]; moral?: StoryLocalized;
};
const RAW_BIBLE_RECORDS: readonly BibleRecord[] = [...BIBLE_OLD_RECORDS, ...BIBLE_NEW_RECORDS];
const EXPANDED_DIALOGUE: Record<string,readonly [string,string,string,string]> = {
  ...BIBLE_EXPANSION_DIALOGUES_OLD,
  ...BIBLE_EXPANSION_DIALOGUES_NEW_A,
  ...BIBLE_EXPANSION_DIALOGUES_NEW_B,
};
/** Editor-reviewed, scripture-specific scene detail for all 132 episodes.
 * Unlike the old auto-generated classroom appendix, this stays inside the
 * narrated story. Longer authored character exchanges take precedence.
 */
/** Short parables and apostolic teaching do not have historical student/teacher dialogue. */
const NON_DIALOGUE_PASSAGES = new Set(['buto-mustasa', 'bunga-espiritu']);
const EDITORIAL_DEPTH: Record<string,{tl:string;en:string}> = {
  ...BIBLE_EDITORIAL_DEPTH_OLD,
  ...BIBLE_EDITORIAL_DEPTH_NEW_A,
  ...BIBLE_EDITORIAL_DEPTH_NEW_B,
};
/** The on-screen complete narrative and the existing TTS player consume this exact
 * text; a missing scene fails the build's regression gate, never a user session.
 * Bible-person speech below is explicitly a pedagogical paraphrase. */
function expandBibleNarrative(entry: BibleRecord, language: 'tl' | 'en'): string {
  const dialogue = REVISED_BIBLICAL_SCENES[entry.id] ?? EXPANDED_DIALOGUE[entry.id];
  const passages: string[] = [];
  entry.acts.forEach((act, index) => {
    if (!(REVISED_BIBLICAL_SCENES[entry.id] && index === 1)) passages.push(act[language]);
    if (index < 2 && dialogue && !NON_DIALOGUE_PASSAGES.has(entry.id)) {
      // Preserve the words spoken in the biblical scene; never insert the
      // teacher/classroom discussion into the full story or its TTS audio.
      passages.push(inStoryOnly(dialogue[index * 2 + (language === 'en' ? 1 : 0)], language));
    }
    if (index === 1 && !REVISED_BIBLICAL_SCENES[entry.id] && EDITORIAL_DEPTH[entry.id]) {
      passages.push(EDITORIAL_DEPTH[entry.id][language]);
    }
  });
  return passages.filter(Boolean).join('\n\n');
}

export type BibleStoryMetadata = { testament: BibleTestament; book: string; reference: string };
export const BIBLE_STORY_METADATA: Record<string,BibleStoryMetadata> = Object.fromEntries(
  RAW_BIBLE_RECORDS.map(entry=>[entry.id,{testament:entry.testament,book:entry.book,reference:entry.reference}])
);
Object.assign(BIBLE_STORY_METADATA,{
  'david-at-ang-tapang':{testament:'old',book:'1 Samuel',reference:'1 Samuel 17:1–50'},
  'bangka-ng-pag-asa':{testament:'old',book:'Genesis',reference:'Genesis 6–9'},
  'si-jonas-at-ang-dagat':{testament:'old',book:'Jonah',reference:'Jonah 1–4'},
  'ang-mabuting-kapitbahay':{testament:'new',book:'Luke',reference:'Luke 10:25–37'},
});
const NEW_MORALS: Record<string,StoryLocalized> = {
  "zacharias-elisabet": {
    "tl": "Ang pag-asa ay maaaring manatili kahit mahaba ang paghihintay.",
    "en": "Hope can remain alive during a long wait."
  },
  "maria-anghel": {
    "tl": "Maaaring magtanong nang tapat at tumugon nang may tapang.",
    "en": "We can ask honest questions and respond with courage."
  },
  "joseph-panaginip-bethlehem": {
    "tl": "Pangalagaan ang pamilya at huwag manghiya ng tao.",
    "en": "Protect family members and avoid shaming others."
  },
  "kapanganakan-hesus": {
    "tl": "Hindi nakasalalay sa kayamanan ang halaga ng isang tao.",
    "en": "A person's worth does not depend on wealth."
  },
  "mga-pastol": {
    "tl": "Ang mabuting balita ay para rin sa karaniwang manggagawa.",
    "en": "Good news is for ordinary people too."
  },
  "mga-pantas": {
    "tl": "Maging mapagmasid at umiwas sa mapanganib na panlilinlang.",
    "en": "Be observant and avoid dangerous deception."
  },
  "paglikas-egipto": {
    "tl": "Unahin ang kaligtasan ng mga bata at mga pamilyang nasa panganib.",
    "en": "Put the safety of children and endangered families first."
  },
  "jesus-templo-bata": {
    "tl": "Magtanong at matuto habang iginagalang ang tagapag-alaga.",
    "en": "Ask questions and learn while respecting caregivers."
  },
  "juan-binyag": {
    "tl": "Magsisi at maghanda para sa mabuting pagbabago.",
    "en": "Repent and prepare for good change."
  },
  "tukso-ilang": {
    "tl": "Huwag magpadala sa mapanlinlang at mapanganib na tukso.",
    "en": "Resist harmful and deceptive pressure."
  },
  "unang-alagad": {
    "tl": "Matutong sumunod sa mabuting paanyaya nang may pananagutan.",
    "en": "Respond responsibly to a good invitation."
  },
  "kasal-cana": {
    "tl": "Pansinin ang pangangailangan ng iba sa gitna ng pagdiriwang.",
    "en": "Notice others' needs even during celebrations."
  },
  "nicodemus": {
    "tl": "Hindi nakakahiya ang magtanong upang makaunawa.",
    "en": "There is no shame in asking to understand."
  },
  "samaritana-balon": {
    "tl": "Makipag-usap nang may dignidad kahit magkaiba ang pinagmulan.",
    "en": "Speak with dignity across differences."
  },
  "anak-opisyal": {
    "tl": "Ang mapagmahal na magulang ay naghahanap ng tulong para sa anak.",
    "en": "A caring parent seeks help for a child."
  },
  "bubong-may-sakit": {
    "tl": "Ang tunay na kaibigan ay nagsisikap tumulong nang ligtas.",
    "en": "True friends find safe ways to help."
  },
  "leprosy-healed": {
    "tl": "Igalang ang tao kahit siya ay may karamdaman.",
    "en": "Respect people even when they are ill."
  },
  "sentrion": {
    "tl": "Gamitin ang awtoridad upang alagaan ang iba.",
    "en": "Use authority to care for others."
  },
  "pagpapala-bundok": {
    "tl": "Mahalaga ang pagpapakumbaba, awa at paggawa ng kapayapaan.",
    "en": "Humility, mercy, and peacemaking matter."
  },
  "panalangin-ama": {
    "tl": "Manalangin nang tapat, hindi upang magpasikat.",
    "en": "Pray sincerely, not to impress people."
  },
  "matalino-bahay": {
    "tl": "Isabuhay ang mabuting aral, hindi lang pakinggan.",
    "en": "Practice good teaching rather than only hearing it."
  },
  "manghahasik": {
    "tl": "Pangalagaan ang natutuhan upang lumago sa mabuting gawa.",
    "en": "Nurture good teaching so it grows into action."
  },
  "nawawalang-tupa": {
    "tl": "Mahalaga ang bawat taong nangangailangan ng tulong.",
    "en": "Every person needing help matters."
  },
  "nawawalang-barya": {
    "tl": "Huwag maliitin ang halaga ng isang tao.",
    "en": "Never dismiss the worth of one person."
  },
  "alibughang-anak": {
    "tl": "Ang paghingi ng tawad ay may kasamang pagbabalik at pagbabago.",
    "en": "Apology involves returning and changing."
  },
  "di-nagpatawad-lingkod": {
    "tl": "Ang tumatanggap ng awa ay dapat matutong maawa rin.",
    "en": "Those who receive mercy should show mercy."
  },
  "mayamang-hangal": {
    "tl": "Mas mahalaga ang buhay at pagbabahagi kaysa pag-iimbak.",
    "en": "Life and generosity matter more than hoarding."
  },
  "buto-mustasa": {
    "tl": "Maaaring lumago ang maliliit na gawa ng kabutihan.",
    "en": "Small acts of goodness can grow."
  },
  "nakatagong-yaman": {
    "tl": "Matutong kilalanin ang tunay na mahalaga.",
    "en": "Learn to recognize what matters most."
  },
  "sampung-dalaga": {
    "tl": "Maghanda nang responsable sa mga gawaing mahalaga.",
    "en": "Prepare responsibly for important duties."
  },
  "talento": {
    "tl": "Gamitin nang tapat ang ipinagkatiwalang kakayahan.",
    "en": "Use entrusted abilities faithfully."
  },
  "mga-bata-jesus": {
    "tl": "Dapat igalang, pakinggan at protektahan ang mga bata.",
    "en": "Children deserve respect, attention, and protection."
  },
  "tinapay-isda": {
    "tl": "Magbahagi ng pagkain at huwag itong sayangin.",
    "en": "Share food and do not waste it."
  },
  "bagyo-tumahimik": {
    "tl": "Sa panganib, humingi ng tulong at manatiling ligtas.",
    "en": "In danger, seek help and stay safe."
  },
  "lumakad-tubig": {
    "tl": "Ang paghingi ng tulong ay tanda ng karunungan.",
    "en": "Asking for help shows wisdom."
  },
  "jairus-anak": {
    "tl": "Samahan ang nag-aalala at nagdadalamhati.",
    "en": "Support people facing fear and grief."
  },
  "babae-gumaling": {
    "tl": "Pakinggan at igalang ang taong may sakit.",
    "en": "Listen to and respect people who are ill."
  },
  "bulag-bartimeo": {
    "tl": "Huwag patahimikin ang taong humihingi ng tulong.",
    "en": "Do not silence people asking for help."
  },
  "mabuting-pastol": {
    "tl": "Ang mahusay na lider ay nag-aaruga, hindi nananamantala.",
    "en": "Good leaders care rather than exploit."
  },
  "pagbabagong-anyo": {
    "tl": "Mahalagang makinig bago magsalita o kumilos.",
    "en": "Listening matters before speaking or acting."
  },
  "marta-maria": {
    "tl": "Balansehin ang paggawa at panahon para makinig.",
    "en": "Balance practical work with time to listen."
  },
  "zacchaeus": {
    "tl": "Ipakita ang pagbabago sa pag-amin at pagbabayad sa mali.",
    "en": "Show change by admitting and correcting wrongs."
  },
  "mayamang-binata": {
    "tl": "Huwag gawing sentro ng buhay ang ari-arian.",
    "en": "Do not make possessions the center of life."
  },
  "sampung-ketongin": {
    "tl": "Alalahaning magpasalamat sa pagtanggap ng tulong.",
    "en": "Remember to give thanks when helped."
  },
  "lazarus": {
    "tl": "Hindi kahinaan ang pag-iyak sa pagluluksa.",
    "en": "Grieving tears are not weakness."
  },
  "paghuhugas-paa": {
    "tl": "Ang dakilang pinuno ay handang maglingkod.",
    "en": "Great leaders are willing to serve."
  },
  "huling-hapunan": {
    "tl": "Alalahanin ang pagmamahal at sakripisyo ni Jesus.",
    "en": "Remember Jesus' love and sacrifice."
  },
  "getsemani": {
    "tl": "Maaaring ipahayag nang tapat ang lungkot at takot.",
    "en": "It is okay to express grief and fear honestly."
  },
  "pagdakip-jesus": {
    "tl": "Iwasan ang karahasan kahit may matinding alitan.",
    "en": "Reject violence even during serious conflict."
  },
  "peter-pagtanggi": {
    "tl": "Maaaring magsisi at magbago matapos ang kabiguan.",
    "en": "People can repent and change after failure."
  },
  "krus": {
    "tl": "Maging mahabagin sa nagdurusa at huwag manakit.",
    "en": "Show compassion for suffering and reject cruelty."
  },
  "libing-jesus": {
    "tl": "Alagaan at samahan ang mga taong nagluluksa.",
    "en": "Care for and accompany those who grieve."
  },
  "walang-lamang-libingan": {
    "tl": "Maaaring magkaroon ng pag-asa matapos ang lungkot.",
    "en": "Hope can come after sorrow."
  },
  "emmaus": {
    "tl": "Makinig sa kapwa at magbahagi ng pag-asa.",
    "en": "Listen to others and share hope."
  },
  "tomas": {
    "tl": "Maaaring magtanong nang may paggalang habang naghahanap ng katotohanan.",
    "en": "Respectful questions can help us seek truth."
  },
  "almusal-dagat": {
    "tl": "May pagkakataong maglingkod muli matapos ang pagkakamali.",
    "en": "There can be new chances to serve after mistakes."
  },
  "dakilang-utos": {
    "tl": "Ibahagi ang pananampalataya nang may paggalang at walang pamimilit.",
    "en": "Share faith with respect, without coercion."
  },
  "pag-akyat": {
    "tl": "Magpatuloy sa mabuting tungkulin habang naghihintay.",
    "en": "Continue meaningful work while waiting."
  },
  "pentecostes": {
    "tl": "Makipag-unawaan sa mga taong may ibang wika.",
    "en": "Build understanding across languages."
  },
  "unang-iglesya": {
    "tl": "Magbahagi nang malaya at pangalagaan ang nangangailangan.",
    "en": "Share freely and care for those in need."
  },
  "magandang-pinto": {
    "tl": "Tingnan ang dignidad ng taong humihingi ng tulong.",
    "en": "See the dignity of those who ask for help."
  },
  "stephen": {
    "tl": "Tumindig sa tama nang hindi gumaganti ng karahasan.",
    "en": "Stand for what is right without retaliating violently."
  },
  "felipe-etiopia": {
    "tl": "Magtanong at makinig sa taong may ibang kultura.",
    "en": "Ask and listen across cultures."
  },
  "saul-damasco": {
    "tl": "Ang tunay na pagsisisi ay pagtigil sa pananakit.",
    "en": "Real repentance means ending harmful behavior."
  },
  "cornelius-pedro": {
    "tl": "Huwag magtangi dahil sa pinagmulan o kultura.",
    "en": "Do not discriminate based on background or culture."
  },
  "pedro-bilangguan": {
    "tl": "Maging mapagmalasakit sa kaibigang nahihirapan.",
    "en": "Care for friends in hardship."
  },
  "barnabas-paulo": {
    "tl": "Palakasin ang loob ng taong nagsisikap magbago.",
    "en": "Encourage people working toward change."
  },
  "lydia": {
    "tl": "Maging mapagpatuloy nang ligtas at kusang-loob.",
    "en": "Practice safe and voluntary hospitality."
  },
  "bantay-piitan": {
    "tl": "Unahin ang kaligtasan at malasakit sa oras ng panganib.",
    "en": "Put safety and compassion first during danger."
  },
  "paulo-athens": {
    "tl": "Makipag-usap nang magalang sa hindi kapareho ng paniniwala.",
    "en": "Discuss differing beliefs respectfully."
  },
  "paulo-bagyo": {
    "tl": "Makinig sa babala at tumulong sa oras ng sakuna.",
    "en": "Heed warnings and help during disasters."
  },
  "timoteo-kabataan": {
    "tl": "Maaaring maging mabuting halimbawa ang kabataan.",
    "en": "Young people can set good examples."
  },
  "bunga-espiritu": {
    "tl": "Sanayin araw-araw ang pag-ibig at pagpipigil sa sarili.",
    "en": "Practice love and self-control every day."
  },
  "baluti-diyos": {
    "tl": "Gamitin ang katotohanan, katarungan at kapayapaan laban sa mali.",
    "en": "Stand against wrong through truth, justice, and peace."
  },
  "bagong-langit-lupa": {
    "tl": "Maging mapag-asa at mag-ambag sa kapayapaan ngayon.",
    "en": "Keep hope and work for peace today."
  }
};
const FOR_YOUNGER = new Set(['paglikha','baby-moses','ruth-naomi','kapanganakan-hesus','mga-pastol','mga-pantas','mga-bata-jesus','tinapay-isda','nawawalang-tupa','buto-mustasa']);
const SENSITIVE = new Set(['eden','cain-abel','sampung-salot','paskuwa','jerico','samson','elijah-carmel','job','apoy-tatlong-kaibigan','stephen','krus','libing-jesus','pagdakip-jesus','jairus-anak','lazarus','paglikas-egipto']);
const LOW: [string,string] = ['#275F74','#8AD0BB'];
const HIGH: [string,string] = ['#315B51','#D8A66F'];
const local=(tl:string,en:string):StoryLocalized=>({tl,en});
function teachingValue(entry:BibleRecord):StoryLocalized {
  return entry.moral ?? NEW_MORALS[entry.id] ?? local('Maging maingat at makatao sa araw-araw.','Act wisely and compassionately each day.');
}
function rotated(correct:StoryLocalized, wrongA:StoryLocalized, wrongB:StoryLocalized, shift:number){
  const choices: [StoryLocalized,StoryLocalized,StoryLocalized] = [wrongA,wrongB,correct];
  const answer=(shift%3) as 0|1|2;
  choices[2]=choices[answer];choices[answer]=correct;
  return {choices,answer};
}
function lessonFor(entry:BibleRecord):SundaySchoolLesson{
  const moral=teachingValue(entry);
  const faith= entry.testament==='old'
    ? local('Sa '+entry.reference+', nakikita natin ang kasaysayan ng pananampalataya ng bayan ng Diyos. Basahin ang orihinal na teksto kasama ang guro at pag-isipan kung paano mamuhay nang tapat at mahabagin.','In '+entry.reference+', we explore the history of God’s people. Read the biblical passage with a teacher and consider how to live faithfully and compassionately.')
    : (entry.book==='Matthew'||entry.book==='Mark'||entry.book==='Luke'||entry.book==='John')
      ? local('Sa salaysay na ito, makikita ang pagtuturo at pagmamalasakit ni Jesus. Maaaring pag-usapan ang pananampalataya nang malaya, may paggalang at walang pamimilit.','This account introduces the teaching and compassion of Jesus. Faith can be discussed freely, respectfully, and without pressure.')
      : local('Sa unang iglesya, ang pag-ibig sa Diyos ay nakikita rin sa pangangalaga sa kapwa at paninindigan sa katotohanan.','In the early church, love for God also appeared through caring for others and standing for truth.');
  const q1=rotated(local('Sa '+entry.reference,'In '+entry.reference),
    local('Sa isang kathang-isip na komiks','In an invented comic'),
    local('Sa isang walang pangalang alamat','In an unnamed folktale'),entry.id.length);
  const q2=rotated(moral,
    local('Mas mabuting laging maging makasarili.','Being selfish is always best.'),
    local('Huwag kailanman pakinggan ang nangangailangan.','Never listen to people in need.'),entry.id.length+1);
  const q3=rotated(local('Makinig, mag-isip, at gumawa ng mabuti nang ligtas.','Listen, think, and do good safely.'),
    local('Gayahin ang anumang mapanganib na pangyayari.','Copy any dangerous event.'),
    local('Gamitin ang aral para manghiya ng iba.','Use the teaching to shame others.'),entry.id.length+2);
  const questions: SundaySchoolQuestion[]=[
    {prompt:local(`Saan sa Biblia mababasa ang ${entry.title.tl}?`,`Where in the Bible is ${entry.title.en} recorded?`),...q1},
    {prompt:local(`Ano ang mahalagang aral ng ${entry.title.tl}?`,`What important lesson does ${entry.title.en} teach?`),...q2},
    {prompt:local(`Paano ligtas na maisasabuhay ang aral ng ${entry.title.tl}?`,`How can we safely apply the lesson from ${entry.title.en}?`),...q3}
  ];
  return {
    narrative:local(expandBibleNarrative(entry,'tl'),expandBibleNarrative(entry,'en')),
    retellingNotice:local(
      `Batay sa ${entry.reference}. Ang mga salitaan ay dramatized na pagpapaliwanag para sa mga bata; hindi ito eksaktong sipi ng isang salin ng Biblia. Basahin ang orihinal na talata para sa buong konteksto.`,
      `Based on ${entry.reference}. The dialogue is a child-friendly dramatized paraphrase, not a word-for-word Bible quotation. Read the original passage for full context.`
    ),
    moral,spiritual:faith,reference:entry.reference,
    prayer:local(`Panginoon, salamat sa aming natutuhan sa ${entry.title.tl}. ${moral.tl} Gabayan Mo kaming isabuhay ang aral nang may pag-ibig, katotohanan at pag-iingat. Amen.`,
      `Lord, thank You for what we learned through ${entry.title.en}. ${moral.en} Help us practice this lesson with love, truth, and wise care for other people. Amen.`),
    discussion:[
      local(`Sa ${entry.title.tl}, aling pangyayari o pagtuturo ang nagbigay sa iyo ng pinakamahalagang tanong? Ano ang sinasabi sa ${entry.reference}?`,
        `In ${entry.title.en}, which event or teaching raises the most important question for you? What does ${entry.reference} say?`),
      local(`Paano maisasabuhay ang aral ng ${entry.title.tl} sa tahanan o paaralan nang ligtas, tapat, at walang pamimilit?`,
        `How can we apply the lesson of ${entry.title.en} at home or school safely, honestly, and without pressure?`)
    ],
    questions
  };
}
function storyFor(entry:BibleRecord):ChildrenStory {
  const moral=teachingValue(entry);
  const check=rotated(moral,
    local('Ang manakit at manghamak ay laging tama.','Hurting and mocking others is always right.'),
    local('Walang halaga ang pagiging tapat at mahabagin.','Honesty and compassion do not matter.'),entry.id.length+1);
  return {
    id:entry.id,category:'Bible',minAge:SENSITIVE.has(entry.id)?9:FOR_YOUNGER.has(entry.id)?3:6,
    maxAge:12,emoji:entry.emoji,palette:entry.testament==='old'?HIGH:LOW,
    title:entry.title,summary:moral,
    pages:entry.acts.map(text=>({text:{tl:text.tl,en:text.en}})),
    question:local('Ano ang mabuting aral ng kuwentong ito?','What is the good lesson of this story?'),
    choices:check.choices,answer:check.answer,version:1,source:'bundled'
  };
}
export const BIBLE_EXPANSION_STORIES: ChildrenStory[] = RAW_BIBLE_RECORDS.map(storyFor);
export const BIBLE_EXPANSION_LESSONS: Record<string,SundaySchoolLesson> = Object.fromEntries(
  RAW_BIBLE_RECORDS.map(entry=>[entry.id,lessonFor(entry)])
);
