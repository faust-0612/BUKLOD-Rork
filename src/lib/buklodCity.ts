import { supabase } from '@/lib/supabase';

export type BuklodCityLayer =
  | 'institutions'
  | 'businesses'
  | 'events'
  | 'services'
  | 'bayanihan'
  | 'people';

export type BuklodCityCategory =
  | 'faith'
  | 'school'
  | 'market'
  | 'business'
  | 'organization'
  | 'government'
  | 'community'
  | 'event'
  | 'service'
  | 'bayanihan'
  | 'people';

export type BuklodCityPoint = {
  id: string;
  scopeId?: string | null;
  kind: 'INSTITUTION' | 'EVENT' | 'SERVICE' | 'BAYANIHAN' | 'PERSON';
  category: BuklodCityCategory | string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  verified?: boolean;
  canManage?: boolean;
  isMember?: boolean;
  scopeType?: string | null;
  logoUrl?: string | null;
  locality?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
  precisionMode?: 'APPROXIMATE' | 'EXACT' | null;
  audience?: string | null;
  expiresAt?: string | null;
  isMe?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type BuklodCitySnapshot = {
  institutions: BuklodCityPoint[];
  items: BuklodCityPoint[];
  people: BuklodCityPoint[];
  generatedAt?: string | null;
};

function asPoint(value: unknown): BuklodCityPoint | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const id = String(row.id ?? '').trim();
  const title = String(row.title ?? '').trim();
  if (!id || !title || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    ...(row as unknown as BuklodCityPoint),
    id,
    title,
    latitude,
    longitude,
  };
}

function asPoints(value: unknown): BuklodCityPoint[] {
  if (!Array.isArray(value)) return [];
  return value.map(asPoint).filter(Boolean) as BuklodCityPoint[];
}

export async function getBuklodCitySnapshot(): Promise<BuklodCitySnapshot> {
  const client = supabase as any;
  const { data, error } = await client.rpc('buklod_city_map_snapshot_v1');
  if (error) throw error;
  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    institutions: asPoints(payload.institutions),
    items: asPoints(payload.items),
    people: asPoints(payload.people),
    generatedAt: payload.generatedAt ? String(payload.generatedAt) : null,
  };
}

export async function setBuklodCityPresence(input: {
  latitude: number;
  longitude: number;
  precisionMode: 'APPROXIMATE' | 'EXACT';
  audience: 'FAMILY' | 'FRIENDS' | 'MY_CHURCH' | 'MY_ORGANIZATION' | 'EVENT_GROUP';
  scopeId?: string | null;
  durationMinutes: number;
  audienceUserIds?: string[];
}) {
  const client = supabase as any;
  const { error } = await client.rpc('buklod_city_set_presence_v1', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_precision_mode: input.precisionMode,
    p_audience: input.audience,
    p_scope_id: input.scopeId ?? null,
    p_duration_minutes: input.durationMinutes,
    p_audience_user_ids: input.audienceUserIds ?? [],
  });
  if (error) throw error;
}

export async function stopBuklodCityPresence() {
  const client = supabase as any;
  const { error } = await client.rpc('buklod_city_stop_presence_v1');
  if (error) throw error;
}

export async function setBuklodCityScopeLocation(input: {
  scopeId: string;
  latitude: number;
  longitude: number;
  safeLocationLabel: string;
  category: Exclude<BuklodCityCategory, 'event' | 'service' | 'bayanihan' | 'people'>;
}) {
  const client = supabase as any;
  const { error } = await client.rpc('buklod_city_set_scope_location_v1', {
    p_scope_id: input.scopeId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_safe_location_label: input.safeLocationLabel,
    p_city_category: input.category,
  });
  if (error) throw error;
}

export async function createBuklodCityMapItem(input: {
  scopeId: string;
  itemType: 'EVENT' | 'SERVICE' | 'BAYANIHAN';
  title: string;
  description?: string;
  addressLabel?: string;
  latitude: number;
  longitude: number;
  startsAt?: string | null;
  endsAt?: string | null;
  visibility: 'PUBLIC' | 'SCOPE';
}) {
  const client = supabase as any;
  const { error } = await client.from('buklod_city_map_items').insert({
    scope_id: input.scopeId,
    item_type: input.itemType,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    address_label: input.addressLabel?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    visibility: input.visibility,
    status: 'ACTIVE',
  });
  if (error) throw error;
}

export function cityLayerForPoint(point: BuklodCityPoint): BuklodCityLayer {
  if (point.kind === 'PERSON') return 'people';
  if (point.kind === 'EVENT') return 'events';
  if (point.kind === 'SERVICE') return 'services';
  if (point.kind === 'BAYANIHAN') return 'bayanihan';
  if (point.category === 'business' || point.category === 'market') return 'businesses';
  return 'institutions';
}

export function getBuklodCityPointRoute(point: BuklodCityPoint): string | null {
  if (point.kind !== 'INSTITUTION') return null;
  switch (point.category) {
    case 'faith':
      return '/church';
    case 'school':
      return '/profile/buklod-classrooms';
    case 'market':
      return '/profile/buklod-market';
    case 'business':
      return '/profile/buklod-business';
    case 'government':
      return null;
    default:
      return '/organizations';
  }
}
