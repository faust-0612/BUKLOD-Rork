import { supabase } from '@/lib/supabase';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';

export type ConnectSuggestedContact = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  shared_scope_label: string | null;
  rank_name: string | null;
  thread_id: string | null;
  unread_count: number;
  quick_note: string | null;
};

const DEFAULT_CIRCLE_RANK =
  'Circle Starter V';

// Shared between Connect and the Community rail, and retained across app restarts.
// Never use an unscoped cache key: suggested peers can differ by signed-in user.
const CONTACT_CACHE_KEY = 'connect-suggested-contacts:v2';
const CONTACT_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_STALE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COALESCE_MS = 15 * 1000;
const contactMemory = new Map<string, { at: number; requestedLimit: number; rows: ConnectSuggestedContact[] }>();
const contactInFlight = new Map<string, Promise<ConnectSuggestedContact[]>>();

function limitedContactRows(rows: ConnectSuggestedContact[], limit: number) {
  return rows.filter(row => !!row?.user_id).slice(0, Math.max(1, Math.min(80, limit)));
}

export async function readCachedConnectSuggestedContacts(
  viewerId: string,
  limit = 40,
): Promise<ConnectSuggestedContact[]> {
  const userId = String(viewerId ?? '').trim();
  if (!userId) return [];

  const warm = contactMemory.get(userId);
  if (warm && Date.now() - warm.at <= MAX_STALE_AGE_MS) {
    return limitedContactRows(warm.rows, limit);
  }

  const cached = await getOfflineCache<ConnectSuggestedContact[]>(
    CONTACT_CACHE_KEY,
    { userId, allowStale: true },
  );
  if (!cached || Date.now() - cached.storedAt > MAX_STALE_AGE_MS ||
      !Array.isArray(cached.data)) {
    return [];
  }

  const rows = limitedContactRows(cached.data, 80);
  contactMemory.set(userId, { at: cached.storedAt, requestedLimit: rows.length, rows });
  return limitedContactRows(rows, limit);
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

function mapRow(row: Record<string, unknown>): ConnectSuggestedContact {
  return {
    user_id: String(row.user_id ?? ''),
    full_name: String(row.full_name ?? 'Member'),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    shared_scope_label: row.shared_scope_label
      ? String(row.shared_scope_label)
      : null,
    rank_name: row.rank_name
      ? String(row.rank_name)
      : null,
    thread_id: row.thread_id ? String(row.thread_id) : null,
    unread_count: Math.max(0, Number(row.unread_count ?? 0)),
    quick_note: row.quick_note
      ? repairMojibakeText(String(row.quick_note))
      : null,
  };
}

function dedupeContacts(
  rows: ConnectSuggestedContact[],
  viewerId?: string | null
) {
  const seen = new Set<string>();
  const out: ConnectSuggestedContact[] = [];

  for (const row of rows) {
    const id = String(row.user_id ?? '').trim();

    if (!id || id === viewerId || seen.has(id)) {
      continue;
    }

    seen.add(id);
    out.push(row);
  }

  return out;
}

async function loadSuggestedFromPersonalThreads(): Promise<
  ConnectSuggestedContact[]
> {
  const { data, error } = await supabase.rpc(
    'buklod_connect_personal_threads'
  );

  if (error) {
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) =>
    mapRow({
      user_id: row.other_user_id,
      full_name: row.other_user_name,
      avatar_url: row.other_avatar_url,
      shared_scope_label: 'Recent chat',
      rank_name: null,
      thread_id: row.thread_id,
      unread_count: row.unread_count,
      quick_note: null,
    })
  );
}

