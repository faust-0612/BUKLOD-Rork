import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import {
  isSmartDrawerOverdue,
} from './classify';
import type {
  SmartDrawerDraft,
  SmartDrawerItem,
  SmartDrawerItemStatus,
  SmartDrawerItemType,
  SmartDrawerQuery,
  SmartDrawerSummary,
  SmartDrawerSyncState,
} from './types';

const WEB_PREFIX = '@buklod/smart-drawer/v1/';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

let dbPromise: Promise<any> | null = null;

function webKey(userId: string) {
  return `${WEB_PREFIX}${userId}`;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    if (typeof value !== 'string') return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function tokenize(item: Pick<
  SmartDrawerItem,
  'title' | 'body' | 'extractedText' | 'location' | 'type' | 'listItems'
>) {
  const text = [
    item.title,
    item.body,
    item.extractedText,
    item.location,
    item.type,
    ...item.listItems.map(entry => entry.text),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9À-ÿ]+/gi, ' ');

  return Array.from(
    new Set(
      text
        .split(/\s+/)
        .map(value => value.trim())
        .filter(value => value.length >= 2)
        .slice(0, 350),
    ),
  );
}

function rowToItem(row: any): SmartDrawerItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type,
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    extractedText: String(row.extracted_text ?? ''),
    location: String(row.location ?? ''),
    dueAt: row.due_at ?? null,
    eventAt: row.event_at ?? null,
    status: row.status,
    keepOnTop: Number(row.keep_on_top ?? 0) === 1,
    reminderMuted: Number(row.reminder_muted ?? 0) === 1,
    reminderIds: parseJson<string[]>(row.reminder_ids_json, []),
    listItems: parseJson(row.list_items_json, []),
    assets: parseJson(row.assets_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    revision: Number(row.revision ?? 1),
    syncState: row.sync_state,
  };
}

function normalizeItem(
  userId: string,
  draft: SmartDrawerDraft,
  previous?: SmartDrawerItem | null,
): SmartDrawerItem {
  const now = new Date().toISOString();
  return {
    id: draft.id ?? previous?.id ?? Crypto.randomUUID(),
    userId,
    type:
      (draft.type ?? previous?.type ?? 'QUICK_NOTE') as SmartDrawerItemType,
    title: cleanText(draft.title ?? previous?.title ?? 'Untitled'),
    body: String(draft.body ?? previous?.body ?? ''),
    extractedText: String(
      draft.extractedText ?? previous?.extractedText ?? '',
    ),
    location: cleanText(draft.location ?? previous?.location ?? ''),
    dueAt: draft.dueAt !== undefined ? draft.dueAt : previous?.dueAt ?? null,
    eventAt:
      draft.eventAt !== undefined ? draft.eventAt : previous?.eventAt ?? null,
    status:
      (draft.status ?? previous?.status ?? 'ACTIVE') as SmartDrawerItemStatus,
    keepOnTop: Boolean(draft.keepOnTop ?? previous?.keepOnTop ?? false),
    reminderMuted: Boolean(
      draft.reminderMuted ?? previous?.reminderMuted ?? false,
    ),
    reminderIds:
      draft.reminderIds ?? previous?.reminderIds ?? [],
    listItems: draft.listItems ?? previous?.listItems ?? [],
    assets: draft.assets ?? previous?.assets ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt:
      draft.deletedAt !== undefined
        ? draft.deletedAt
        : previous?.deletedAt ?? null,
    revision: (previous?.revision ?? 0) + 1,
    syncState:
      (draft.syncState ?? previous?.syncState ?? 'LOCAL_ONLY') as SmartDrawerSyncState,
  };
}

