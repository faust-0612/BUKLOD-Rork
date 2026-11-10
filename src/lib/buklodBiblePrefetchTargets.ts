/** Pure, bounded lookahead for offline My Bible reading. */
export type BibleBookForPrefetch = {
  book_no: number | string;
  chapter_count: number | string;
};

export type BibleChapterTarget = {
  bookNo: number;
  chapterNo: number;
};

export function nextBibleChapterTargets(
  books: BibleBookForPrefetch[],
  bookNo: number,
  chapterNo: number,
  count = 2,
): BibleChapterTarget[] {
  const ordered = books
    .map(book => ({
      bookNo: Number(book.book_no),
      chapterCount: Number(book.chapter_count),
    }))
    .filter(book =>
      Number.isSafeInteger(book.bookNo) && book.bookNo > 0 &&
      Number.isSafeInteger(book.chapterCount) && book.chapterCount > 0)
    .sort((a, b) => a.bookNo - b.bookNo);
  const index = ordered.findIndex(book => book.bookNo === bookNo);
  if (index < 0 || !Number.isSafeInteger(chapterNo) ||
      chapterNo < 1 || chapterNo > ordered[index].chapterCount) return [];
  const result: BibleChapterTarget[] = [];
  let currentBook = index;
  let currentChapter = chapterNo;
  for (let i = 0; i < Math.max(0, Math.min(3, Math.floor(count))); i++) {
    if (currentChapter < ordered[currentBook].chapterCount) {
      currentChapter += 1;
    } else if (currentBook + 1 < ordered.length) {
      currentBook += 1;
      currentChapter = 1;
    } else {
      break;
    }
    result.push({ bookNo: ordered[currentBook].bookNo, chapterNo: currentChapter });
  }
  return result;
}
