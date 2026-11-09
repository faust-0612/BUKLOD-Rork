/**
 * BUKLOD reading content is available after a successful authorized online visit.
 * Prefetch runs with bounded concurrency; offline reads never grant points or
 * bypass the server's authoritative publication/access checks.
 */
import { supabase } from '@/lib/supabase';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';

const DAY = 24 * 60 * 60 * 1000;
const FRESH = 6 * 60 * 60 * 1000;
const activeWarmups = new Set<string>();

export type OfflineBibleDay = {
  readingDate: string;
  fallback: { bookNo: number; chapterNo: number } | null;
};

function positiveInteger(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

async function runBounded<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all([0, 1].map(async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        // A single missing or restricted reading must not block the rest.
      }
    }
  }));
}

export async function warmPublishedWordsOffline(
  userId: string,
  publishedIds: string[],
): Promise<void> {
  if (!userId) return;
  const key = 'words:' + userId;
  if (activeWarmups.has(key)) return;
  activeWarmups.add(key);
  try {
    await runBounded([...new Set(publishedIds.filter(Boolean))].slice(0, 12), async id => {
      const cacheKey = 'word-full:' + id;
      const cached = await getOfflineCache<any>(cacheKey, {
        userId, allowStale: true,
      });
      if (cached?.data?.id === id && Date.now() - cached.storedAt < FRESH) return;
      const { data, error } = await supabase.from('devotionals')
        .select('*').eq('id', id).eq('is_published', true).single();
      if (error || !data) return;
      await setOfflineCache(cacheKey, data, { userId, ttlMs: 30 * DAY });
    });
  } finally {
    activeWarmups.delete(key);
  }
}

export async function warmBibleWeekOffline(
  userId: string,
  days: OfflineBibleDay[],
): Promise<void> {
  if (!userId || !days.length) return;
  const key = 'bible:' + userId + ':' + days[0]?.readingDate;
  if (activeWarmups.has(key)) return;
  activeWarmups.add(key);
  try {
    const existing = await getOfflineCache<any>('bible-bootstrap-v1', {
      userId, allowStale: true,
    });
    // Bootstrap metadata so an offline entry does not require first opening My Bible.
    const [translationsResult, preferenceResult, recentResult] = await Promise.allSettled([
      (supabase as any).rpc('get_available_bible_translations'),
      (supabase as any).rpc('get_my_preferred_bible_version'),
      (supabase as any).rpc('get_my_recent_bible_reading', { p_limit: 1 }),
    ]);
    const settledData = (result: PromiseSettledResult<any>) =>
      result.status === 'fulfilled' && !result.value?.error
        ? result.value?.data : null;
    const translations = settledData(translationsResult);
    const preferred = String(settledData(preferenceResult) ??
      existing?.data?.preferred ?? 'ASD').toUpperCase();
    const recentRows = settledData(recentResult);
    const recent = Array.isArray(recentRows)
      ? recentRows[0] ?? null : existing?.data?.recent ?? null;
    if (Array.isArray(translations) && translations.length) {
      await setOfflineCache('bible-bootstrap-v1', {
        translations, preferred, recent,
      }, { userId, ttlMs: 60 * DAY });
    }
    // Match the Bible Reader's translation preference order.
    const recentTranslation = String(recent?.translation_code ?? '').toUpperCase();
    const translation = recentTranslation || preferred || 'ASD';
    const booksKey = 'bible-books-v1:' + translation;
    const cachedBooks = await getOfflineCache<any[]>(booksKey, {
      userId, allowStale: true,
    });
    if (!cachedBooks?.data?.length || Date.now() - cachedBooks.storedAt > 7 * DAY) {
      try {
        const { data, error } = await (supabase as any).rpc(
          'get_bible_books', { p_translation_code: translation });
        if (!error && Array.isArray(data) && data.length) {
          await setOfflineCache(booksKey, data, { userId, ttlMs: 60 * DAY });
        }
      } catch {
        // Previously saved chapters remain readable without book refresh.
      }
    }

    await runBounded(days.slice(0, 7), async day => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.readingDate)) return;
      const planKey = 'bible-daily-plan:' + day.readingDate;
      const savedPlan = await getOfflineCache<any>(planKey, {
        userId, allowStale: true,
      });
      let plan: any = null;
      if (savedPlan?.data?.endBookNo &&
          Date.now() - savedPlan.storedAt < FRESH) {
        plan = {
          start_book_no: savedPlan.data.bookNo,
          start_chapter: savedPlan.data.chapterNo,
          end_book_no: savedPlan.data.endBookNo,
          end_chapter: savedPlan.data.endChapterNo,
        };
      } else {
        try {
          const { data, error } = await (supabase as any).rpc(
            'get_automatic_bible_reading',
            { p_reading_date: day.readingDate },
          );
          if (!error) plan = Array.isArray(data) ? data[0] ?? null : data;
        } catch {
          // Fall back only to the server-provided assignment reference.
        }
      }

      const start = {
        bookNo: positiveInteger(plan?.start_book_no) || day.fallback?.bookNo || 0,
        chapterNo: positiveInteger(plan?.start_chapter) || day.fallback?.chapterNo || 0,
      };
      if (!start.bookNo || !start.chapterNo) return;
      const end = {
        bookNo: positiveInteger(plan?.end_book_no) || start.bookNo,
        chapterNo: positiveInteger(plan?.end_chapter) || start.chapterNo,
      };
      await setOfflineCache(planKey, {
        bookNo: start.bookNo, chapterNo: start.chapterNo,
        endBookNo: end.bookNo, endChapterNo: end.chapterNo,
      }, { userId, ttlMs: 35 * DAY });

      const targets = [start];
      if (end.bookNo !== start.bookNo || end.chapterNo !== start.chapterNo) {
        targets.push(end);
      }
      for (const target of targets) {
        const chapterKey = 'bible-chapter-v1:' + translation + ':' +
          target.bookNo + ':' + target.chapterNo;
        const old = await getOfflineCache<any[]>(chapterKey, {
          userId, allowStale: true,
        });
        if (old?.data?.length && Date.now() - old.storedAt < 18 * 60 * 60 * 1000) {
          continue;
        }
        const { data, error } = await (supabase as any).rpc('get_bible_chapter', {
          p_translation_code: translation,
          p_book_no: target.bookNo,
          p_chapter_no: target.chapterNo,
        });
        if (!error && Array.isArray(data) && data.length) {
          await setOfflineCache(chapterKey, data, { userId, ttlMs: 90 * DAY });
        }
      }
    });
  } finally {
    activeWarmups.delete(key);
  }
}
