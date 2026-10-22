import {
  discoverChurches,
  joinChurch,
  respondChurchInvite,
  type ChurchSummary,
} from '@/lib/buklodChurches';
import type { BuklodCoordinates } from '@/lib/buklodLocation';
import {
  resolveDiscoveryScopeTypes,
  type BuklodDiscoveryMode,
} from '@/lib/buklodScopeDiscovery';
import { supabase } from '@/lib/supabase';

export type ChurchFinderPerson = {
  user_id: string;
  display_name: string;
};

export type ChurchFinderJoinPolicy =
  | 'REQUEST'
  | 'INVITE'
  | 'OPEN'
  | 'PRIVATE';

export type ChurchFinderRow = {
  scope_id: string;
  scope_name: string;
  scope_type: string;
  safe_location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  visibility: string;
  join_policy: ChurchFinderJoinPolicy;
  membership_state: string | null;
  accountability_ready: boolean;
  pastors: ChurchFinderPerson[];
  mentors: ChurchFinderPerson[];
  is_admin?: boolean;
};

export type ChurchReadinessBucket =
  | 'ready'
  | 'missing_pastor_mentor'
  | 'missing_map'
  | 'private_invite'
  | 'pending_setup';

export type ChurchReadinessRow = {
  scope_id: string;
  scope_name: string;
  bucket: ChurchReadinessBucket;
  accountability_ready: boolean;
  has_map: boolean;
  visibility: string;
  scope_status: string | null;
};

export type ChurchReadinessSummary = {
  ready: number;
  missing_pastor_mentor: number;
  missing_map: number;
  private_invite: number;
  pending_setup: number;
  rows: ChurchReadinessRow[];
};

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data == null) return [];
  return [data as T];
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message,
  );
}

export function isPastorOrMentorRoleName(name: string) {
  return /(^|[^a-z])(pastor|mentor)([^a-z]|$)/i.test(
    String(name ?? '').trim(),
  );
}

export function isPastorRoleName(name: string) {
  return /(^|[^a-z])pastor([^a-z]|$)/i.test(String(name ?? '').trim());
}

