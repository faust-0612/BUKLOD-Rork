import { repairMojibakeText } from '@/lib/repairMojibakeText';
import {
  normalizeBuklodSpeechText,
} from '@/lib/buklodSpeech';
import { Platform } from 'react-native';

export type BibleNarrationMode =
  | 'pure'
  | 'expressive'
  | 'dramatized';

export type BibleNarrationMood =
  | 'calm'
  | 'solemn'
  | 'joyful'
  | 'urgent'
  | 'reflective'
  | 'conversational';

export type BibleAmbienceKind =
  | 'none'
  | 'wind'
  | 'rain'
  | 'sea'
  | 'crowd'
  | 'night';

export type BibleOneShotKind =
  | 'thunder'
  | 'footsteps';

export type BibleNarrationStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused';

export type BibleNarrationVerse = {
  book_no: number;
  book_name: string;
  chapter_no: number;
  verse_no: number;
  verse_text: string;
};

export type BibleNarrationBook = {
  book_no: number;
  book_name: string;
  chapter_count: number;
};

export type BibleSpeechDelivery = {
  rate: number;
  pitch: number;
};

export type BibleVerseNarrationPlan = {
  verse: BibleNarrationVerse;
  displayText: string;
  speechChunks: string[];
  mood: BibleNarrationMood;
  ambience: BibleAmbienceKind;
  oneShots: BibleOneShotKind[];
  delivery: BibleSpeechDelivery;
};

const MAX_CHUNK = 420;

const WORD = (value: string) =>
  new RegExp(
    `(^|[^A-Za-zÀ-ÖØ-öø-ÿÑñ])${value}([^A-Za-zÀ-ÖØ-öø-ÿÑñ]|$)`,
    'i'
  );

const SCENE_PATTERNS: Array<{
  kind: BibleAmbienceKind;
  patterns: RegExp[];
}> = [
  {
    kind: 'sea',
    patterns: [
      WORD('sea'),
      WORD('seas'),
      WORD('ocean'),
      WORD('waves'),
      WORD('boat'),
      WORD('ship'),
      WORD('ships'),
      WORD('fishermen'),
      WORD('dagat'),
      WORD('alon'),
      WORD('bangka'),
      WORD('laot'),
    ],
  },
  {
    kind: 'rain',
    patterns: [
      WORD('rain'),
      WORD('rains'),
      WORD('flood'),
      WORD('storm'),
      WORD('tempest'),
      WORD('ulan'),
      WORD('bagyo'),
      WORD('baha'),
    ],
  },
  {
    kind: 'wind',
    patterns: [
      WORD('wind'),
      WORD('winds'),
      WORD('whirlwind'),
      WORD('hangin'),
      WORD('unos'),
    ],
  },
  {
    kind: 'crowd',
    patterns: [
      WORD('multitude'),
      WORD('multitudes'),
      WORD('crowd'),
      WORD('crowds'),
      WORD('assembly'),
      WORD('congregated'),
      WORD('karamihan'),
    ],
  },
  {
    kind: 'night',
    patterns: [
      WORD('night'),
      WORD('midnight'),
      WORD('darkness'),
      WORD('gabi'),
      WORD('hatinggabi'),
      WORD('kadiliman'),
      WORD('dilim'),
    ],
  },
];

const MOOD_PATTERNS: Array<{
  mood: BibleNarrationMood;
  patterns: RegExp[];
}> = [
  {
    mood: 'joyful',
    patterns: [
      WORD('rejoice'),
      WORD('joy'),
      WORD('glad'),
      WORD('praise'),
      WORD('hallelujah'),
      WORD('alleluia'),
      WORD('blessed'),
      WORD('sing'),
      WORD('magalak'),
      WORD('kagalakan'),
      WORD('magpuri'),
      WORD('aleluya'),
      WORD('pinagpala'),
    ],
  },
  {
    mood: 'solemn',
    patterns: [
      WORD('crucify'),
      WORD('crucified'),
      WORD('cross'),
      WORD('blood'),
      WORD('death'),
      WORD('died'),
      WORD('grave'),
      WORD('tomb'),
      WORD('weep'),
      WORD('wept'),
      WORD('mourn'),
      WORD('krus'),
      WORD('dugo'),
      WORD('namatay'),
      WORD('kamatayan'),
      WORD('libingan'),
      WORD('tumangis'),
    ],
  },
  {
    mood: 'urgent',
    patterns: [
      WORD('flee'),
      WORD('woe'),
      WORD('behold'),
      WORD('immediately'),
      WORD('straightway'),
      WORD('takbo'),
      WORD('agapan'),
      WORD('saan'),
      WORD('kaagad'),
    ],
  },
  {
    mood: 'calm',
    patterns: [
      WORD('peace'),
      WORD('still'),
      WORD('rest'),
      WORD('quiet'),
      WORD('kapayapaan'),
      WORD('payapa'),
      WORD('tahimik'),
      WORD('pahinga'),
    ],
  },
  {
    mood: 'reflective',
    patterns: [
      WORD('selah'),
      WORD('consider'),
      WORD('meditate'),
      WORD('remember'),
      WORD('pagnilayan'),
      WORD('alalahanin'),
      WORD('gunita'),
    ],
  },
];

