import { BIBLE_EXPANSION_STORIES } from './bibleExpansion';
/** Original BUKLOD children's stories, bundled for immediate offline access. No child PII. */
export type StoryLanguage = 'tl' | 'en';
export type StoryCategory = 'Bible' | 'Values' | 'Filipino' | 'Bedtime';
export type StoryLocalized = { tl: string; en: string };
export type StoryPage = { text: StoryLocalized };
export type ChildrenStory = {
 id: string; category: StoryCategory; minAge: number; maxAge: number;
 emoji: string; palette: [string,string]; title: StoryLocalized; summary: StoryLocalized;
 pages: StoryPage[]; question: StoryLocalized; choices: StoryLocalized[];
 answer: number; version: number; source: 'bundled' | 'published';
};
export const STORY_CATEGORIES: StoryCategory[] = ['Bible','Values','Filipino','Bedtime'];
export const BUNDLED_CHILDREN_STORIES: ChildrenStory[] = [
  {
    "id": "maliit-na-ilaw",
    "category": "Values",
    "minAge": 3,
    "maxAge": 5,
    "emoji": "🪔",
    "palette": [
      "#1A4B6B",
      "#F7B44C"
    ],
    "title": {
      "tl": "Ang Maliit na Ilaw",
      "en": "The Little Light"
    },
    "summary": {
      "tl": "Isang munting tulong ang nagbigay-liwanag sa buong lugar.",
      "en": "A small act of kindness brightened the village."
    },
    "pages": [
      {
        "text": {
          "tl": "Nawalan ng ilaw ang maliit na nayon. Natakot si Mila sa dilim.",
          "en": "One evening, the small village went dark. Mila felt afraid."
        }
      },
      {
        "text": {
          "tl": "Kinuha niya ang munting lampara at tinulungan ang kaniyang kapitbahay na makauwi.",
          "en": "She carried a little lantern and helped her neighbor find the way home."
        }
      },
      {
        "text": {
          "tl": "Nagsindi rin ng ilaw ang iba. Naliwanagan ang nayon dahil nagsimula ang isa.",
          "en": "Others lit their lamps too. One kind act helped everyone see."
        }
      }
    ],
    "question": {
      "tl": "Ano ang ginawa ni Mila?",
      "en": "What did Mila do?"
    },
    "choices": [
      {
        "tl": "Tinulungan ang kapitbahay",
        "en": "Helped her neighbor"
      },
      {
        "tl": "Itinago ang lampara",
        "en": "Hid the lamp"
      },
      {
        "tl": "Tumakbo palayo",
        "en": "Ran away"
      }
    ],
    "answer": 0,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "david-at-ang-tapang",
    "category": "Bible",
    "minAge": 6,
    "maxAge": 8,
    "emoji": "🪨",
    "palette": [
      "#426B7B",
      "#E5B477"
    ],
    "title": {
      "tl": "David at ang Munting Bato",
      "en": "David and the Small Stone"
    },
    "summary": {
      "tl": "Ang tapang ay hindi nakikita sa laki.",
      "en": "Courage is not measured by size."
    },
    "pages": [
      {
        "text": {
          "tl": "May isang malaking mandirigma na kinatatakutan ng marami.",
          "en": "A giant warrior frightened many people."
        }
      },
      {
        "text": {
          "tl": "Nagtiwala si David sa Diyos. Kumuha siya ng limang makikinis na bato.",
          "en": "David trusted God and gathered five smooth stones."
        }
      },
      {
        "text": {
          "tl": "Hinarap niya ang hamon nang may tapang at pananampalataya.",
          "en": "He faced the challenge with courage and faith."
        }
      }
    ],
    "question": {
      "tl": "Ano ang pinanghawakan ni David?",
      "en": "What gave David courage?"
    },
    "choices": [
      {
        "tl": "Malaking sandata",
        "en": "A huge weapon"
      },
      {
        "tl": "Pagtitiwala sa Diyos",
        "en": "Trust in God"
      },
      {
        "tl": "Pag-iwas sa hamon",
        "en": "Avoiding the challenge"
      }
    ],
    "answer": 1,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "bangka-ng-pag-asa",
    "category": "Bible",
    "minAge": 3,
    "maxAge": 5,
    "emoji": "🛶",
    "palette": [
      "#316E91",
      "#76C6BD"
    ],
    "title": {
      "tl": "Ang Bangka ni Noe",
      "en": "Noah's Ark"
    },
    "summary": {
      "tl": "Pag-aalaga sa buhay at pakikinig.",
      "en": "Caring for life and listening."
    },
    "pages": [
      {
        "text": {
          "tl": "Inutusan ng Diyos si Noe na gumawa ng malaking arka.",
          "en": "God told Noah to build a great ark."
        }
      },
      {
        "text": {
          "tl": "Pumasok ang mga hayop nang magkapares. Inalagaan silang mabuti ni Noe.",
          "en": "Animals came in pairs. Noah cared for them."
        }
      },
      {
        "text": {
          "tl": "Nang humupa ang ulan, may bahagharing nagpapaalala ng pag-asa.",
          "en": "When the rain ended, a rainbow brought hope."
        }
      }
    ],
    "question": {
      "tl": "Ano ang nakita pagkatapos ng ulan?",
      "en": "What appeared after the rain?"
    },
    "choices": [
      {
        "tl": "Bulkan",
        "en": "A volcano"
      },
      {
        "tl": "Bituin",
        "en": "A star"
      },
      {
        "tl": "Bahaghari",
        "en": "A rainbow"
      }
    ],
    "answer": 2,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "si-pagong-at-ang-buto",
    "category": "Filipino",
    "minAge": 6,
    "maxAge": 8,
    "emoji": "🐢",
    "palette": [
      "#276F53",
      "#B8DC80"
    ],
    "title": {
      "tl": "Si Pagong at ang Buto",
      "en": "Turtle and the Seed"
    },
    "summary": {
      "tl": "Hindi minamadali ang mabuting paglaki.",
      "en": "Good things take patience."
    },
    "pages": [
      {
        "text": {
          "tl": "Nakakita si Pagong ng buto ng mangga sa tabi ng daan.",
          "en": "Turtle found a mango seed beside the path."
        }
      },
      {
        "text": {
          "tl": "Araw-araw niya itong diniligan kahit wala pang dahon.",
          "en": "Every day, Turtle watered it even when no leaves appeared."
        }
      },
      {
        "text": {
          "tl": "Sa paglipas ng panahon, sumibol ang puno at nagbigay ng lilim sa lahat.",
          "en": "In time, the tree grew and offered shade to everyone."
        }
      }
    ],
    "question": {
      "tl": "Ano ang itinuro ni Pagong?",
      "en": "What did Turtle teach?"
    },
    "choices": [
      {
        "tl": "Pagtitiyaga",
        "en": "Patience"
      },
      {
        "tl": "Pagmamadali",
        "en": "Rushing"
      },
      {
        "tl": "Pagmamayabang",
        "en": "Boasting"
      }
    ],
    "answer": 0,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "bituin-ni-bitu",
    "category": "Bedtime",
    "minAge": 3,
    "maxAge": 5,
    "emoji": "⭐",
    "palette": [
      "#27336A",
      "#8668BC"
    ],
    "title": {
      "tl": "Ang Bituin ni Bitu",
      "en": "Bitu's Star"
    },
    "summary": {
      "tl": "Tahimik na pagtulog at pasasalamat.",
      "en": "A calm bedtime and gratitude."
    },
    "pages": [
      {
        "text": {
          "tl": "Bago matulog, binilang ni Bitu ang mga bituin sa langit.",
          "en": "Before bed, Bitu counted the stars."
        }
      },
      {
        "text": {
          "tl": "Nagpasalamat siya sa kaniyang pamilya at sa masayang araw.",
          "en": "Bitu was thankful for family and a happy day."
        }
      },
      {
        "text": {
          "tl": "Ipininid niya ang mga mata at nakatulog nang payapa.",
          "en": "Bitu closed both eyes and drifted to peaceful sleep."
        }
      }
    ],
    "question": {
      "tl": "Ano ang ginawa ni Bitu bago matulog?",
      "en": "What did Bitu do before sleeping?"
    },
    "choices": [
      {
        "tl": "Naglaro sa labas",
        "en": "Played outside"
      },
      {
        "tl": "Nagpasalamat",
        "en": "Gave thanks"
      },
      {
        "tl": "Nagtago",
        "en": "Hid away"
      }
    ],
    "answer": 1,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "ang-mabuting-kapitbahay",
    "category": "Bible",
    "minAge": 9,
    "maxAge": 12,
    "emoji": "🤝",
    "palette": [
      "#846147",
      "#F3CE8E"
    ],
    "title": {
      "tl": "Ang Mabuting Kapitbahay",
      "en": "The Kind Neighbor"
    },
    "summary": {
      "tl": "Mahalin ang kapwa sa gawa, hindi salita lang.",
      "en": "Love your neighbor through actions."
    },
    "pages": [
      {
        "text": {
          "tl": "May manlalakbay na nasugatan sa daan. Dumaan ang ilan ngunit nagpatuloy lamang.",
          "en": "A traveler was hurt on the road. Some people passed without stopping."
        }
      },
      {
        "text": {
          "tl": "Isang Samaritano ang huminto, naglinis ng sugat, at dinala siya sa ligtas na lugar.",
          "en": "A Samaritan stopped, cared for his wounds, and brought him somewhere safe."
        }
      },
      {
        "text": {
          "tl": "Ang pagiging kapitbahay ay pagpiling tumulong sa nangangailangan.",
          "en": "Being a neighbor means choosing to help someone in need."
        }
      }
    ],
    "question": {
      "tl": "Sino ang tunay na naging mabuting kapitbahay?",
      "en": "Who acted as a good neighbor?"
    },
    "choices": [
      {
        "tl": "Ang hindi huminto",
        "en": "The person who passed by"
      },
      {
        "tl": "Ang nanood lang",
        "en": "The one who only watched"
      },
      {
        "tl": "Ang tumulong",
        "en": "The person who helped"
      }
    ],
    "answer": 2,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "lola-sa-hardin",
    "category": "Values",
    "minAge": 6,
    "maxAge": 8,
    "emoji": "🌷",
    "palette": [
      "#AC5B76",
      "#E8BE9D"
    ],
    "title": {
      "tl": "Ang Hardin ni Lola",
      "en": "Grandma's Garden"
    },
    "summary": {
      "tl": "Pagtutulungan at paggalang sa nakatatanda.",
      "en": "Teamwork and respect for elders."
    },
    "pages": [
      {
        "text": {
          "tl": "Nahihirapan si Lola sa pagdidilig ng kaniyang mga halaman.",
          "en": "Grandma was having trouble watering her plants."
        }
      },
      {
        "text": {
          "tl": "Nagdala sina Lea at Ben ng tubig at tumulong nang hindi inuutusan.",
          "en": "Lea and Ben brought water and helped without being asked."
        }
      },
      {
        "text": {
          "tl": "Sabay-sabay silang ngumiti nang mamukadkad ang mga bulaklak.",
          "en": "They all smiled as the flowers bloomed."
        }
      }
    ],
    "question": {
      "tl": "Paano tumulong ang mga bata?",
      "en": "How did the children help?"
    },
    "choices": [
      {
        "tl": "Nagdidilig ng halaman",
        "en": "Watered plants"
      },
      {
        "tl": "Sinira ang paso",
        "en": "Broke the pots"
      },
      {
        "tl": "Umalis nang maaga",
        "en": "Left early"
      }
    ],
    "answer": 0,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "alon-at-ang-kabibe",
    "category": "Filipino",
    "minAge": 9,
    "maxAge": 12,
    "emoji": "🐚",
    "palette": [
      "#176A8F",
      "#79CAD2"
    ],
    "title": {
      "tl": "Ang Alon at ang Kabibe",
      "en": "The Wave and the Shell"
    },
    "summary": {
      "tl": "Pagiging mapagkumbaba at pakikinig.",
      "en": "Humility and listening."
    },
    "pages": [
      {
        "text": {
          "tl": "Ipinagmamalaki ng Alon ang kaniyang lakas sa lahat ng nasa dalampasigan.",
          "en": "Wave boasted about its strength to everything on the shore."
        }
      },
      {
        "text": {
          "tl": "Mahinang sinabi ng Kabibe: May lakas din sa maingat na pakikinig.",
          "en": "Shell gently said: There is strength in listening carefully."
        }
      },
      {
        "text": {
          "tl": "Nang tumahimik ang Alon, narinig niya ang awit ng dagat at natutong makinig.",
          "en": "When Wave grew quiet, it heard the ocean's song and learned to listen."
        }
      }
    ],
    "question": {
      "tl": "Ano ang natutuhan ng Alon?",
      "en": "What did Wave learn?"
    },
    "choices": [
      {
        "tl": "Sumigaw palagi",
        "en": "Always shout"
      },
      {
        "tl": "Makinig nang mabuti",
        "en": "Listen carefully"
      },
      {
        "tl": "Manghamak ng iba",
        "en": "Look down on others"
      }
    ],
    "answer": 1,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "si-jonas-at-ang-dagat",
    "category": "Bible",
    "minAge": 6,
    "maxAge": 8,
    "emoji": "🐋",
    "palette": [
      "#144F79",
      "#80AFCF"
    ],
    "title": {
      "tl": "Si Jonas at ang Dagat",
      "en": "Jonah and the Sea"
    },
    "summary": {
      "tl": "Maaari tayong magbago at gumawa ng tama.",
      "en": "We can change and choose what is right."
    },
    "pages": [
      {
        "text": {
          "tl": "May gawain si Jonas ngunit tumakas siya sakay ng barko.",
          "en": "Jonah had a mission, but he sailed away instead."
        }
      },
      {
        "text": {
          "tl": "Sa gitna ng malaking bagyo, natutuhan niyang humingi ng tulong sa Diyos.",
          "en": "During a storm, he learned to ask God for help."
        }
      },
      {
        "text": {
          "tl": "Binigyan siya ng panibagong pagkakataon upang gawin ang tama.",
          "en": "He was given another chance to do what was right."
        }
      }
    ],
    "question": {
      "tl": "Ano ang natanggap ni Jonas?",
      "en": "What did Jonah receive?"
    },
    "choices": [
      {
        "tl": "Bagong barko",
        "en": "A new ship"
      },
      {
        "tl": "Bagong korona",
        "en": "A new crown"
      },
      {
        "tl": "Panibagong pagkakataon",
        "en": "Another chance"
      }
    ],
    "answer": 2,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "tatlong-salitang-mahalaga",
    "category": "Values",
    "minAge": 3,
    "maxAge": 5,
    "emoji": "💛",
    "palette": [
      "#CA7353",
      "#F5C57D"
    ],
    "title": {
      "tl": "Tatlong Salitang Mahalaga",
      "en": "Three Important Phrases"
    },
    "summary": {
      "tl": "Salamat, pakiusap, at patawad.",
      "en": "Thank you, please, and I'm sorry."
    },
    "pages": [
      {
        "text": {
          "tl": "Humingi si Niko ng tulong: Pakiusap, puwede mo ba akong tulungan?",
          "en": "Niko asked politely: Please, can you help me?"
        }
      },
      {
        "text": {
          "tl": "Pagkatapos ay sinabi niya: Salamat! Nang magkamali siya, sinabi niyang: Patawad.",
          "en": "Then he said: Thank you! When he made a mistake, he said: I'm sorry."
        }
      },
      {
        "text": {
          "tl": "Mas gumaan ang kanilang samahan dahil sa mabubuting salita.",
          "en": "Their friendship grew warmer because of kind words."
        }
      }
    ],
    "question": {
      "tl": "Aling salita ang ginagamit kapag nagkamali?",
      "en": "What do we say after making a mistake?"
    },
    "choices": [
      {
        "tl": "Patawad",
        "en": "I'm sorry"
      },
      {
        "tl": "Paalam",
        "en": "Goodbye"
      },
      {
        "tl": "Bukas",
        "en": "Tomorrow"
      }
    ],
    "answer": 0,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "puno-ng-pangarap",
    "category": "Filipino",
    "minAge": 9,
    "maxAge": 12,
    "emoji": "🌳",
    "palette": [
      "#247260",
      "#D3AD78"
    ],
    "title": {
      "tl": "Ang Puno ng Pangarap",
      "en": "The Dream Tree"
    },
    "summary": {
      "tl": "Pangangalaga sa kalikasan at bayanihan.",
      "en": "Caring for nature together."
    },
    "pages": [
      {
        "text": {
          "tl": "Madalas bahain ang paaralan kapag malakas ang ulan.",
          "en": "The schoolyard flooded whenever heavy rain fell."
        }
      },
      {
        "text": {
          "tl": "Nagplano ang mga bata at guro na magtanim ng mga puno at alagaan ang lupa.",
          "en": "Children and teachers planned to plant trees and care for the soil."
        }
      },
      {
        "text": {
          "tl": "Hindi nawala agad ang problema, ngunit sama-sama silang nagsimula ng pagbabago.",
          "en": "The problem did not vanish overnight, but together they began to make a difference."
        }
      }
    ],
    "question": {
      "tl": "Ano ang pinakamahalagang ginawa nila?",
      "en": "What mattered most?"
    },
    "choices": [
      {
        "tl": "Naghintay lang",
        "en": "Only waited"
      },
      {
        "tl": "Nagtulungan",
        "en": "Worked together"
      },
      {
        "tl": "Nag-away",
        "en": "Argued"
      }
    ],
    "answer": 1,
    "version": 1,
    "source": "bundled"
  },
  {
    "id": "gabi-ng-payapang-ulan",
    "category": "Bedtime",
    "minAge": 3,
    "maxAge": 8,
    "emoji": "🌙",
    "palette": [
      "#263C63",
      "#748EB7"
    ],
    "title": {
      "tl": "Ang Payapang Ulan",
      "en": "The Gentle Rain"
    },
    "summary": {
      "tl": "Pahinga, kapanatagan, at pag-asa.",
      "en": "Rest, calm, and hope."
    },
    "pages": [
      {
        "text": {
          "tl": "Mahinang kumatok ang ulan sa bintana ni Lira.",
          "en": "Soft rain tapped on Lira's window."
        }
      },
      {
        "text": {
          "tl": "Huminga siya nang dahan-dahan, yakap ang kaniyang unan, at nakinig sa patak ng ulan.",
          "en": "She breathed slowly, hugged her pillow, and listened to the raindrops."
        }
      },
      {
        "text": {
          "tl": "Naalala niya na bukas ay bagong araw. Mahimbing siyang nakatulog.",
          "en": "She remembered tomorrow would be a new day and fell into deep sleep."
        }
      }
    ],
    "question": {
      "tl": "Ano ang nakatulong kay Lira na kumalma?",
      "en": "What helped Lira feel calm?"
    },
    "choices": [
      {
        "tl": "Malakas na tugtog",
        "en": "Loud music"
      },
      {
        "tl": "Pagkatakot sa ulan",
        "en": "Fear of rain"
      },
      {
        "tl": "Dahan-dahang paghinga",
        "en": "Slow breathing"
      }
    ],
    "answer": 2,
    "version": 1,
    "source": "bundled"
  },
  ...BIBLE_EXPANSION_STORIES,
];
export function localize(value: StoryLocalized, language: StoryLanguage) { return value[language]; }
export function findBundledStory(id: string) { return BUNDLED_CHILDREN_STORIES.find(story=>story.id===id); }
export function isValidChildrenStory(data: unknown): data is ChildrenStory {
 if (!data || typeof data !== 'object') return false;
 const d = data as Partial<ChildrenStory>;
 const goodText = (s:any) => s && typeof s.tl === 'string' && s.tl.trim().length > 0 && s.tl.length <= 1500 && typeof s.en === 'string' && s.en.trim().length > 0 && s.en.length <= 1500;
 return typeof d.id === 'string' && /^[a-z0-9-]{3,70}$/.test(d.id) && STORY_CATEGORIES.includes(d.category as StoryCategory) &&
 Number.isInteger(d.minAge) && Number.isInteger(d.maxAge) && d.minAge! >= 3 && d.maxAge! <= 12 && d.minAge! <= d.maxAge! &&
 goodText(d.title) && goodText(d.summary) && Array.isArray(d.pages) && d.pages.length >= 3 && d.pages.length <= 16 && d.pages.every(p=>goodText(p?.text)) &&
 goodText(d.question) && Array.isArray(d.choices) && d.choices.length === 3 && d.choices.every(goodText) &&
 Number.isInteger(d.answer) && d.answer! >= 0 && d.answer! < 3 && typeof d.emoji === 'string' && d.emoji.length <= 10 &&
 Array.isArray(d.palette) && d.palette.length === 2 && d.palette.every(c=>typeof c==='string' && /^#[0-9a-fA-F]{6}$/.test(c));
}
