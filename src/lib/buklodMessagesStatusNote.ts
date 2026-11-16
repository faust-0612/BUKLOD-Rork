import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';

const LOCAL_NOTE_KEY = 'buklod:messages:status-note:v2';

import {
  truncateGraphemes,
} from '@/lib/buklodGraphemeText';

export type MessagesStatusNote = {
  quick_note: string;
  expires_at: string;
  viewer_count?: number;
};

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

// Notes are cached per signed-in user, never globally, to prevent account bleed
// when a user switches accounts without restarting the native process.
const NOTE_WARM_MS = 30_000;
const noteMemory = new Map<string, { value: MessagesStatusNote | null; at: number }>();
const noteInFlight = new Map<string, Promise<MessagesStatusNote | null>>();
const noteVersions = new Map<string, number>();
const noteListeners = new Set<(userId: string, note: MessagesStatusNote | null) => void>();

export function subscribeMessagesStatusNote(
  listener: (userId: string, note: MessagesStatusNote | null) => void,
): () => void {
  noteListeners.add(listener);
  return () => { noteListeners.delete(listener); };
}

function publishNote(userId: string, note: MessagesStatusNote | null) {
  noteMemory.set(userId, { value: note, at: Date.now() });
  for (const listener of noteListeners) listener(userId, note);
}

function invalidatePendingNoteReads(userId: string) {
  noteVersions.set(userId, (noteVersions.get(userId) ?? 0) + 1);
  noteInFlight.delete(userId);
}

export function peekCachedMessagesStatusNote(userId: string): MessagesStatusNote | null {
  const entry = noteMemory.get(userId);
  return entry?.value && isActiveNote(entry.value) ? entry.value : null;
}

function isActiveNote(note: MessagesStatusNote | null) {
  if (!note?.quick_note?.trim()) {
    return false;
  }

  const expires = new Date(note.expires_at).getTime();

  if (!Number.isFinite(expires)) {
    return true;
  }

  return expires > Date.now();
}

export function formatMessagesNoteExpiry(
  expiresAt: string | null | undefined
) {
  if (!expiresAt) {
    return '';
  }

  const diff = new Date(expiresAt).getTime() - Date.now();

  if (!Number.isFinite(diff) || diff <= 0) {
    return 'Expired';
  }

  const hours = Math.max(1, Math.ceil(diff / 3600000));

  if (hours < 24) {
    return `${hours}h left`;
  }

  return '24h left';
}

async function loadLocalNote(userId: string): Promise<MessagesStatusNote | null> {
  const raw = await AsyncStorage.getItem(`${LOCAL_NOTE_KEY}:${userId}`);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MessagesStatusNote;

    return isActiveNote(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function saveLocalNote(userId: string, note: MessagesStatusNote | null) {
  const key = `${LOCAL_NOTE_KEY}:${userId}`;
  if (!note || !isActiveNote(note)) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await AsyncStorage.setItem(key, JSON.stringify(note));
}

/**
 * Returning to Connect/Wall within NOTE_WARM_MS paints the existing note.
 * A single shared request refreshes all mounted consumers after the TTL.
 * Explicit saves bypass it; reads from a previous account cannot be published.
 */
export async function loadMessagesStatusNote(): Promise<MessagesStatusNote | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const cached = noteMemory.get(userId);
  if (cached && Date.now() - cached.at < NOTE_WARM_MS) {
    return peekCachedMessagesStatusNote(userId);
  }

  const running = noteInFlight.get(userId);
  if (running) return running;

  const version = noteVersions.get(userId) ?? 0;
  const request = (async (): Promise<MessagesStatusNote | null> => {
    const { data, error } = await supabase.rpc('get_buklod_messages_status_note_v1');
    let next: MessagesStatusNote | null = null;
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.quick_note) {
        const note: MessagesStatusNote = {
          quick_note: repairMojibakeText(String(row.quick_note)),
          expires_at: String(
            row.expires_at ?? new Date(Date.now() + 24 * 3600000).toISOString()
          ),
          viewer_count: Math.max(0, Number(row.viewer_count ?? 0)),
        };
        next = isActiveNote(note) ? note : null;
      }
    } else if (isMissingRpcError(String(error.message ?? ''))) {
      next = await loadLocalNote(userId);
    } else {
      // A transient failure must not erase an already displayed note.
      // Unknown authorization errors still propagate instead of serving stale data.
      throw error;
    }

    const { data: { session: latestSession } } = await supabase.auth.getSession();
    if (latestSession?.user?.id !== userId) return null;
    if ((noteVersions.get(userId) ?? 0) !== version) {
      return peekCachedMessagesStatusNote(userId);
    }
    publishNote(userId, next);
    if (!error) {
      void saveLocalNote(userId, next).catch(() => undefined);
    }
    return next;
  })();
  noteInFlight.set(userId, request);
  try {
    return await request;
  } finally {
    if (noteInFlight.get(userId) === request) noteInFlight.delete(userId);
  }
}

export async function saveMessagesStatusNote(
  note: string
): Promise<MessagesStatusNote | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sign in to post a note.');

  const trimmed = truncateGraphemes(note.trim(), 80);
  const { error } = await supabase.rpc(
    'set_buklod_messages_status_note_v1',
    { p_note: trimmed }
  );
  if (error && !isMissingRpcError(String(error.message ?? ''))) {
    throw error;
  }

  // Any outstanding read predating this mutation must not undo a new note.
  invalidatePendingNoteReads(userId);

  if (!trimmed) {
    await saveLocalNote(userId, null);
    publishNote(userId, null);
    return null;
  }

  if (error) {
    const local: MessagesStatusNote = {
      quick_note: trimmed,
      expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    };
    await saveLocalNote(userId, local);
    publishNote(userId, local);
    return local;
  }

  // Read the authoritative expiry/viewer count after the server mutation.
  return loadMessagesStatusNote();
}