async function loadSuggestedFromScopeMembers(
  limit: number
): Promise<ConnectSuggestedContact[]> {
  // getSession is used only as a local identity hint. Supabase RLS and
  // authenticated RPCs still enforce actual server-side authorization.
  const { data: { session } } = await supabase.auth.getSession();
  const viewerId = session?.user?.id;

  if (!viewerId) {
    return [];
  }

  const { data: memberships, error: membershipError } =
    await supabase
      .from('buklod_scope_memberships')
      .select('scope_id')
      .eq('user_id', viewerId)
      .eq('membership_status', 'ACTIVE')
      .limit(6);

  if (membershipError || !memberships?.length) {
    return [];
  }

  const contacts: ConnectSuggestedContact[] = [];

  for (const membership of memberships) {
    const scopeId = String(membership.scope_id ?? '').trim();

    if (!scopeId) {
      continue;
    }

    const [{ data: scopeRow }, { data: members, error: membersError }] =
      await Promise.all([
        supabase
          .from('buklod_scopes')
          .select('name')
          .eq('id', scopeId)
          .maybeSingle(),
        supabase.rpc('buklod_scope_list_members_v1', {
          p_scope_id: scopeId,
          p_status: 'ACTIVE',
          p_limit: Math.min(limit, 24),
          p_offset: 0,
          p_query: null,
        }),
      ]);

    if (membersError) {
      continue;
    }

    for (const member of members ?? []) {
      contacts.push(
        mapRow({
          user_id: (member as Record<string, unknown>).user_id,
          full_name: (member as Record<string, unknown>).full_name,
          avatar_url: (member as Record<string, unknown>).avatar_url,
          shared_scope_label: scopeRow?.name ?? 'Shared scope',
          rank_name: null,
          thread_id: null,
          unread_count: 0,
          quick_note: null,
        })
      );
    }
  }

  return contacts;
}

async function loadConnectStatusNotes(
  userIds: string[]
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      userIds
        .map(id => String(id ?? '').trim())
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    return new Map();
  }

  const noteByUser = new Map<string, string>();

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'get_buklod_connect_status_notes_v1',
    { p_user_ids: ids }
  );

  if (!rpcError) {
    for (const row of rpcRows ?? []) {
      const note = repairMojibakeText(
        String(
          (row as Record<string, unknown>).quick_note ?? ''
        )
      ).trim();
      const userId = String(
        (row as Record<string, unknown>).user_id ?? ''
      ).trim();

      if (userId && note) {
        noteByUser.set(userId, note);
      }
    }

    return noteByUser;
  }

  if (!isMissingRpcError(String(rpcError.message ?? ''))) {
    console.warn(
      'Connect status notes RPC:',
      String(rpcError.message ?? rpcError)
    );
  }

  const { data } = await supabase
    .from('buklod_profile_status')
    .select('user_id, quick_note, quick_note_expires_at')
    .in('user_id', ids);

  for (const row of data ?? []) {
    const note = repairMojibakeText(
      String(row.quick_note ?? '')
    ).trim();
    const expires = row.quick_note_expires_at
      ? new Date(String(row.quick_note_expires_at)).getTime()
      : null;

    if (!note) {
      continue;
    }

    if (expires && expires <= Date.now()) {
      continue;
    }

    noteByUser.set(String(row.user_id), note);
  }

  return noteByUser;
}

async function attachCircleRanks(
  contacts: ConnectSuggestedContact[]
) {
  const ids = contacts
    .map(contact => contact.user_id)
    .filter(Boolean);

  if (!ids.length) {
    return contacts;
  }

  const rankByUser =
    new Map<string, string>();

  try {
    const { data, error } =
      await supabase.rpc(
        'get_member_circle_ranks_v1',
        {
          p_user_ids: ids,
        }
      );

    if (!error) {
      for (const row of data ?? []) {
        const userId = String(
          row?.user_id ?? ''
        ).trim();
        const rankName = String(
          row?.rank_name ?? ''
        ).trim();

        if (userId && rankName) {
          rankByUser.set(
            userId,
            rankName
          );
        }
      }
    }
  }
  catch (error) {
    console.warn(
      'Connect suggested ranks:',
      String(
        (error as Error)?.message ??
          error
      )
    );
  }

  return contacts.map(contact => ({
    ...contact,
    rank_name:
      rankByUser.get(contact.user_id) ??
      contact.rank_name ??
      DEFAULT_CIRCLE_RANK,
  }));
}

