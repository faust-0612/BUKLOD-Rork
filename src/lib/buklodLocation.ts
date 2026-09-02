import * as Location from 'expo-location';

export type BuklodCoordinates = {
  latitude: number;
  longitude: number;
};

export type BuklodLocationResult =
  | {
      ok: true;
      coords: BuklodCoordinates;
      source: 'current' | 'last_known';
    }
  | {
      ok: false;
      reason:
        | 'permission_denied'
        | 'services_off'
        | 'unavailable'
        | 'timeout';
      message: string;
    };

const LOCATION_TIMEOUT_MS = 12_000;

function asCoords(
  coords: {
    latitude?: number;
    longitude?: number;
  } | null
    | undefined,
): BuklodCoordinates | null {
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('timeout'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function getBuklodForegroundPermissionStatus() {
  try {
    return await Location.getForegroundPermissionsAsync();
  } catch {
    return {
      status: Location.PermissionStatus.UNDETERMINED,
      granted: false,
      canAskAgain: true,
    };
  }
}

export async function requestBuklodForegroundPermission() {
  try {
    return await Location.requestForegroundPermissionsAsync();
  } catch {
    return {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
    };
  }
}

export async function getBuklodForegroundLocation(): Promise<BuklodLocationResult> {
  try {
    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      return {
        ok: false,
        reason: 'services_off',
        message: 'Turn on Location Services to see nearby churches.',
      };
    }

    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'Location permission is off.',
      };
    }

    try {
      const current = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        LOCATION_TIMEOUT_MS,
      );
      const coords = asCoords(current?.coords);
      if (coords) {
        return { ok: true, coords, source: 'current' };
      }
    } catch (error: unknown) {
      const message = String(
        error instanceof Error ? error.message : error,
      ).toLowerCase();

      if (!message.includes('timeout')) {
        // Fall through to last-known.
      } else {
        const last = asCoords(
          (await Location.getLastKnownPositionAsync())?.coords,
        );
        if (last) {
          return { ok: true, coords: last, source: 'last_known' };
        }

        return {
          ok: false,
          reason: 'timeout',
          message: "We couldn't get your current location.",
        };
      }
    }

    const lastKnown = asCoords(
      (await Location.getLastKnownPositionAsync())?.coords,
    );
    if (lastKnown) {
      return { ok: true, coords: lastKnown, source: 'last_known' };
    }

    return {
      ok: false,
      reason: 'unavailable',
      message: "We couldn't get your current location.",
    };
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      message: "We couldn't get your current location.",
    };
  }
}
