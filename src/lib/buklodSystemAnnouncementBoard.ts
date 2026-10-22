import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type SystemAnnouncementSlot = 'public_home' | 'profile';

export type SystemAnnouncementBoard = {
  slot: SystemAnnouncementSlot;
  message: string;
  is_active: boolean;
  updated_at: string | null;
};

const LOCAL_BOARDS_KEY = 'buklod:system-announcement-boards:v1';

function mapRow(
  row: Record<string, unknown> | null | undefined
): SystemAnnouncementBoard | null {
  if (!row) {
    return null;
  }

  const slot = String(row.slot ?? '') as SystemAnnouncementSlot;

  if (slot !== 'public_home' && slot !== 'profile') {
    return null;
  }

  return {
    slot,
    message: String(row.message ?? ''),
    is_active: row.is_active !== false,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

function isMissingTableError(message: string) {
  return /relation.*does not exist|schema cache|could not find the table/i.test(
    message
  );
}

export function isAnnouncementVisible(
  board: SystemAnnouncementBoard | null | undefined
) {
  return !!board?.is_active && !!board.message.trim();
}

async function loadLocalBoards(): Promise<
  Partial<Record<SystemAnnouncementSlot, SystemAnnouncementBoard>>
> {
  const raw = await AsyncStorage.getItem(LOCAL_BOARDS_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      SystemAnnouncementBoard
    >;

    return parsed;
  } catch {
    return {};
  }
}

async function saveLocalBoard(board: SystemAnnouncementBoard) {
  const current = await loadLocalBoards();
  current[board.slot] = board;
  await AsyncStorage.setItem(
    LOCAL_BOARDS_KEY,
    JSON.stringify(current)
  );
}

export async function loadSystemAnnouncementBoard(
  slot: SystemAnnouncementSlot
): Promise<SystemAnnouncementBoard | null> {
  const { data, error } = await supabase
    .from('buklod_system_announcement_boards')
    .select('slot, message, is_active, updated_at')
    .eq('slot', slot)
    .maybeSingle();

  if (!error) {
    const board = mapRow(data as Record<string, unknown>);

    if (isAnnouncementVisible(board) && board) {
      await saveLocalBoard(board);
      return board;
    }

    return null;
  }

  if (isMissingTableError(String(error.message ?? ''))) {
    const local = await loadLocalBoards();
    const board = local[slot] ?? null;
    return isAnnouncementVisible(board) ? board : null;
  }

  throw error;
}

export async function loadSystemAnnouncementBoardForAdmin(
  slot: SystemAnnouncementSlot
): Promise<SystemAnnouncementBoard | null> {
  const { data, error } = await supabase
    .from('buklod_system_announcement_boards')
    .select('slot, message, is_active, updated_at')
    .eq('slot', slot)
    .maybeSingle();

  if (!error) {
    return (
      mapRow(data as Record<string, unknown>) ?? {
        slot,
        message: '',
        is_active: true,
        updated_at: null,
      }
    );
  }

  if (isMissingTableError(String(error.message ?? ''))) {
    const local = await loadLocalBoards();
    return (
      local[slot] ?? {
        slot,
        message: '',
        is_active: true,
        updated_at: null,
      }
    );
  }

  throw error;
}

export async function saveSystemAnnouncementBoard(input: {
  slot: SystemAnnouncementSlot;
  message: string;
  is_active: boolean;
  updated_by?: string | null;
}) {
  const cleanMessage = input.message.trim().slice(0, 2000);
  const payload = {
    slot: input.slot,
    message: cleanMessage,
    is_active: input.is_active,
    updated_by: input.updated_by ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('buklod_system_announcement_boards')
    .upsert(payload, { onConflict: 'slot' });

  if (error) {
    if (isMissingTableError(String(error.message ?? ''))) {
      await saveLocalBoard({
        slot: input.slot,
        message: cleanMessage,
        is_active: input.is_active,
        updated_at: payload.updated_at,
      });
      return;
    }

    throw error;
  }

  await saveLocalBoard({
    slot: input.slot,
    message: cleanMessage,
    is_active: input.is_active,
    updated_at: payload.updated_at,
  });
}