async function attachQuickNotes(
  contacts: ConnectSuggestedContact[]
) {
  const ids = contacts
    .map(contact => contact.user_id)
    .filter(Boolean);

  if (!ids.length) {
    return contacts;
  }

  const noteByUser = await loadConnectStatusNotes(ids);

  return contacts.map(contact => ({
    ...contact,
    quick_note:
      noteByUser.get(contact.user_id) ||
      contact.quick_note?.trim() ||
      null,
  }));
}

export async function enrichConnectSuggestedContactsWithNotes(
  contacts: ConnectSuggestedContact[]
): Promise<ConnectSuggestedContact[]> {
  if (!contacts.length) {
    return contacts;
  }

  const withNotes =
    await attachQuickNotes(contacts);

  return attachCircleRanks(withNotes);
}

async function loadSuggestedContactsFallback(
  limit: number
): Promise<ConnectSuggestedContact[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const [threads, scopeMembers] = await Promise.all([
    loadSuggestedFromPersonalThreads(),
    loadSuggestedFromScopeMembers(limit),
  ]);

  const merged = dedupeContacts(
    [...scopeMembers, ...threads],
    session?.user?.id
  ).slice(0, limit);

  return attachCircleRanks(
    await attachQuickNotes(merged)
  );
}

export async function loadConnectSuggestedContacts(
  limit = 40
): Promise<ConnectSuggestedContact[]> {
  const safeLimit = Math.max(1, Math.min(80, Number(limit) || 40));
  const { data: { session } } = await supabase.auth.getSession();
  const viewerId = session?.user?.id;
  if (!viewerId) return [];

  const warm = contactMemory.get(viewerId);
  if (warm && warm.requestedLimit >= safeLimit &&
      Date.now() - warm.at < REFRESH_COALESCE_MS) {
    return limitedContactRows(warm.rows, safeLimit);
  }
  const inFlightKey = `${viewerId}:${safeLimit}`;
  const running = contactInFlight.get(inFlightKey);
  if (running) return running;

  const task = (async (): Promise<ConnectSuggestedContact[]> => {
  let rows: ConnectSuggestedContact[] = [];

  try {
    const { data, error } = await supabase.rpc(
      'buklod_connect_suggested_contacts_v1',
      { p_limit: safeLimit }
    );

    if (!error) {
      rows = (data ?? [])
        .map((row: Record<string, unknown>) => mapRow(row))
        .filter((row: ConnectSuggestedContact) => !!row.user_id);
    } else if (!isMissingRpcError(String(error.message ?? ''))) {
      console.warn(
        'Suggested contacts RPC:',
        String(error.message ?? error)
      );
    }
  } catch (error) {
    console.warn(
      'Suggested contacts RPC failed:',
      String((error as Error)?.message ?? error)
    );
  }

  if (!rows.length) {
    rows = await loadSuggestedContactsFallback(safeLimit);
  } else {
    rows = dedupeContacts(rows, viewerId);
    rows = await attachQuickNotes(rows);
    rows = await attachCircleRanks(rows);
  }

  const result = limitedContactRows(rows, safeLimit);
  // Do not replace good offline data with a transient failed/empty response.
  // A late result from a previous signed-in account must not be persisted.
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (result.length && currentSession?.user?.id === viewerId) {
    contactMemory.set(viewerId, { at: Date.now(), requestedLimit: safeLimit, rows: result });
    void setOfflineCache(CONTACT_CACHE_KEY, result, {
      userId: viewerId,
      ttlMs: CONTACT_CACHE_TTL_MS,
    }).catch(() => undefined);
  }
  return result;
  })();

  contactInFlight.set(inFlightKey, task);
  try {
    return await task;
  } finally {
    if (contactInFlight.get(inFlightKey) === task) {
      contactInFlight.delete(inFlightKey);
    }
  }
}