const THUNDER_PATTERNS = [
  WORD('thunder'),
  WORD('thunders'),
  WORD('lightning'),
  WORD('kulog'),
  WORD('kidlat'),
];

const FOOTSTEP_PATTERNS = [
  WORD('walked'),
  WORD('walking'),
  WORD('footsteps'),
  WORD('feet'),
  WORD('naglakad'),
  WORD('lumakad'),
  WORD('yapakan'),
];

const PURE_DELIVERY: BibleSpeechDelivery = {
  rate: 0.92,
  pitch: 0.9,
};

const MOOD_DELIVERY: Record<BibleNarrationMood, BibleSpeechDelivery> = {
  calm: { rate: 0.84, pitch: 0.88 },
  solemn: { rate: 0.8, pitch: 0.84 },
  joyful: { rate: 0.98, pitch: 1.04 },
  urgent: { rate: 1.04, pitch: 1.0 },
  reflective: { rate: 0.82, pitch: 0.9 },
  conversational: { rate: 0.92, pitch: 0.94 },
};

export function displayVerseText(raw: string) {
  return String(raw ?? '')
    .replace(/^\u00B6\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFilipinoSpeechLanguage(language: string) {
  return String(language ?? '')
    .toLowerCase()
    .startsWith('fil');
}

/**
 * TTS-only preparation. Displayed Scripture is never modified.
 * Pronunciation helpers (BUKLOD, Filipino apostrophes) do not add,
 * omit, or paraphrase biblical words.
 */
export function scriptureSpeechText(
  raw: string,
  language: string
) {
  return normalizeBuklodSpeechText(
    displayVerseText(raw),
    {
      filipino: isFilipinoSpeechLanguage(language),
    }
  );
}

export function splitSpeechChunks(
  text: string,
  maxLength = MAX_CHUNK
) {
  const input = String(text ?? '').trim();
  if (!input) {
    return [];
  }

  if (input.length <= maxLength) {
    return [input];
  }

  const sentences =
    input.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [input];

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const clean = current.trim();
    if (clean) {
      chunks.push(clean);
    }
    current = '';
  };

  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) {
      continue;
    }

    if (clean.length > maxLength) {
      pushCurrent();
      const words = clean.split(/\s+/);
      let part = '';
      for (const word of words) {
        const next = part ? `${part} ${word}` : word;
        if (next.length > maxLength) {
          if (part.trim()) {
            chunks.push(part.trim());
          }
          part = word;
        } else {
          part = next;
        }
      }
      if (part.trim()) {
        chunks.push(part.trim());
      }
      continue;
    }

    const next = current ? `${current} ${clean}` : clean;
    if (next.length > maxLength) {
      pushCurrent();
      current = clean;
    } else {
      current = next;
    }
  }

  pushCurrent();
  return chunks;
}

function matchesAny(
  haystack: string,
  patterns: RegExp[]
) {
  return patterns.some((pattern) => pattern.test(haystack));
}

export function detectBibleAmbience(
  text: string
): BibleAmbienceKind {
  const haystack = ` ${displayVerseText(text)} `;
  for (const scene of SCENE_PATTERNS) {
    if (matchesAny(haystack, scene.patterns)) {
      return scene.kind;
    }
  }
  return 'none';
}

export function detectBibleMood(
  text: string,
  bookName = ''
): BibleNarrationMood {
  const haystack = ` ${displayVerseText(text)} `;
  for (const entry of MOOD_PATTERNS) {
    if (matchesAny(haystack, entry.patterns)) {
      return entry.mood;
    }
  }

  const book = String(bookName ?? '').toLowerCase();
  if (
    /psalm|awit|proverb|kawikaan|eccles|mangangaral/.test(book)
  ) {
    return 'reflective';
  }

  return 'conversational';
}

