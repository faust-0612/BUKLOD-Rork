import { supabase } from '@/lib/supabase';
import type { ConnectScopeReader } from '@/lib/connectChatWindow';

let readersRpcAvailable: boolean | null = null;
let markV2Available: boolean | null = null;

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
  markV2Available = null;
}

/**
 * Authoritative scope read cursors.
 * Returns null when the review-only RPC is not installed. Callers must not
 * invent Seen avatars from mark_scope_read alone.
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

/** Stores a scope read cursor when the review-only function exists. */
export async function markScopeConnectReadV2(scopeId: string) {
  if (!scopeId || markV2Available === false) {
    return;
  }

  const result = await (supabase as any).rpc(
    'buklod_connect_mark_scope_read_v2',
    { _scope_id: scopeId }
  );

  if (result.error) {
    if (isMissingRpc(String(result.error.message ?? ''))) {
      markV2Available = false;
    }
    return;
  }

  markV2Available = true;
}