export function isMentorRoleName(name: string) {
  return /(^|[^a-z])mentor([^a-z]|$)/i.test(String(name ?? '').trim());
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(
  from: BuklodCoordinates,
  to: BuklodCoordinates,
): number {
  const earthKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatChurchDistance(km: number | null | undefined) {
  if (km == null || !Number.isFinite(km)) {
    return null;
  }

  if (km < 0.1) {
    return 'Nearby';
  }

  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function churchFinderCacheKey(query: string) {
  return `church_finder:${query.trim().toLowerCase() || 'all'}`;
}

function parsePeople(value: unknown): ChurchFinderPerson[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const people: ChurchFinderPerson[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const userId = String(row.user_id ?? row.id ?? '').trim();
    const displayName = String(
      row.display_name ?? row.full_name ?? row.name ?? '',
    ).trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    people.push({
      user_id: userId,
      display_name: displayName || 'Member',
    });
  }

  return people;
}

export function isPubliclyDiscoverable(row: Pick<
  ChurchFinderRow,
  'visibility' | 'accountability_ready' | 'latitude' | 'longitude'
>) {
  const visibility = String(row.visibility ?? '').toUpperCase();
  if (visibility !== 'PUBLIC') return false;
  if (!row.accountability_ready) return false;
  if (row.latitude == null || row.longitude == null) return false;
  return Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
}

function parseJoinPolicy(value: unknown): ChurchFinderJoinPolicy {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase();

  if (raw === 'OPEN' || raw === 'JOIN') return 'OPEN';
  if (raw === 'INVITE' || raw === 'INVITE_ONLY') return 'INVITE';
  if (raw === 'PRIVATE') return 'PRIVATE';
  return 'REQUEST';
}

function mapSearchRow(row: Record<string, unknown>): ChurchFinderRow | null {
  const scopeId = String(row.scope_id ?? row.id ?? '').trim();
  const scopeName = String(row.scope_name ?? row.name ?? '').trim();
  if (!scopeId || !scopeName) return null;

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const distance = Number(row.distance_km);

  return {
    scope_id: scopeId,
    scope_name: scopeName,
    scope_type: String(row.scope_type ?? 'CHURCH').trim() || 'CHURCH',
    safe_location_label: row.safe_location_label
      ? String(row.safe_location_label)
      : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    distance_km: Number.isFinite(distance) ? distance : null,
    visibility: String(row.visibility ?? 'PUBLIC').trim() || 'PUBLIC',
    join_policy: parseJoinPolicy(row.join_policy ?? row.visibility),
    membership_state: row.membership_state
      ? String(row.membership_state)
      : row.membership_status
        ? String(row.membership_status)
        : null,
    accountability_ready: Boolean(row.accountability_ready),
    pastors: parsePeople(row.pastors),
    mentors: parsePeople(row.mentors),
    is_admin: row.is_admin == null ? undefined : Boolean(row.is_admin),
  };
}

function churchSummaryToFinderRow(
  item: ChurchSummary,
  coords: BuklodCoordinates | null,
): ChurchFinderRow {
  const location = [item.barangay, item.city_municipality]
    .filter(Boolean)
    .join(', ');
  const lat = Number((item as ChurchSummary & { latitude?: number }).latitude);
  const lng = Number((item as ChurchSummary & { longitude?: number }).longitude);
  const churchCoords =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng }
      : null;
  const distance =
    coords && churchCoords ? haversineKm(coords, churchCoords) : null;

  return {
    scope_id: item.scope_id,
    scope_name: item.name,
    scope_type: 'CHURCH',
    safe_location_label: location || null,
    latitude: churchCoords?.latitude ?? null,
    longitude: churchCoords?.longitude ?? null,
    distance_km: distance,
    visibility: item.visibility,
    join_policy:
      item.visibility === 'INVITE_ONLY'
        ? 'INVITE'
        : item.visibility === 'PRIVATE'
          ? 'PRIVATE'
          : 'REQUEST',
    membership_state: item.membership_status,
    accountability_ready: false,
    pastors: [],
    mentors: [],
    is_admin: item.is_admin,
  };
}

function mergeChurchFinderRows(
  primary: ChurchFinderRow[],
  extra: ChurchFinderRow[],
) {
  const seen = new Set(primary.map((row) => row.scope_id));
  const merged = [...primary];
  for (const row of extra) {
    if (!seen.has(row.scope_id)) {
      merged.push(row);
      seen.add(row.scope_id);
    }
  }
  return merged;
}

async function loadChurchOrganizationRows(
  query: string | null,
  coords: BuklodCoordinates | null | undefined,
  limit: number,
): Promise<ChurchFinderRow[]> {
  try {
    const { data, error } = await (supabase as any).rpc(
      'buklod_find_church_organizations_v1',
      {
        p_query: query,
        p_latitude: coords?.latitude ?? null,
        p_longitude: coords?.longitude ?? null,
        p_limit: limit,
      },
    );
    if (error) {
      if (isMissingRpcError(String(error.message ?? ''))) {
        return [];
      }
      return [];
    }
    return asRows<Record<string, unknown>>(data)
      .map(mapSearchRow)
      .filter((row): row is ChurchFinderRow => Boolean(row));
  } catch {
    return [];
  }
}

export async function searchAccountabilityScopes(input: {
  query?: string;
  coords?: BuklodCoordinates | null;
  limit?: number;
  offset?: number;
  scopeId?: string | null;
  mode?: BuklodDiscoveryMode;
  extraTypes?: string[];
}): Promise<ChurchFinderRow[]> {
  const query = input.query?.trim() || null;
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
  const offset = Math.max(input.offset ?? 0, 0);
  const scopeTypes = resolveDiscoveryScopeTypes({
    mode: input.mode ?? 'nearby_churches',
    extraTypes: input.extraTypes,
  });

  const { data, error } = await (supabase as any).rpc(
    'buklod_accountability_search_scopes_v1',
    {
      p_query: query,
      p_latitude: input.coords?.latitude ?? null,
      p_longitude: input.coords?.longitude ?? null,
      p_limit: limit,
      p_offset: offset,
      p_scope_id: input.scopeId?.trim() || null,
      p_scope_types: scopeTypes,
    },
  );

  if (!error) {
    const discoveredOrgs = await loadChurchOrganizationRows(query, input.coords, limit);
    const merged = mergeChurchFinderRows(
      asRows<Record<string, unknown>>(data)
        .map(mapSearchRow)
        .filter((row): row is ChurchFinderRow => Boolean(row)),
      discoveredOrgs,
    );

    return merged.filter((row) => {
        if (!row) return false;
        if ((input.mode ?? 'nearby_churches') !== 'nearby_churches') {
          return true;
        }
        const churchType = row.scope_type.toUpperCase();
        if (churchType !== 'CHURCH' && churchType !== 'ORGANIZATION') {
          return false;
        }
        const visibility = row.visibility.toUpperCase();
        const authorized =
          Boolean(row.membership_state) || Boolean(row.is_admin);
        if (input.scopeId) {
          return true;
        }
        if (
          visibility === 'PRIVATE' ||
          visibility === 'INVITE_ONLY' ||
          visibility === 'INVITE'
        ) {
          return authorized;
        }
        if (authorized) return true;
        return isPubliclyDiscoverable(row);
      });
  }

  const message = String(error?.message ?? '');
  if (!isMissingRpcError(message)) {
    throw error;
  }

  const discovered = await discoverChurches(query ?? '');
  const mapped = discovered
    .map((item) => churchSummaryToFinderRow(item, input.coords ?? null))
    .filter((row) => {
      if (input.scopeId) return row.scope_id === input.scopeId;
      const authorized =
        Boolean(row.membership_state) || Boolean(row.is_admin);
      if (authorized) return true;
      return isPubliclyDiscoverable(row);
    });

  mapped.sort((a, b) => {
    const da = a.distance_km;
    const db = b.distance_km;
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
    return a.scope_name.localeCompare(b.scope_name);
  });

  return mapped.slice(offset, offset + limit);
}

export async function setChurchMapLocation(input: {
  scopeId: string;
  latitude: number;
  longitude: number;
  safeLocationLabel: string;
}) {
  const { error } = await (supabase as any).rpc(
    'buklod_set_church_map_location_v1',
    {
      p_scope_id: input.scopeId,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_safe_location_label: input.safeLocationLabel.trim() || null,
    },
  );

  if (error) throw error;
}

export async function fetchChurchReadinessSummary(): Promise<ChurchReadinessSummary> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_church_readiness_summary_v1',
  );

  if (error) throw error;

  const rows = asRows<Record<string, unknown>>(data?.rows ?? data).map(
    (row) =>
      ({
        scope_id: String(row.scope_id ?? ''),
        scope_name: String(row.scope_name ?? ''),
        bucket: String(row.bucket ?? 'pending_setup') as ChurchReadinessBucket,
        accountability_ready: Boolean(row.accountability_ready),
        has_map: Boolean(row.has_map),
        visibility: String(row.visibility ?? ''),
        scope_status: row.scope_status ? String(row.scope_status) : null,
      }) satisfies ChurchReadinessRow,
  );

  const counts = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};

  const countBy = (bucket: ChurchReadinessBucket) =>
    Number(counts[bucket] ?? rows.filter((row) => row.bucket === bucket).length);

  return {
    ready: countBy('ready'),
    missing_pastor_mentor: countBy('missing_pastor_mentor'),
    missing_map: countBy('missing_map'),
    private_invite: countBy('private_invite'),
    pending_setup: countBy('pending_setup'),
    rows,
  };
}

export async function requestChurchMembership(scopeId: string) {
  return joinChurch(scopeId);
}

export async function acceptChurchInvite(scopeId: string) {
  await respondChurchInvite(scopeId, true);
}
