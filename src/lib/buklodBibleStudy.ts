/**
 * Optional My Bible study resources. Reading never depends on either host.
 *
 * Matthew Henry: public-domain commentary from Free Use Bible API.
 * Strong's: CC0 tagged KJV chapter files from jsonBible.org.
 * A tag is shown only when its literal word matches the locally displayed
 * KJV verse; never attribute Strong's numbers to unmatched translations.
 */
import { useEffect, useState } from 'react';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';

const BOOK_CODES = [
  'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA',
  '1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO',
  'ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO',
  'OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL',
  'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL',
  'EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM',
  'HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV',
] as const;

export type TaggedKjvWord = [string, string[]];
export type BibleStudyChapter = {
  key: string;
  commentary: Record<number, string>;
  kjvStrong: Record<number, TaggedKjvWord[]>;
};
export type StrongSegment = { text: string; strongs: string[] };

const memory = new Map<string, BibleStudyChapter>();
const maxCacheEntries = 8;
const EMPTY: BibleStudyChapter = { key: '', commentary: {}, kjvStrong: {} };

function store(key: string, value: BibleStudyChapter) {
  memory.delete(key);
  memory.set(key, value);
  if (memory.size > maxCacheEntries) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

export function studyBookCode(bookNo: number) {
  return Number.isInteger(bookNo) && bookNo >= 1 && bookNo <= 66
    ? BOOK_CODES[bookNo - 1]
    : null;
}

export function strongLexiconUrl(strong: string): string | null {
  const m = /^([HG])0*([0-9]{1,5})$/.exec(strong.trim().toUpperCase());
  if (!m || Number(m[2]) <= 0) return null;
  return `https://biblehub.com/${m[1] === 'H' ? 'hebrew' : 'greek'}/${Number(m[2])}.htm`;
}

function stringifyCommentary(value: unknown, depth = 0): string {
  if (depth > 5) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(v => stringifyCommentary(v, depth + 1)).filter(Boolean).join(' ');
  if (value && typeof value === 'object') {
    const part = value as Record<string, unknown>;
    if (part.type === 'footnote_reference') return '';
    return stringifyCommentary(part.text ?? part.content ?? '', depth + 1);
  }
  return '';
}

export function parseMatthewHenryChapter(value: unknown): Record<number, string> {
  const rows: Record<number, string> = {};
  if (!value || typeof value !== 'object') return rows;
  const root = value as { chapter?: { content?: unknown }; content?: unknown };
  const blocks = root.chapter?.content ?? root.content;
  if (!Array.isArray(blocks)) return rows;
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const row = block as { type?: unknown; number?: unknown; content?: unknown; text?: unknown };
    if (row.type !== 'verse') continue;
    const n = Number(row.number);
    if (!Number.isInteger(n) || n < 1 || n > 176) continue;
    const value = stringifyCommentary(row.content ?? row.text).trim();
    if (value) rows[n] = value.slice(0, 24000);
  }
  return rows;
}

export function parseTaggedKjvChapter(value: unknown): Record<number, TaggedKjvWord[]> {
  const result: Record<number, TaggedKjvWord[]> = {};
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  const verses = raw.verses && typeof raw.verses === 'object'
    ? raw.verses as Record<string, unknown> : raw;
  for (const [key, row] of Object.entries(verses)) {
    const number = Number(key);
    if (!Number.isInteger(number) || number < 1 || number > 176 || !row || typeof row !== 'object') continue;
    const tags = (row as { w?: unknown }).w;
    if (!Array.isArray(tags)) continue;
    const valid: TaggedKjvWord[] = [];
    for (const pair of tags) {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string' || !Array.isArray(pair[1])) continue;
      const word = pair[0].trim();
      const refs = pair[1].filter((x: unknown): x is string => typeof x === 'string' && strongLexiconUrl(x) !== null);
      if (word && refs.length) valid.push([word, refs.slice(0, 5)]);
    }
    if (valid.length) result[number] = valid;
  }
  return result;
}

/**
 * Conservative alignment: preserve every character of the Supabase KJV text.
 * A word can be highlighted only at the same position in source order.
 * If the source verse and displayed verse disagree substantially, no tags
 * are rendered rather than silently assigning a wrong Strong's reference.
 */
