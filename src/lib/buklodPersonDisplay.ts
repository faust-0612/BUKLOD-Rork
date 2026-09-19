/**
 * Canonical person display names — never use generic "BUKLOD Member" labels.
 */

import { supabase } from '@/lib/supabase';

export const LEGACY_GENERIC_PERSON_LABELS = [
  'buklod member',
  'member',
  'unnamed',
] as const;

export type PersonNameFields = {
  full_name?: string | null;
  username?: string | null;
  mobile?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  author_name?: string | null;
  commenter_name?: string | null;
  sender_name?: string | null;
  name?: string | null;
};

function isLegacyGenericPersonLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return LEGACY_GENERIC_PERSON_LABELS.includes(
    normalized as (typeof LEGACY_GENERIC_PERSON_LABELS)[number],
  );
}

function formatUsername(username: string) {
  const trimmed = username.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function shortUserLabel(userId: string) {
  const id = userId.trim();
  if (!id) {
    return 'Unknown';
  }

  return id.length > 8 ? `User ${id.slice(0, 8)}` : `User ${id}`;
}

export function needsPersonNameHydration(
  name?: string | null,
) {
  const trimmed = String(name ?? '').trim();
  return !trimmed || isLegacyGenericPersonLabel(trimmed);
}

export function resolvePersonDisplayName(
  source?: PersonNameFields | string | null,
  userId?: string | null,
): string {
  if (typeof source === 'string') {
    const direct = source.trim();
    if (direct && !isLegacyGenericPersonLabel(direct)) {
      return direct;
    }

    return resolvePersonDisplayName(null, userId);
  }

  const candidates = [
    source?.full_name,
    source?.display_name,
    source?.author_name,
    source?.commenter_name,
    source?.sender_name,
    source?.name,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value && !isLegacyGenericPersonLabel(value)) {
      return value;
    }
  }

  const username = formatUsername(String(source?.username ?? ''));
  if (username) {
    return username;
  }

  const mobile = String(source?.mobile ?? '').trim();
  if (mobile) {
    return mobile;
  }

  const resolvedUserId = String(userId ?? source?.user_id ?? '').trim();
  if (resolvedUserId) {
    return shortUserLabel(resolvedUserId);
  }

  return 'Unknown';
}

export type PersonProfileSnapshot = {
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  mobile: string | null;
};

export async function loadPersonDisplayNameMap(
  userIds: string[],
): Promise<Record<string, PersonProfileSnapshot>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map: Record<string, PersonProfileSnapshot> = {};

  if (!uniqueIds.length) {
    return map;
  }

  const rpcResult = await (supabase as any).rpc(
    'get_buklod_profile_names_v1',
    {
      p_user_ids: uniqueIds,
    },
  );

  if (!rpcResult.error) {
    for (const row of rpcResult.data ?? []) {
      const userId = String(row.user_id ?? '').trim();
      const rpcName = String(row.display_name ?? '').trim();

      if (!userId) {
        continue;
      }

      if (rpcName && !isLegacyGenericPersonLabel(rpcName)) {
        map[userId] = {
          full_name: rpcName,
          username: null,
          avatar_url: null,
          mobile: null,
        };
      }
    }
  }

  const missing = uniqueIds.filter((id) => !map[id]);

  if (!missing.length) {
    return map;
  }

  const profileResult = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, mobile')
    .in('id', missing);

  if (!profileResult.error) {
    for (const row of profileResult.data ?? []) {
      const userId = String(row.id ?? '').trim();
      if (!userId) {
        continue;
      }

      const fullName = resolvePersonDisplayName({
        full_name: row.full_name,
        username: row.username,
        mobile: row.mobile,
        user_id: userId,
      });

      map[userId] = {
        full_name: fullName,
        username: row.username ? String(row.username) : null,
        avatar_url: row.avatar_url ? String(row.avatar_url) : null,
        mobile: row.mobile ? String(row.mobile) : null,
      };
    }
  }

  for (const userId of missing) {
    if (!map[userId]) {
      map[userId] = {
        full_name: shortUserLabel(userId),
        username: null,
        avatar_url: null,
        mobile: null,
      };
    }
  }

  return map;
}

export async function loadPersonDisplayNames(
  userIds: string[],
): Promise<Record<string, string>> {
  const profiles = await loadPersonDisplayNameMap(userIds);
  const names: Record<string, string> = {};

  for (const [userId, profile] of Object.entries(profiles)) {
    names[userId] = profile.full_name;
  }

  return names;
}

export async function hydratePersonNamesOnRows<
  T extends Record<string, unknown>,
>(
  rows: T[],
  userIdKey: keyof T,
  nameKey: keyof T,
): Promise<T[]> {
  /*
   * PERF_MAIN_COMMUNITY_R1
   *
   * Most feed RPCs already return a canonical author/commenter name.
   * Only hit the profile-name endpoint for rows that actually need
   * hydration. This removes one avoidable network round-trip from
   * normal Community loads while preserving legacy/generic fallback.
   */
  const userIds = Array.from(
    new Set(
      rows
        .filter((row) =>
          needsPersonNameHydration(
            String(row[nameKey] ?? ''),
          )
        )
        .map((row) => String(row[userIdKey] ?? ''))
        .filter(Boolean)
    )
  );

  if (!userIds.length) {
    return rows;
  }

  const names = await loadPersonDisplayNames(userIds);

  return rows.map((row) => {
    const userId = String(row[userIdKey] ?? '');
    const current = String(row[nameKey] ?? '').trim();
    const resolved =
      current && !isLegacyGenericPersonLabel(current)
        ? current
        : names[userId] ?? resolvePersonDisplayName(null, userId);

    return {
      ...row,
      [nameKey]: resolved,
    };
  });
}