export function detectBibleOneShots(
  text: string
): BibleOneShotKind[] {
  const haystack = ` ${displayVerseText(text)} `;
  const shots: BibleOneShotKind[] = [];
  if (matchesAny(haystack, THUNDER_PATTERNS)) {
    shots.push('thunder');
  }
  if (matchesAny(haystack, FOOTSTEP_PATTERNS)) {
    shots.push('footsteps');
  }
  return shots;
}

export function deliveryForMode(
  mode: BibleNarrationMode,
  mood: BibleNarrationMood
): BibleSpeechDelivery {
  if (mode === 'pure') {
    return { ...PURE_DELIVERY };
  }
  return { ...MOOD_DELIVERY[mood] };
}

export function planVerseNarration(
  verse: BibleNarrationVerse,
  language: string,
  mode: BibleNarrationMode
): BibleVerseNarrationPlan | null {
  const displayText = displayVerseText(repairMojibakeText(verse.verse_text));
  if (!displayText) {
    return null;
  }

  const speech = scriptureSpeechText(
    repairMojibakeText(verse.verse_text),
    language
  );
  const speechChunks = splitSpeechChunks(
    speech,
    Platform.OS === 'web' ? 180 : MAX_CHUNK
  );
  if (!speechChunks.length) {
    return null;
  }

  const mood = detectBibleMood(
    displayText,
    verse.book_name
  );

  return {
    verse,
    displayText,
    speechChunks,
    mood,
    ambience: detectBibleAmbience(displayText),
    oneShots: detectBibleOneShots(displayText),
    delivery: deliveryForMode(mode, mood),
  };
}

export function resolveStartVerseIndex(
  verses: BibleNarrationVerse[],
  startVerseNo?: number | null
) {
  if (!verses.length) {
    return -1;
  }

  const wanted = Number(startVerseNo ?? 0);
  if (!(wanted > 0)) {
    return 0;
  }

  const exact = verses.findIndex(
    (verse) => Number(verse.verse_no) === wanted
  );
  if (exact >= 0) {
    return exact;
  }

  const next = verses.findIndex(
    (verse) => Number(verse.verse_no) >= wanted
  );
  return next >= 0 ? next : 0;
}

export function nextChapterCursor(
  bookNo: number,
  chapterNo: number,
  books: BibleNarrationBook[],
  continueNextBook: boolean
): {
  bookNo: number;
  bookName: string;
  chapterNo: number;
} | null {
  const current = books.find(
    (book) => Number(book.book_no) === Number(bookNo)
  );

  if (
    current &&
    Number(chapterNo) < Number(current.chapter_count)
  ) {
    return {
      bookNo: Number(current.book_no),
      bookName: String(current.book_name ?? ''),
      chapterNo: Number(chapterNo) + 1,
    };
  }

  if (!continueNextBook) {
    return null;
  }

  const nextBook = books.find(
    (book) => Number(book.book_no) === Number(bookNo) + 1
  );

  if (!nextBook) {
    return null;
  }

  return {
    bookNo: Number(nextBook.book_no),
    bookName: String(nextBook.book_name ?? ''),
    chapterNo: 1,
  };
}

export function mapBibleChapterRows(
  rows: unknown,
  fallback?: {
    bookNo?: number;
    bookName?: string;
    chapterNo?: number;
  }
): BibleNarrationVerse[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        book_no: Number(
          item.book_no ?? fallback?.bookNo ?? 0
        ),
        book_name: String(
          item.book_name ?? fallback?.bookName ?? ''
        ),
        chapter_no: Number(
          item.chapter_no ?? fallback?.chapterNo ?? 0
        ),
        verse_no: Number(item.verse_no ?? 0),
        verse_text: repairMojibakeText(String(item.verse_text ?? '')),
      };
    })
    .filter(
      (verse) =>
        verse.verse_no > 0 &&
        displayVerseText(repairMojibakeText(verse.verse_text)).length > 0
    );
}

export const BIBLE_NARRATION_STORAGE_KEY =
  'buklod.bible.narration.v1';

export const DEFAULT_VOICE_VOLUME = 1;
export const DEFAULT_SFX_VOLUME = 0.45;
