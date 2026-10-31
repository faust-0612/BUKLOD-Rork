import * as Speech from 'expo-speech';
import { Alert, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { chooseBibleNarrationVoice } from '@/lib/buklodBibleVoiceLocale';
import { bibleAmbienceController } from '@/lib/buklodBibleAmbience';
import {
  DEFAULT_SFX_VOLUME,
  DEFAULT_VOICE_VOLUME,
  mapBibleChapterRows,
  nextChapterCursor,
  planVerseNarration,
  resolveStartVerseIndex,
  type BibleAmbienceKind,
  type BibleNarrationBook,
  type BibleNarrationMode,
  type BibleNarrationStatus,
  type BibleNarrationVerse,
  type BibleSpeechDelivery,
  type BibleVerseNarrationPlan,
} from '@/lib/buklodBibleNarration';
import {
  speakWebBibleChunk,
  stopWebBibleSpeech,
  warmWebBibleVoices,
} from '@/lib/buklodWebSpeech';

export type BibleNarrationSnapshot = {
  status: BibleNarrationStatus;
  mode: BibleNarrationMode;
  sfxEnabled: boolean;
  voiceVolume: number;
  sfxVolume: number;
  translation: string;
  language: string;
  bookNo: number;
  bookName: string;
  chapterNo: number;
  verseNo: number;
  verseCount: number;
  continueNextBook: boolean;
};

export type BibleNarrationPlayInput = {
  translation: string;
  language: string;
  bookNo: number;
  bookName: string;
  chapterNo: number;
  verses: BibleNarrationVerse[];
  startVerseNo?: number | null;
  books?: BibleNarrationBook[];
  continueNextBook?: boolean;
};

type Listener = (snapshot: BibleNarrationSnapshot) => void;

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

function maleVoiceScore(voice: {
  name?: string;
  identifier?: string;
  quality?: string | number;
}) {
  const identity = `${voice?.name ?? ''} ${voice?.identifier ?? ''}`.toLowerCase();
  let score = 0;
  if (/(^|[\s_-])(male|man|guy|masculine)([\s_-]|$)/i.test(identity)) {
    score += 100;
  }
  if (/(female|woman|girl|feminine)/i.test(identity)) {
    score -= 100;
  }
  if (String(voice?.quality ?? '').toLowerCase().includes('enhanced')) {
    score += 10;
  }
  return score;
}

function idleSnapshot(
  partial?: Partial<BibleNarrationSnapshot>
): BibleNarrationSnapshot {
  return {
    status: 'idle',
    mode: 'expressive',
    sfxEnabled: true,
    voiceVolume: DEFAULT_VOICE_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
    translation: '',
    language: 'fil-PH',
    bookNo: 0,
    bookName: '',
    chapterNo: 0,
    verseNo: 0,
    verseCount: 0,
    continueNextBook: true,
    ...partial,
  };
}

class BuklodBibleNarrationEngine {
  private listeners = new Set<Listener>();
  private runToken = 0;
  private utteranceId = 0;
  private intent: 'play' | 'pause' | 'stop' = 'stop';
  private voiceId: string | undefined;
  private voiceLanguage = '';
  private speechLanguage = '';
  private verses: BibleNarrationVerse[] = [];
  private books: BibleNarrationBook[] = [];
  private verseIndex = 0;
  private nextChapterCache:
    | {
        bookNo: number;
        bookName: string;
        chapterNo: number;
        verses: BibleNarrationVerse[];
      }
    | null = null;
  private nextPlan: BibleVerseNarrationPlan | null = null;
  private stickyAmbienceChapter = '';
  private stickyAmbienceKind: BibleAmbienceKind = 'none';
  private prefetching = false;
  private snapshot: BibleNarrationSnapshot = idleSnapshot();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  isActive() {
    return (
      this.snapshot.status === 'playing' ||
      this.snapshot.status === 'paused' ||
      this.snapshot.status === 'loading'
    );
  }

  applySettings(partial: {
    mode?: BibleNarrationMode;
    sfxEnabled?: boolean;
    voiceVolume?: number;
    sfxVolume?: number;
  }) {
    this.patchSnapshot({
      mode: partial.mode ?? this.snapshot.mode,
      sfxEnabled: partial.sfxEnabled ?? this.snapshot.sfxEnabled,
      voiceVolume: clamp01(
        partial.voiceVolume ?? this.snapshot.voiceVolume
      ),
      sfxVolume: clamp01(
        partial.sfxVolume ?? this.snapshot.sfxVolume
      ),
    });
    this.syncAmbienceSettings();
  }

  setMode(mode: BibleNarrationMode) {
    this.applySettings({ mode });
    if (this.snapshot.status === 'playing') {
      void this.refreshAmbienceForCurrentVerse();
    }
  }

  setSfxEnabled(enabled: boolean) {
    this.applySettings({ sfxEnabled: enabled });
    if (this.snapshot.status === 'playing') {
      void this.refreshAmbienceForCurrentVerse();
    } else if (!enabled) {
      void bibleAmbienceController.transitionTo('none');
    }
  }

  setVoiceVolume(volume: number) {
    this.applySettings({ voiceVolume: volume });
  }

  setSfxVolume(volume: number) {
    this.applySettings({ sfxVolume: volume });
  }

  restoreIdlePosition(partial: {
    translation?: string;
    bookNo?: number;
    bookName?: string;
    chapterNo?: number;
    verseNo?: number;
  }) {
    if (this.isActive()) {
      return;
    }

    this.patchSnapshot({
      status: 'idle',
      translation: String(
        partial.translation ??
          this.snapshot.translation
      )
        .trim()
        .toUpperCase(),
      bookNo: Number(partial.bookNo ?? this.snapshot.bookNo),
      bookName: String(
        partial.bookName ?? this.snapshot.bookName
      ),
      chapterNo: Number(
        partial.chapterNo ?? this.snapshot.chapterNo
      ),
      verseNo: Number(
        partial.verseNo ?? this.snapshot.verseNo
      ),
    });
  }

  async play(input: BibleNarrationPlayInput) {
    await this.halt('stop');

    const verses = (input.verses ?? []).filter(
      (verse) => Number(verse.verse_no) > 0
    );

    this.verses = verses;
    this.books = input.books ?? [];
    this.verseIndex = Math.max(
      0,
      resolveStartVerseIndex(verses, input.startVerseNo)
    );
    this.nextChapterCache = null;
    this.nextPlan = null;
    this.stickyAmbienceChapter = '';
    this.stickyAmbienceKind = 'none';

    this.patchSnapshot({
      status: 'loading',
      translation: String(input.translation ?? '').trim().toUpperCase(),
      language: input.language || 'fil-PH',
      bookNo: Number(input.bookNo),
      bookName: String(input.bookName ?? verses[0]?.book_name ?? ''),
      chapterNo: Number(input.chapterNo),
      verseNo: verses[this.verseIndex]?.verse_no ?? 0,
      verseCount: verses.length,
      continueNextBook: input.continueNextBook !== false,
    });

    if (!this.books.length && this.snapshot.translation) {
      this.books = await this.fetchBooks(this.snapshot.translation);
    }

    if (!this.verses.length) {
      this.verses = await this.fetchChapter(
        this.snapshot.translation,
        this.snapshot.bookNo,
        this.snapshot.chapterNo,
        this.snapshot.bookName
      );
      this.verseIndex = Math.max(
        0,
        resolveStartVerseIndex(this.verses, input.startVerseNo)
      );
      this.patchSnapshot({
        verseCount: this.verses.length,
        verseNo: this.verses[this.verseIndex]?.verse_no ?? 0,
        bookName:
          this.verses[0]?.book_name || this.snapshot.bookName,
      });
    }

    if (!this.verses.length) {
      this.patchSnapshot({ status: 'idle' });
      return;
    }

    const voiceAvailable = await this.resolveVoice(this.snapshot.language);
    if (!voiceAvailable) {
      this.patchSnapshot({ status: 'idle' });
      if (Platform.OS !== 'web') {
        Alert.alert('Filipino voice unavailable', 'Walang available na Filipino/Tagalog voice sa Android Text-to-speech settings. I-install o i-enable muna ang Filipino voice. Hindi namin gagamitin ang English voice sa ASD.');
      }
      return;
    }
    this.syncAmbienceSettings();
    this.intent = 'play';
    void this.runPlayback();
  }

  async pause() {
    if (this.snapshot.status !== 'playing') {
      return;
    }
    await this.halt('pause');
    bibleAmbienceController.pause();
    this.patchSnapshot({ status: 'paused' });
  }

  async resume() {
    if (this.snapshot.status !== 'paused') {
      return;
    }
    if (!this.verses.length) {
      return;
    }
    this.intent = 'play';
    bibleAmbienceController.resume();
    void this.runPlayback();
  }

  async stop() {
    await this.halt('stop');
    await bibleAmbienceController.stop();
    this.verses = [];
    this.nextChapterCache = null;
    this.nextPlan = null;
    this.patchSnapshot({
      status: 'idle',
      verseNo: this.snapshot.verseNo,
    });
  }

  private async halt(intent: 'pause' | 'stop') {
    this.intent = intent;
    this.runToken += 1;
    this.utteranceId += 1;
    try {
      stopWebBibleSpeech();
      await Speech.stop();
    } catch {
      // ignore
    }
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private patchSnapshot(partial: Partial<BibleNarrationSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...partial,
    };
    this.emit();
  }

  private syncAmbienceSettings() {
    const enabled =
      this.snapshot.mode === 'dramatized' &&
      this.snapshot.sfxEnabled;
    bibleAmbienceController.setEnabled(enabled);
    bibleAmbienceController.setUserVolume(this.snapshot.sfxVolume);
  }

  private async resolveVoice(language: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      warmWebBibleVoices();
      this.voiceLanguage = language;
      this.speechLanguage = language;
      this.voiceId = undefined;
      return true;
    }
    if (this.voiceLanguage === language && this.voiceId) return true;

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const selection = chooseBibleNarrationVoice(voices ?? [], language, maleVoiceScore);
      this.voiceId = selection.voice?.identifier;
      this.speechLanguage = selection.language;
      this.voiceLanguage = selection.available ? language : '';
      return selection.available;
    } catch {
      this.voiceId = undefined;
      this.speechLanguage = language;
      this.voiceLanguage = '';
      return !/^(fil|tl)(-|$)/i.test(language);
    }
  }

  private async runPlayback() {
    const token = ++this.runToken;
    this.patchSnapshot({ status: 'playing' });

    while (
      this.intent === 'play' &&
      token === this.runToken
    ) {
      const verse = this.verses[this.verseIndex];
      if (!verse) {
        const continued = await this.advanceChapter(token);
        if (!continued) {
          await this.stop();
          return;
        }
        continue;
      }

      this.patchSnapshot({
        status: 'playing',
        bookNo: Number(verse.book_no),
        bookName: String(verse.book_name ?? this.snapshot.bookName),
        chapterNo: Number(verse.chapter_no),
        verseNo: Number(verse.verse_no),
        verseCount: this.verses.length,
      });

      const plan =
        this.nextPlan &&
        this.nextPlan.verse.verse_no === verse.verse_no &&
        this.nextPlan.verse.chapter_no === verse.chapter_no &&
        this.nextPlan.verse.book_no === verse.book_no
          ? this.nextPlan
          : planVerseNarration(
              verse,
              this.snapshot.language,
              this.snapshot.mode
            );

      this.nextPlan = null;
      this.prepareUpcoming(token);

      if (!plan) {
        this.verseIndex += 1;
        continue;
      }

      void this.applyAmbience(plan);

      for (const chunk of plan.speechChunks) {
        if (this.intent !== 'play' || token !== this.runToken) {
          return;
        }

        const result = await this.speakChunk(
          chunk,
          plan.delivery,
          token
        );

        if (this.intent !== 'play' || token !== this.runToken) {
          return;
        }

        if (result !== 'done') {
          return;
        }
      }

      this.verseIndex += 1;
    }
  }

  private prepareUpcoming(token: number) {
    const nextVerse = this.verses[this.verseIndex + 1];
    if (nextVerse) {
      this.nextPlan = planVerseNarration(
        nextVerse,
        this.snapshot.language,
        this.snapshot.mode
      );
    } else {
      this.nextPlan = null;
    }

    const remaining =
      this.verses.length - this.verseIndex;
    if (remaining <= 2) {
      void this.prefetchNextChapter(token);
    }
  }

  private async speakChunk(
    text: string,
    delivery: BibleSpeechDelivery,
    token: number
  ): Promise<'done' | 'stopped' | 'stale'> {
    if (!text) {
      return 'done';
    }

    const utteranceId = ++this.utteranceId;

    if (this.intent !== 'play' || token !== this.runToken) {
      return 'stale';
    }

    if (Platform.OS === 'web') {
      return speakWebBibleChunk({
        text,
        language: this.snapshot.language,
        delivery,
        volume: this.snapshot.voiceVolume,
        isCurrent: () =>
          utteranceId === this.utteranceId &&
          token === this.runToken &&
          this.intent === 'play',
      });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (
        value: 'done' | 'stopped' | 'stale'
      ) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      Speech.speak(text, {
        language: this.speechLanguage || this.snapshot.language,
        ...(this.voiceId
          ? { voice: this.voiceId }
          : {}),
        rate: delivery.rate,
        pitch: delivery.pitch,
        volume: this.snapshot.voiceVolume,
        onDone: () => {
          if (
            utteranceId !== this.utteranceId ||
            token !== this.runToken ||
            this.intent !== 'play'
          ) {
            finish('stale');
            return;
          }
          finish('done');
        },
        onStopped: () => {
          if (utteranceId !== this.utteranceId) {
            finish('stale');
            return;
          }
          if (
            this.intent === 'play' &&
            token === this.runToken
          ) {
            finish('done');
            return;
          }
          finish('stopped');
        },
        onError: () => {
          if (
            utteranceId !== this.utteranceId ||
            token !== this.runToken ||
            this.intent !== 'play'
          ) {
            finish('stale');
            return;
          }
          finish('done');
        },
      });
    });
  }

  private async applyAmbience(plan: BibleVerseNarrationPlan) {
    const chapterKey = `${plan.verse.book_no}:${plan.verse.chapter_no}`;
    if (this.stickyAmbienceChapter !== chapterKey) {
      this.stickyAmbienceChapter = chapterKey;
      this.stickyAmbienceKind = plan.ambience;
    } else if (plan.ambience !== 'none') {
      this.stickyAmbienceKind = plan.ambience;
    }

    const dramatized =
      this.snapshot.mode === 'dramatized' &&
      this.snapshot.sfxEnabled;

    if (!dramatized) {
      await bibleAmbienceController.transitionTo('none');
      return;
    }

    await bibleAmbienceController.transitionTo(
      this.stickyAmbienceKind
    );

    for (const shot of plan.oneShots) {
      void bibleAmbienceController.playOneShot(shot);
    }
  }

  private async refreshAmbienceForCurrentVerse() {
    const verse = this.verses[this.verseIndex];
    if (!verse) {
      return;
    }
    const plan = planVerseNarration(
      verse,
      this.snapshot.language,
      this.snapshot.mode
    );
    if (plan) {
      await this.applyAmbience(plan);
    }
  }

  private async advanceChapter(token: number) {
    if (token !== this.runToken || this.intent !== 'play') {
      return false;
    }

    const cursor = nextChapterCursor(
      this.snapshot.bookNo,
      this.snapshot.chapterNo,
      this.books,
      this.snapshot.continueNextBook
    );

    if (!cursor) {
      return false;
    }

    this.patchSnapshot({ status: 'loading' });

    let verses: BibleNarrationVerse[] = [];
    if (
      this.nextChapterCache &&
      this.nextChapterCache.bookNo === cursor.bookNo &&
      this.nextChapterCache.chapterNo === cursor.chapterNo
    ) {
      verses = this.nextChapterCache.verses;
    } else {
      verses = await this.fetchChapter(
        this.snapshot.translation,
        cursor.bookNo,
        cursor.chapterNo,
        cursor.bookName
      );
    }

    this.nextChapterCache = null;
    this.nextPlan = null;

    if (!verses.length || token !== this.runToken) {
      return false;
    }

    this.verses = verses;
    this.verseIndex = 0;
    this.patchSnapshot({
      status: 'playing',
      bookNo: cursor.bookNo,
      bookName: verses[0]?.book_name || cursor.bookName,
      chapterNo: cursor.chapterNo,
      verseNo: verses[0]?.verse_no ?? 1,
      verseCount: verses.length,
    });
    return true;
  }

  private async prefetchNextChapter(token: number) {
    if (this.prefetching || token !== this.runToken) {
      return;
    }

    const cursor = nextChapterCursor(
      this.snapshot.bookNo,
      this.snapshot.chapterNo,
      this.books,
      this.snapshot.continueNextBook
    );

    if (!cursor) {
      return;
    }

    if (
      this.nextChapterCache &&
      this.nextChapterCache.bookNo === cursor.bookNo &&
      this.nextChapterCache.chapterNo === cursor.chapterNo
    ) {
      return;
    }

    this.prefetching = true;
    try {
      const verses = await this.fetchChapter(
        this.snapshot.translation,
        cursor.bookNo,
        cursor.chapterNo,
        cursor.bookName
      );
      if (token === this.runToken && verses.length) {
        this.nextChapterCache = {
          bookNo: cursor.bookNo,
          bookName: cursor.bookName,
          chapterNo: cursor.chapterNo,
          verses,
        };
        if (!this.nextPlan && verses[0]) {
          this.nextPlan = planVerseNarration(
            verses[0],
            this.snapshot.language,
            this.snapshot.mode
          );
        }
      }
    } catch {
      // Prefetch is best-effort; playback can load on demand.
    } finally {
      this.prefetching = false;
    }
  }

  private async fetchChapter(
    translation: string,
    bookNo: number,
    chapterNo: number,
    bookName: string
  ) {
    const { data, error } = await (supabase as any).rpc(
      'get_bible_chapter',
      {
        p_translation_code: translation,
        p_book_no: bookNo,
        p_chapter_no: chapterNo,
      }
    );

    if (error) {
      throw error;
    }

    return mapBibleChapterRows(data, {
      bookNo,
      bookName,
      chapterNo,
    });
  }

  private async fetchBooks(translation: string) {
    const { data, error } = await (supabase as any).rpc(
      'get_bible_books',
      {
        p_translation_code: translation,
      }
    );

    if (error) {
      return [];
    }

    return (Array.isArray(data) ? data : []).map(
      (row: Record<string, unknown>) => ({
        book_no: Number(row.book_no ?? 0),
        book_name: String(row.book_name ?? ''),
        chapter_count: Number(row.chapter_count ?? 0),
      })
    ).filter((book: BibleNarrationBook) => book.book_no > 0);
  }
}

export const bibleNarrationEngine =
  new BuklodBibleNarrationEngine();