async function nativeDb() {
  if (Platform.OS === 'web') return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQLite = await import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync('buklod-smart-drawer.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS drawer_items (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          extracted_text TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          due_at TEXT,
          event_at TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          keep_on_top INTEGER NOT NULL DEFAULT 0,
          reminder_muted INTEGER NOT NULL DEFAULT 0,
          reminder_ids_json TEXT NOT NULL DEFAULT '[]',
          list_items_json TEXT NOT NULL DEFAULT '[]',
          assets_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          revision INTEGER NOT NULL DEFAULT 1,
          sync_state TEXT NOT NULL DEFAULT 'LOCAL_ONLY'
        );

        CREATE INDEX IF NOT EXISTS drawer_items_user_status_updated_idx
          ON drawer_items(user_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS drawer_items_user_due_idx
          ON drawer_items(user_id, due_at);
        CREATE INDEX IF NOT EXISTS drawer_items_user_type_idx
          ON drawer_items(user_id, type, updated_at DESC);

        CREATE TABLE IF NOT EXISTS drawer_search_tokens (
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          token TEXT NOT NULL,
          PRIMARY KEY(user_id, item_id, token),
          FOREIGN KEY(item_id) REFERENCES drawer_items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS drawer_search_token_idx
          ON drawer_search_tokens(user_id, token);
      `);
      return db;
    })();
  }
  return dbPromise;
}

async function readWeb(userId: string): Promise<SmartDrawerItem[]> {
  const raw = await AsyncStorage.getItem(webKey(userId));
  const rows = parseJson<SmartDrawerItem[]>(raw, []);
  return rows.filter(row => row.userId === userId);
}

async function writeWeb(
  userId: string,
  rows: SmartDrawerItem[],
) {
  await AsyncStorage.setItem(webKey(userId), JSON.stringify(rows));
}

export async function initializeSmartDrawerStore() {
  if (Platform.OS === 'web') return;
  await nativeDb();
}

export async function getSmartDrawerItem(
  userId: string,
  itemId: string,
): Promise<SmartDrawerItem | null> {
  if (!userId || !itemId) return null;

  if (Platform.OS === 'web') {
    return (
      (await readWeb(userId)).find(
        row => row.id === itemId && row.userId === userId,
      ) ?? null
    );
  }

  const db = await nativeDb();
  const row = await db.getFirstAsync(
    'SELECT * FROM drawer_items WHERE id = ? AND user_id = ? LIMIT 1',
    itemId,
    userId,
  );
  return row ? rowToItem(row) : null;
}

export async function saveSmartDrawerItem(
  userId: string,
  draft: SmartDrawerDraft,
): Promise<SmartDrawerItem> {
  if (!userId) {
    throw new Error('Sign in again before saving to Smart Drawer.');
  }

  const previous = draft.id
    ? await getSmartDrawerItem(userId, draft.id)
    : null;
  const item = normalizeItem(userId, draft, previous);

  if (Platform.OS === 'web') {
    const rows = await readWeb(userId);
    const index = rows.findIndex(row => row.id === item.id);
    if (index >= 0) rows[index] = item;
    else rows.unshift(item);
    await writeWeb(userId, rows.slice(0, 10_000));
    return item;
  }

  const db = await nativeDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO drawer_items(
        id,user_id,type,title,body,extracted_text,location,due_at,event_at,
        status,keep_on_top,reminder_muted,reminder_ids_json,list_items_json,
        assets_json,created_at,updated_at,deleted_at,revision,sync_state
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        type=excluded.type,
        title=excluded.title,
        body=excluded.body,
        extracted_text=excluded.extracted_text,
        location=excluded.location,
        due_at=excluded.due_at,
        event_at=excluded.event_at,
        status=excluded.status,
        keep_on_top=excluded.keep_on_top,
        reminder_muted=excluded.reminder_muted,
        reminder_ids_json=excluded.reminder_ids_json,
        list_items_json=excluded.list_items_json,
        assets_json=excluded.assets_json,
        updated_at=excluded.updated_at,
        deleted_at=excluded.deleted_at,
        revision=excluded.revision,
        sync_state=excluded.sync_state
      WHERE drawer_items.user_id=excluded.user_id`,
      item.id,
      item.userId,
      item.type,
      item.title,
      item.body,
      item.extractedText,
      item.location,
      item.dueAt,
      item.eventAt,
      item.status,
      item.keepOnTop ? 1 : 0,
      item.reminderMuted ? 1 : 0,
      JSON.stringify(item.reminderIds),
      JSON.stringify(item.listItems),
      JSON.stringify(item.assets),
      item.createdAt,
      item.updatedAt,
      item.deletedAt,
      item.revision,
      item.syncState,
    );

    await db.runAsync(
      'DELETE FROM drawer_search_tokens WHERE user_id = ? AND item_id = ?',
      userId,
      item.id,
    );

    for (const token of tokenize(item)) {
      await db.runAsync(
        `INSERT OR IGNORE INTO drawer_search_tokens(user_id,item_id,token)
         VALUES(?,?,?)`,
        userId,
        item.id,
        token,
      );
    }
  });

  return item;
}

