import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  formatBuklodAddressQuery,
  geocodeBuklodAddress,
} from '@/lib/buklodGeocode';
import { supabase } from '@/lib/supabase';

export type BuklodHomeMapLocation = {
  latitude: number;
  longitude: number;
  localityLabel: string | null;
};

type CachedHomeLocation = BuklodHomeMapLocation & {
  query: string;
};

function cacheKey(userId: string) {
  return `buklod.personal-home.map-location.${userId}`;
}

function validCoordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Loads only the signed-in user's own saved residence, geocodes it locally for
 * the current client, and caches the result on that device/browser.
 *
 * The resulting coordinates are intentionally NOT written to the public City
 * snapshot, people presence, or any shared map table. They are for rendering
 * the current user's private Home marker only.
 */
export async function loadMyBuklodHomeMapLocation(
  userId: string,
): Promise<BuklodHomeMapLocation | null> {
  const id = String(userId || '').trim();
  if (!id) return null;

  const { data, error } = await (supabase as any)
    .from('buklod_user_addresses')
    .select(
      'address_line,barangay,city_municipality,province,country,address_completed',
    )
    .eq('user_id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const query = formatBuklodAddressQuery({
    addressLine: data.address_line,
    barangay: data.barangay,
    cityMunicipality: data.city_municipality,
    province: data.province,
    country: data.country,
  });

  if (query.length < 4) {
    return null;
  }

  const localityLabel = [
    data.barangay,
    data.city_municipality,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ') || null;

  try {
    const raw = await AsyncStorage.getItem(cacheKey(id));
    if (raw) {
      const cached = JSON.parse(raw) as CachedHomeLocation;
      if (
        cached?.query === query &&
        validCoordinate(cached.latitude, cached.longitude)
      ) {
        return {
          latitude: Number(cached.latitude),
          longitude: Number(cached.longitude),
          localityLabel,
        };
      }
    }
  } catch {
    // A broken local cache must never block the Community Map.
  }

  const coordinates = await geocodeBuklodAddress(query);
  if (!coordinates) {
    return null;
  }

  const next: CachedHomeLocation = {
    query,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    localityLabel,
  };

  try {
    await AsyncStorage.setItem(cacheKey(id), JSON.stringify(next));
  } catch {
    // Home can still render even when local persistence is unavailable.
  }

  return {
    latitude: next.latitude,
    longitude: next.longitude,
    localityLabel,
  };
}
