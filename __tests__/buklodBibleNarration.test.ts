import {
  detectBibleAmbience,
  detectBibleMood,
  displayVerseText,
  nextChapterCursor,
  planVerseNarration,
  resolveStartVerseIndex,
  scriptureSpeechText,
  splitSpeechChunks,
} from '@/lib/buklodBibleNarration';

describe('BUKLOD Bible narration — Scripture priority', () => {
  const verse = {
    book_no: 43,
    book_name: 'John',
    chapter_no: 3,
    verse_no: 16,
    verse_text:
      'For God so loved the world, that he gave his only begotten Son.',
  };

  it('does not add, omit, or paraphrase Bible words for speech', () => {
    const display = displayVerseText(verse.verse_text);
    const spoken = scriptureSpeechText(verse.verse_text, 'en-US');
    const spokenWords = spoken.toLowerCase().split(/\s+/);
    const sourceWords = display.toLowerCase().split(/\s+/);

    expect(spoken).not.toMatch(/\b(verse|talata|chapter|kabanata)\b/i);
    expect(spokenWords).toEqual(sourceWords);
  });

  it('keeps every word when a long verse is split for TTS', () => {
    const long =
      'In the beginning was the Word, and the Word was with God, and the Word was God. The same was in the beginning with God.';
    const chunks = splitSpeechChunks(long, 40);
    expect(chunks.join(' ')).toBe(long);
  });

  it('plans expression without changing the displayed verse text', () => {
    const plan = planVerseNarration(verse, 'en-US', 'expressive');
    expect(plan?.displayText).toBe(displayVerseText(verse.verse_text));
    expect(plan?.speechChunks.join(' ')).toBe(
      scriptureSpeechText(verse.verse_text, 'en-US')
    );
  });

  it('selects ambience and mood from the passage without rewriting it', () => {
    expect(detectBibleAmbience('And the sea was tossed with waves.')).toBe(
      'sea'
    );
    expect(detectBibleMood('Rejoice in the Lord always.')).toBe('joyful');
    expect(detectBibleMood('They crucified him.')).toBe('solemn');
  });

  it('starts from the requested verse and continues to the next chapter', () => {
    const verses = [
      { ...verse, verse_no: 14, verse_text: 'And as Moses lifted up the serpent.' },
      { ...verse, verse_no: 15, verse_text: 'That whosoever believeth in him.' },
      verse,
    ];

    expect(resolveStartVerseIndex(verses, 16)).toBe(2);

    expect(
      nextChapterCursor(43, 3, [
        { book_no: 43, book_name: 'John', chapter_count: 21 },
        { book_no: 44, book_name: 'Acts', chapter_count: 28 },
      ], true)
    ).toEqual({
      bookNo: 43,
      bookName: 'John',
      chapterNo: 4,
    });

    expect(
      nextChapterCursor(43, 21, [
        { book_no: 43, book_name: 'John', chapter_count: 21 },
        { book_no: 44, book_name: 'Acts', chapter_count: 28 },
      ], true)
    ).toEqual({
      bookNo: 44,
      bookName: 'Acts',
      chapterNo: 1,
    });
  });
});