function itemMatchesSearch(item: SmartDrawerItem, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean);
  if (!terms.length) return true;

  const haystack = [
    item.title,
    item.body,
    item.extractedText,
    item.location,
    item.type,
    ...item.listItems.map(entry => entry.text),
  ]
    .join(' ')
    .toLowerCase();

  return terms.every(term => haystack.includes(term));
}

function itemMatchesView(item: SmartDrawerItem, view: string) {
  const now = Date.now();
  const due = item.dueAt ? Date.parse(item.dueAt) : NaN;
  const active = item.status === 'ACTIVE';

  switch (view.toLowerCase()) {
    case 'due-soon':
      return (
        active &&
        Number.isFinite(due) &&
        due >= now &&
        due <= now + 7 * 24 * 60 * 60 * 1000
      );
    case 'overdue':
      return isSmartDrawerOverdue(item.dueAt, item.status, now);
    case 'lists':
      return active && ['SHOPPING_LIST', 'CHECKLIST'].includes(item.type);
    case 'writing':
      return active && ['WRITING', 'POEM'].includes(item.type);
    case 'programs':
      return active && item.type === 'PROGRAM';
    case 'ideas':
      return active && item.type === 'IDEA';
    case 'documents':
      return (
        active &&
        ['DOCUMENT', 'RECEIPT', 'NOTICE', 'REFERENCE'].includes(item.type)
      );
    case 'appointments':
      return active && item.type === 'APPOINTMENT';
    case 'events':
      return active && ['EVENT', 'PROGRAM'].includes(item.type);
    case 'tasks':
      return active && ['TASK', 'DUE_TASK'].includes(item.type);
    case 'reference':
      return active && item.type === 'REFERENCE';
    case 'archive':
      return item.status === 'ARCHIVED';
    case 'recently-removed':
      return item.status === 'RECENTLY_REMOVED';
    default:
      return active;
  }
}

function nativeViewWhere(view: string) {
  const normalized = view.toLowerCase();
  const nowIso = new Date().toISOString();
  const soonIso = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  switch (normalized) {
    case 'due-soon':
      return {
        sql: "i.status='ACTIVE' AND i.due_at IS NOT NULL AND i.due_at>=? AND i.due_at<=?",
        params: [nowIso, soonIso],
      };
    case 'overdue':
      return {
        sql: "i.status='ACTIVE' AND i.due_at IS NOT NULL AND i.due_at<?",
        params: [nowIso],
      };
    case 'lists':
      return {
        sql: "i.status='ACTIVE' AND i.type IN ('SHOPPING_LIST','CHECKLIST')",
        params: [],
      };
    case 'writing':
      return {
        sql: "i.status='ACTIVE' AND i.type IN ('WRITING','POEM')",
        params: [],
      };
    case 'programs':
      return {
        sql: "i.status='ACTIVE' AND i.type='PROGRAM'",
        params: [],
      };
    case 'ideas':
      return {
        sql: "i.status='ACTIVE' AND i.type='IDEA'",
        params: [],
      };
    case 'documents':
      return {
        sql: "i.status='ACTIVE' AND i.type IN ('DOCUMENT','RECEIPT','NOTICE','REFERENCE')",
        params: [],
      };
    case 'appointments':
      return {
        sql: "i.status='ACTIVE' AND i.type='APPOINTMENT'",
        params: [],
      };
    case 'events':
      return {
        sql: "i.status='ACTIVE' AND i.type IN ('EVENT','PROGRAM')",
        params: [],
      };
    case 'tasks':
      return {
        sql: "i.status='ACTIVE' AND i.type IN ('TASK','DUE_TASK')",
        params: [],
      };
    case 'reference':
      return {
        sql: "i.status='ACTIVE' AND i.type='REFERENCE'",
        params: [],
      };
    case 'archive':
      return {
        sql: "i.status='ARCHIVED'",
        params: [],
      };
    case 'recently-removed':
      return {
        sql: "i.status='RECENTLY_REMOVED'",
        params: [],
      };
    default:
      return {
        sql: "i.status='ACTIVE'",
        params: [],
      };
  }
}

