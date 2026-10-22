import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';

const LOCAL_NOTE_KEY = 'buklod:messages:status-note:v1';

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

async function loadLocalNote(): Promise<MessagesStatusNote | null> {
  const raw = await AsyncStorage.getItem(LOCAL_NOTE_KEY);

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

async function saveLocalNote(note: MessagesStatusNote | null) {
  if (!note || !isActiveNote(note)) {
    await AsyncStorage.removeItem(LOCAL_NOTE_KEY);
    return;
  }

  await AsyncStorage.setItem(LOCAL_NOTE_KEY, JSON.stringify(note));
}

export async function loadMessagesStatusNote(): Promise<MessagesStatusNote | null> {
  const { data, error } = await supabase.rpc(
    'get_buklod_messages_status_note_v1'
  );

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;

    if (row?.quick_note) {
      const note: MessagesStatusNote = {
        quick_note: repairMojibakeText(
          String(row.quick_note)
        ),
        expires_at: String(
          row.expires_at ??
            new Date(Date.now() + 24 * 3600000).toISOString()
        ),
        viewer_count: Math.max(
          0,
          Number(row.viewer_count ?? 0)
        ),
      };

      if (isActiveNote(note)) {
        await saveLocalNote(note);
        return note;
      }

      return null;
    }

    await saveLocalNote(null);
    return null;
  }

  if (isMissingRpcError(String(error.message ?? ''))) {
    return loadLocalNote();
  }

  throw error;
}

export async function saveMessagesStatusNote(
  note: string
): Promise<MessagesStatusNote | null> {
  const trimmed = truncateGraphemes(
    note.trim(),
    80
  );

  if (!trimmed) {
    const { error } = await supabase.rpc(
      'set_buklod_messages_status_note_v1',
      { p_note: '' }
    );

    if (error && !isMissingRpcError(String(error.message ?? ''))) {
      throw error;
    }

    await saveLocalNote(null);
    return null;
  }

  const { error } = await supabase.rpc(
    'set_buklod_messages_status_note_v1',
    { p_note: trimmed }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      const local: MessagesStatusNote = {
        quick_note: trimmed,
        expires_at: new Date(
          Date.now() + 24 * 3600000
        ).toISOString(),
      };

      await saveLocalNote(local);
      return local;
    }

    throw error;
  }

  const saved = await loadMessagesStatusNote();
  return saved;
}
