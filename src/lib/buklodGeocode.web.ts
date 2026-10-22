import type { BuklodCoordinates } from '@/lib/buklodLocation';

function asCoords(
  latitude: unknown,
  longitude: unknown,
): BuklodCoordinates | null {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

export function formatBuklodAddressQuery(parts: {
  addressLine?: string | null;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
  country?: string | null;
}) {
  return [
    parts.addressLine,
    parts.barangay,
    parts.cityMunicipality,
    parts.province,
    parts.country || 'Philippines',
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Browser-safe geocoding for the private Home marker. Avoids importing
 * expo-location during web route discovery/bootstrap.
 */
export async function geocodeBuklodAddress(
  query: string,
): Promise<BuklodCoordinates | null> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return null;

  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      format: 'json',
      limit: '1',
      q: trimmed,
    }).toString();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
    }>;
    const first = Array.isArray(payload) ? payload[0] : null;
    return asCoords(first?.lat, first?.lon);
  } catch {
    return null;
  }
}