function nativeOrderBy(view: string) {
  if (view.toLowerCase() === 'for-you') {
    return `ORDER BY
      i.keep_on_top DESC,
      CASE
        WHEN i.due_at IS NOT NULL AND i.due_at < datetime('now') THEN 4
        WHEN i.due_at IS NOT NULL AND i.due_at <= datetime('now','+1 day') THEN 3
        WHEN i.due_at IS NOT NULL AND i.due_at <= datetime('now','+7 day') THEN 2
        WHEN i.type IN ('SHOPPING_LIST','CHECKLIST') THEN 1
        ELSE 0
      END DESC,
      i.updated_at DESC`;
  }

  return 'ORDER BY i.keep_on_top DESC, i.updated_at DESC';
}

function searchTerms(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9À-ÿ]+/gi, ' ')
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length >= 2)
    .slice(0, 8);
}

function relevanceScore(item: SmartDrawerItem) {
  let score = item.keepOnTop ? 10_000 : 0;
  const now = Date.now();
  const due = item.dueAt ? Date.parse(item.dueAt) : NaN;

  if (Number.isFinite(due)) {
    if (due < now) score += 9_000;
    else if (due - now <= 24 * 60 * 60 * 1000) score += 8_000;
    else if (due - now <= 7 * 24 * 60 * 60 * 1000) score += 6_000;
  }

  if (
    ['SHOPPING_LIST', 'CHECKLIST'].includes(item.type) &&
    item.listItems.some(entry => !entry.done)
  ) {
    score += 4_000;
  }

  score += Math.max(
    0,
    3_000 - Math.floor((now - Date.parse(item.updatedAt)) / 60_000),
  );
  return score;
}

export async function querySmartDrawerItems(
  userId: string,
  query: SmartDrawerQuery = {},
): Promise<SmartDrawerItem[]> {
  if (!userId) return [];

  const search = cleanText(query.search);
  const view = cleanText(query.view || 'for-you');
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, query.limit ?? DEFAULT_LIMIT),
  );
  const offset = Math.max(0, query.offset ?? 0);

  if (Platform.OS === 'web') {
    const rows = await readWeb(userId);
    const filtered = rows
      .filter(item => item.userId === userId)
      .filter(item => itemMatchesView(item, view))
      .filter(item => !search || itemMatchesSearch(item, search));

    if (view === 'for-you') {
      filtered.sort((a, b) => relevanceScore(b) - relevanceScore(a));
    } else {
      filtered.sort(
        (a, b) =>
          Number(b.keepOnTop) - Number(a.keepOnTop) ||
          Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      );
    }

    return filtered.slice(offset, offset + limit);
  }

  const db = await nativeDb();
  const where = nativeViewWhere(view);
  const terms = searchTerms(search);
  const searchClauses = terms.map(
    () =>
      `EXISTS (
        SELECT 1
        FROM drawer_search_tokens t
        WHERE t.user_id=i.user_id
          AND t.item_id=i.id
          AND t.token LIKE ?
      )`,
  );

  const sql = `
    SELECT i.*
    FROM drawer_items i
    WHERE i.user_id=?
      AND ${where.sql}
      ${searchClauses.length ? `AND ${searchClauses.join(' AND ')}` : ''}
    ${nativeOrderBy(view)}
    LIMIT ? OFFSET ?
  `;

  const raw = await db.getAllAsync(
    sql,
    userId,
    ...where.params,
    ...terms.map(term => `${term}%`),
    limit,
    offset,
  );

  return raw.map(rowToItem);
}

