/*
 * Marites reads the same authorized community feed as the wall.
 * One 40-row page is not the whole story strip: keep asking for the
 * next authorized page until the server returns a short page.
 * A timed-out or failed page keeps rows already received.
 */

export const MARITES_FEED_PAGE_LIMIT = 100;
export const MARITES_FEED_PAGE_TIMEOUT_MS = 8_000;
export const MARITES_FEED_MODE = 'latest';

const MARITES_FEED_MAX_PAGES = 25;

export type MaritesFeedPage = {
  rows: Record<string, unknown>[];
  error?: string | null;
};

export function maritesFeedPageLimit(pageSize?: number) {
  const requested = Math.trunc(pageSize || MARITES_FEED_PAGE_LIMIT);
  return Math.min(
    MARITES_FEED_PAGE_LIMIT,
    Math.max(1, requested),
  );
}

export function maritesFeedPageArgs(
  scopeId: string,
  offset: number,
  limit: number,
) {
  return {
    p_location_scope_id: scopeId || null,
    p_mode: MARITES_FEED_MODE,
    p_limit: limit,
    p_offset: offset,
  };
}

export function withMaritesPageDeadline<T>(
  promise: Promise<T>,
  timeoutMs = MARITES_FEED_PAGE_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Marites shared refresh timed out.'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export async function collectMaritesFeedPages(input: {
  fetchPage: (
    offset: number,
    limit: number,
  ) => Promise<MaritesFeedPage>;
  pageSize?: number;
  maxPages?: number;
}): Promise<{
  rows: Record<string, unknown>[];
  complete: boolean;
  error: string | null;
}> {
  const pageSize = maritesFeedPageLimit(input.pageSize);
  const maxPages = input.maxPages ?? MARITES_FEED_MAX_PAGES;
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    let result: MaritesFeedPage;

    try {
      result = await input.fetchPage(offset, pageSize);
    } catch (error) {
      return {
        rows,
        complete: false,
        error: String((error as Error)?.message ?? error),
      };
    }

    if (result.error) {
      return {
        rows,
        complete: false,
        error: result.error,
      };
    }

    const pageRows = Array.isArray(result.rows) ? result.rows : [];

    if (!pageRows.length) {
      return { rows, complete: true, error: null };
    }

    let added = 0;

    for (const row of pageRows) {
      const id = String(row.id ?? '').trim();

      if (!id || seen.has(id)) {
        continue;
      }

      seen.add(id);
      rows.push(row);
      added += 1;
    }

    /*
     * A full page of ids we already have means offset is no longer
     * moving. Stop with the unique rows instead of paging forever.
     */
    if (added === 0) {
      return { rows, complete: true, error: null };
    }

    offset += pageRows.length;

    if (pageRows.length < pageSize) {
      return { rows, complete: true, error: null };
    }
  }

  return {
    rows,
    complete: false,
    error: 'Marites feed page limit reached before a short page.',
  };
}

export function resolveMaritesVisibleRows<T>(input: {
  current: T[];
  incoming: T[];
  refreshFailed: boolean;
}): { rows: T[]; markFresh: boolean } {
  if (input.refreshFailed) {
    const rows = [...input.current];
    const positions = new Map<unknown, number>();
    rows.forEach((row, index) => positions.set(
      row && typeof row === 'object' && 'id' in row ? (row as { id: unknown }).id : row, index,
    ));
    for (const row of input.incoming) {
      const key = row && typeof row === 'object' && 'id' in row ? (row as { id: unknown }).id : row;
      const index = positions.get(key);
      if (index === undefined) {
        positions.set(key, rows.length);
        rows.push(row);
      } else rows[index] = row;
    }
    return { rows, markFresh: false };
  }

  if (!input.incoming.length) {
    return { rows: input.current, markFresh: false };
  }

  return { rows: input.incoming, markFresh: true };
}