export function alignKjvStrongWords(text: string, tags: TaggedKjvWord[] | undefined): StrongSegment[] {
  if (!tags?.length || !text) return [{ text, strongs: [] }];
  const segments: StrongSegment[] = [];
  let cursor = 0, hits = 0;
  for (const [word, refs] of tags) {
    if (!word || !refs.length) continue;
    const match = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase(), cursor);
    if (match < 0 || match - cursor > 38) return [{ text, strongs: [] }];
    const left = match === 0 ? '' : text[match - 1];
    const right = text[match + word.length] ?? '';
    if (/[A-Za-z]/.test(left) || /[A-Za-z]/.test(right)) return [{ text, strongs: [] }];
    if (match > cursor) segments.push({ text: text.slice(cursor, match), strongs: [] });
    segments.push({ text: text.slice(match, match + word.length), strongs: refs });
    cursor = match + word.length;
    hits++;
  }
  // Do not show a partial/accidental alignment of unrelated KJV editions.
  if (hits < 2) return [{ text, strongs: [] }];
  if (cursor < text.length) segments.push({ text: text.slice(cursor), strongs: [] });
  return segments;
}

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Bible study source ${response.status}`);
  return response.json();
}

export function useBuklodBibleChapterStudy(params: {
  enabled: boolean;
  bookNo: number;
  chapterNo: number;
  translation: string;
  accountId: string;
  online: boolean;
}): BibleStudyChapter {
  const { enabled, bookNo, chapterNo, translation, accountId, online } = params;
  const key = `bible-study-v1:${bookNo}:${chapterNo}`;
  const [study, setStudy] = useState<BibleStudyChapter>(EMPTY);

  useEffect(() => {
    if (!enabled || !studyBookCode(bookNo) || !Number.isInteger(chapterNo) || chapterNo < 1 || !accountId) {
      setStudy(EMPTY);
      return;
    }
    let active = true;
    const abort = new AbortController();
    // Bound requests to prevent a slow optional source delaying reading.
    const timer = setTimeout(() => abort.abort(), 8500);
    const code = studyBookCode(bookNo);
    if (!code) return;
    const previous = memory.get(key);
    setStudy(previous ?? EMPTY);
    void (async () => {
      try {
        const cached = await getOfflineCache<BibleStudyChapter>(key, { userId: accountId, allowStale: true });
        if (!active) return;
        if (cached?.data?.key === key && !previous) {
          store(key, cached.data);
          setStudy(cached.data);
        }
      } catch { /* Study extras must never block the Bible. */ }
      if (!online) return;
      const commentaryUrl = `https://bible.helloao.org/api/c/matthew-henry/${code}/${chapterNo}.json`;
      const strongsUrl = `https://jsonbible.org/v1/kjvstrongs/${String(bookNo).padStart(2,'0')}/${String(chapterNo).padStart(3,'0')}.json`;
      const [commentary, strongs] = await Promise.allSettled([
        readJson(commentaryUrl, abort.signal),
        translation === 'KJV' ? readJson(strongsUrl, abort.signal) : Promise.resolve(null),
      ]);
      if (!active) return;
      const result: BibleStudyChapter = {
        key,
        commentary: commentary.status === 'fulfilled'
          ? parseMatthewHenryChapter(commentary.value)
          : previous?.commentary ?? {},
        kjvStrong: strongs.status === 'fulfilled'
          ? parseTaggedKjvChapter(strongs.value)
          : previous?.kjvStrong ?? {},
      };
      // Persist a chapter only when a real source supplied study data.
      if (Object.keys(result.commentary).length || Object.keys(result.kjvStrong).length) {
        store(key, result);
        setStudy(result);
        void setOfflineCache(key, result, {
          userId: accountId, ttlMs: 30 * 24 * 60 * 60 * 1000,
        }).catch(() => undefined);
      }
    })().finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [enabled, bookNo, chapterNo, translation, accountId, online, key]);
  return study.key === key && enabled ? study : EMPTY;
}