async function countSmartDrawerView(
  userId: string,
  view: string,
): Promise<number> {
  if (Platform.OS === 'web') {
    const rows = await readWeb(userId);
    return rows.filter(
      item =>
        item.userId === userId &&
        itemMatchesView(item, view),
    ).length;
  }

  const db = await nativeDb();
  const where = nativeViewWhere(view);
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM drawer_items i
     WHERE i.user_id=? AND ${where.sql}`,
    userId,
    ...where.params,
  );
  return Number(row?.count ?? 0);
}

export async function getSmartDrawerSummary(
  userId: string,
): Promise<SmartDrawerSummary> {
  const [
    forYou,
    dueSoon,
    overdue,
    activeLists,
    totalActive,
  ] = await Promise.all([
    querySmartDrawerItems(userId, {
      view: 'for-you',
      limit: 4,
    }),
    countSmartDrawerView(userId, 'due-soon'),
    countSmartDrawerView(userId, 'overdue'),
    countSmartDrawerView(userId, 'lists'),
    countSmartDrawerView(userId, 'for-you'),
  ]);

  return {
    forYou,
    dueSoon,
    overdue,
    activeLists,
    totalActive,
  };
}

export async function setSmartDrawerStatus(
  userId: string,
  itemId: string,
  status: SmartDrawerItemStatus,
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) throw new Error('Drawer item not found.');

  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    status,
    deletedAt:
      status === 'RECENTLY_REMOVED'
        ? new Date().toISOString()
        : status === 'ACTIVE'
          ? null
          : item.deletedAt,
    syncState: item.syncState === 'SYNCED' ? 'LOCAL_ONLY' : item.syncState,
  });
}

export async function setSmartDrawerKeepOnTop(
  userId: string,
  itemId: string,
  keepOnTop: boolean,
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) throw new Error('Drawer item not found.');
  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    keepOnTop,
    syncState: item.syncState === 'SYNCED' ? 'LOCAL_ONLY' : item.syncState,
  });
}

export async function setSmartDrawerReminderMuted(
  userId: string,
  itemId: string,
  reminderMuted: boolean,
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) throw new Error('Drawer item not found.');
  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    reminderMuted,
    syncState: item.syncState === 'SYNCED' ? 'LOCAL_ONLY' : item.syncState,
  });
}

export async function setSmartDrawerReminderIds(
  userId: string,
  itemId: string,
  reminderIds: string[],
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) throw new Error('Drawer item not found.');
  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    reminderIds,
    syncState: item.syncState,
  });
}

export async function toggleSmartDrawerListEntry(
  userId: string,
  itemId: string,
  listId: string,
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) throw new Error('Drawer item not found.');

  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    listItems: item.listItems.map(entry =>
      entry.id === listId
        ? { ...entry, done: !entry.done }
        : entry,
    ),
    syncState: item.syncState === 'SYNCED' ? 'LOCAL_ONLY' : item.syncState,
  });
}

export async function listSmartDrawerPendingSync(
  userId: string,
  limit = 100,
) {
  if (Platform.OS === 'web') {
    return (await readWeb(userId))
      .filter(item => item.syncState !== 'SYNCED')
      .slice(0, limit);
  }

  const db = await nativeDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM drawer_items
     WHERE user_id=? AND sync_state IN ('PENDING','SYNC_ERROR','LOCAL_ONLY')
     ORDER BY updated_at ASC
     LIMIT ?`,
    userId,
    limit,
  );
  return rows.map(rowToItem);
}

export async function markSmartDrawerSynced(
  userId: string,
  itemId: string,
  _cloudUpdatedAt?: string | null,
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) return null;
  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    syncState: 'SYNCED',
  });
}

export async function permanentlyDeleteSmartDrawerItem(
  userId: string,
  itemId: string,
) {
  if (!userId || !itemId) return false;

  if (Platform.OS === 'web') {
    const rows = await readWeb(userId);
    const next = rows.filter(
      item => item.userId === userId && item.id !== itemId,
    );
    await writeWeb(userId, next);
    return next.length !== rows.length;
  }

  const db = await nativeDb();
  const result = await db.runAsync(
    'DELETE FROM drawer_items WHERE user_id=? AND id=?',
    userId,
    itemId,
  );
  return Number(result?.changes ?? 0) > 0;
}

export async function markSmartDrawerSyncError(
  userId: string,
  itemId: string,
) {
  const item = await getSmartDrawerItem(userId, itemId);
  if (!item) return null;
  return saveSmartDrawerItem(userId, {
    ...item,
    id: item.id,
    syncState: 'SYNC_ERROR',
  });
}
