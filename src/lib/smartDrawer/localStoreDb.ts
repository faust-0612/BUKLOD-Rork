import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openNativeDrawerDb(): Promise<any> {
  if (!dbPromise) {
    dbPromise = (async () => {
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
