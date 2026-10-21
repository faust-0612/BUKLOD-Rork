import { supabase } from '@/lib/supabase';
import type { ConnectScopeReader } from '@/lib/connectChatWindow';

let readersRpcAvailable: boolean | null = null;

function isMissingRpc(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

function asRows(data: unknown) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object') {
    return [data];
  }

  return [];
}

export function resetConnectScopeReaderAvailabilityForTests() {
  readersRpcAvailable = null;
}

/**
 * Reads the existing scope-read cursors through the review-only list RPC.
 * Returns null when that RPC is not installed. Callers must not invent
 * Seen avatars, and must not write a second cursor of their own.
 * last_read_at comes from buklod_connect_mark_scope_read and is a room
 * cursor, not a per-message receipt.
 */
export async function fetchScopeConnectReaders(
  scopeId: string
): Promise<ConnectScopeReader[] | null> {
  if (!scopeId || readersRpcAvailable === false) {
    return null;
  }

  const result = await (supabase as any).rpc(
    'buklod_connect_scope_readers_v1',
    { _scope_id: scopeId }
  );

  if (result.error) {
    if (isMissingRpc(String(result.error.message ?? ''))) {
      readersRpcAvailable = false;
    }
    return null;
  }

  readersRpcAvailable = true;

  return asRows(result.data)
    .map(row => {
      const userId = String(row.user_id ?? row.userId ?? '').trim();
      const lastReadAt = String(
        row.last_read_at ?? row.lastReadAt ?? ''
      ).trim();

      if (!userId || !lastReadAt) {
        return null;
      }

      const name = String(
        row.display_name ?? row.full_name ?? row.name ?? ''
      ).trim();

      return {
        userId,
        name: name || 'Member',
        avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
        lastReadAt,
      } satisfies ConnectScopeReader;
    })
    .filter((row): row is ConnectScopeReader => !!row);
}
