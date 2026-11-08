import { supabase } from '@/lib/supabase';
import { KL_RPC } from '@/lib/kabihasnang-ligaw/rpc';

export type KlReaderPresence = {
  userId: string;
  displayName: string;
  lastSeenAt: string;
  isSelf: boolean;
};

export type KlEpisodeComment = {
  id: string;
  body: string;
  createdAt: string;
  displayName: string;
  isSelf: boolean;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export async function pingKlReading(episodeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(KL_RPC.pingReading, { p_episode_id: episodeId, p_action: 'ping' });
    if (error) return false;
    return asObject(data)?.ok === true;
  } catch {
    return false;
  }
}

export async function listKlReaders(episodeId: string): Promise<{
  count: number;
  readers: KlReaderPresence[];
}> {
  try {
    const { data, error } = await supabase.rpc(KL_RPC.listReaders, { p_episode_id: episodeId });
    if (error) return { count: 0, readers: [] };
    const payload = asObject(data);
    if (!payload || payload.ok !== true) return { count: 0, readers: [] };
    const rows = Array.isArray(payload.readers) ? payload.readers : [];
    const readers = rows.flatMap((row) => {
      const item = asObject(row);
      if (!item || typeof item.display_name !== 'string') return [];
      return [{
        userId: typeof item.user_id === 'string' ? item.user_id : '',
        displayName: item.display_name.slice(0, 80),
        lastSeenAt: typeof item.last_seen_at === 'string' ? item.last_seen_at : '',
        isSelf: item.is_self === true,
      }];
    });
    const count = typeof payload.count === 'number' ? payload.count : readers.length;
    return { count, readers };
  } catch {
    return { count: 0, readers: [] };
  }
}

export async function listKlComments(episodeId: string): Promise<KlEpisodeComment[]> {
  try {
    const { data, error } = await supabase.rpc(KL_RPC.listComments, {
      p_episode_id: episodeId,
      p_limit: 40,
    });
    if (error) return [];
    const payload = asObject(data);
    if (!payload || payload.ok !== true) return [];
    const rows = Array.isArray(payload.comments) ? payload.comments : [];
    return rows.flatMap((row) => {
      const item = asObject(row);
      if (!item || typeof item.body !== 'string' || typeof item.id !== 'string') return [];
      return [{
        id: item.id,
        body: item.body.slice(0, 500),
        createdAt: typeof item.created_at === 'string' ? item.created_at : '',
        displayName: typeof item.display_name === 'string' ? item.display_name.slice(0, 80) : 'Miyembro',
        isSelf: item.is_self === true,
      }];
    });
  } catch {
    return [];
  }
}

export async function addKlComment(
  episodeId: string,
  body: string,
): Promise<{ ok: boolean; comment: KlEpisodeComment | null; error?: string }> {
  const trimmed = body.trim().slice(0, 500);
  if (trimmed.length < 12) return { ok: false, comment: null, error: 'Kailangan ng 12 karakter o higit pa ang repleksyon.' };
  try {
    const { data, error } = await supabase.rpc(KL_RPC.addComment, {
      p_episode_id: episodeId,
      p_body: trimmed,
      p_parent_id: null,
    });
    if (error) return { ok: false, comment: null, error: String(error.message || 'Hindi maipadala ngayon.').slice(0,160) };
    const payload = asObject(data);
    if (!payload || payload.ok !== true) {
      return { ok: false, comment: null, error: typeof payload?.error === 'string' ? payload.error : 'Hindi maipadala ngayon.' };
    }
    const item = asObject(payload.comment);
    if (!item || typeof item.id !== 'string' || typeof item.body !== 'string') {
      return { ok: false, comment: null, error: 'server' };
    }
    return {
      ok: true,
      comment: {
        id: item.id,
        body: item.body,
        createdAt: typeof item.created_at === 'string' ? item.created_at : new Date().toISOString(),
        displayName: typeof item.display_name === 'string' ? item.display_name : 'Miyembro',
        isSelf: true,
      },
    };
  } catch {
    return { ok: false, comment: null, error: 'server' };
  }
}

export function formatReaderStamp(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
