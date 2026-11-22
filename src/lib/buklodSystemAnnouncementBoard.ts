import { supabase } from '@/lib/supabase';

export type SystemAnnouncementSlot = 'public_home' | 'profile';

export type SystemAnnouncementBoard = {
  slot: SystemAnnouncementSlot;
  message: string;
  is_active: boolean;
  updated_at: string | null;
};

function mapRow(
  row: Record<string, unknown> | null | undefined
): SystemAnnouncementBoard | null {
  if (!row) return null;
  const slot = String(row.slot ?? '') as SystemAnnouncementSlot;
  if (slot !== 'public_home' && slot !== 'profile') return null;
  return {
    slot,
    message: String(row.message ?? ''),
    is_active: row.is_active === true,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

export function isAnnouncementVisible(
  board: SystemAnnouncementBoard | null | undefined
) {
  return !!board?.is_active && !!board.message.trim();
}

/**
 * Public announcements must come from the authoritative server.
 * The former device-local fallback could falsely display a locally saved,
 * unshared board when the database table was absent.
 */
export async function loadSystemAnnouncementBoard(
  slot: SystemAnnouncementSlot
): Promise<SystemAnnouncementBoard | null> {
  const { data, error } = await supabase
    .from('buklod_system_announcement_boards')
    .select('slot, message, is_active, updated_at')
    .eq('slot', slot)
    .maybeSingle();

  if (error) throw error;
  const board = mapRow(data as Record<string, unknown> | null);
  return isAnnouncementVisible(board) ? board : null;
}

export async function loadSystemAnnouncementBoardForAdmin(
  slot: SystemAnnouncementSlot
): Promise<SystemAnnouncementBoard> {
  const { data, error } = await supabase
    .from('buklod_system_announcement_boards')
    .select('slot, message, is_active, updated_at')
    .eq('slot', slot)
    .maybeSingle();

  if (error) throw error;
  return mapRow(data as Record<string, unknown> | null) ?? {
    slot,
    message: '',
    is_active: true,
    updated_at: null,
  };
}

export async function saveSystemAnnouncementBoard(input: {
  slot: SystemAnnouncementSlot;
  message: string;
  is_active: boolean;
  updated_by?: string | null;
}): Promise<SystemAnnouncementBoard> {
  const cleanMessage = input.message.trim().slice(0, 2000);
  if (input.is_active && !cleanMessage) {
    throw new Error('An enabled announcement must contain a message.');
  }

  const payload = {
    slot: input.slot,
    message: cleanMessage,
    is_active: input.is_active,
    updated_by: input.updated_by ?? null,
    updated_at: new Date().toISOString(),
  };

  // Only report success when PostgREST returns the authoritative row.
  // In particular, missing tables, RLS rejections and disconnected clients
  // must never silently turn a public announcement into local-only storage.
  const { data, error } = await supabase
    .from('buklod_system_announcement_boards')
    .upsert(payload, { onConflict: 'slot' })
    .select('slot, message, is_active, updated_at')
    .single();

  if (error) throw error;
  const saved = mapRow(data as Record<string, unknown> | null);
  if (!saved ||
      saved.slot !== input.slot ||
      saved.message !== cleanMessage ||
      saved.is_active !== input.is_active) {
    throw new Error('Could not verify the announcement on the server. Check before retrying.');
  }
  return saved;
}
