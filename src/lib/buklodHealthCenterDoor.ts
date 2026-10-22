export const HEALTH_CENTER_ROOT_URL = "https://buklod-health-center.vercel.app";
export const HEALTH_CENTER_STATUS_URL = "https://buklod-health-center.vercel.app/api/status";
export const HEALTH_CENTER_EMERGENCY_URL = "https://buklod-health-center.vercel.app/more/emergency";
export const HEALTH_CENTER_STATUS_TIMEOUT_MS = 4000;
export const HEALTH_CENTER_STATUS_CACHE_MS = 60_000;

export const HEALTH_CENTER_OFFLINE_NOTICE =
  "You're offline. Health Center online services are unavailable. If Health Center was previously opened on this device, some locally stored health information may still be available there.";

export const HEALTH_CENTER_UNAVAILABLE_NOTICE =
  "Health Center is temporarily unavailable. Your locally stored Health Center records are not automatically deleted.";

export type HealthCenterDoorIndicator = "ONLINE" | "CHECKING" | "OFFLINE" | "SERVICE_UNAVAILABLE";

/** No reliable cross-app entitlement source exists. Do not invent FREE, PLUS, or FAMILY. */
export function healthCenterEntitlementLabel(): null {
  return null;
}

export type HealthCenterDoorState = {
  indicator: HealthCenterDoorIndicator;
  notice: string | null;
  url: string;
  cached: boolean;
};

let cache: { at: number; indicator: "ONLINE" | "SERVICE_UNAVAILABLE" } | null = null;

export function resetHealthCenterDoorCacheForTests(): void {
  cache = null;
}

export function initialHealthCenterDoorState(): HealthCenterDoorState {
  return {
    indicator: "CHECKING",
    notice: null,
    url: HEALTH_CENTER_ROOT_URL,
    cached: false,
  };
}

export async function resolveHealthCenterDoor(options: {
  deviceOnline: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  cacheMs?: number;
}): Promise<HealthCenterDoorState> {
  const now = options.now ?? Date.now();
  const cacheMs = options.cacheMs ?? HEALTH_CENTER_STATUS_CACHE_MS;
  if (!options.deviceOnline) {
    return {
      indicator: "OFFLINE",
      notice: HEALTH_CENTER_OFFLINE_NOTICE,
      url: HEALTH_CENTER_ROOT_URL,
      cached: false,
    };
  }
  if (cache && now - cache.at < cacheMs) {
    return {
      indicator: cache.indicator,
      notice: cache.indicator === "SERVICE_UNAVAILABLE" ? HEALTH_CENTER_UNAVAILABLE_NOTICE : null,
      url: HEALTH_CENTER_ROOT_URL,
      cached: true,
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? HEALTH_CENTER_STATUS_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await Promise.race([
      fetchImpl(HEALTH_CENTER_STATUS_URL, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      new Promise<Response>((_, reject) => {
        const fail = () => reject(new Error("HEALTH_CENTER_STATUS_TIMEOUT"));
        if (controller.signal.aborted) fail();
        else controller.signal.addEventListener("abort", fail, { once: true });
      }),
    ]);
    if (!response.ok) {
      cache = { at: now, indicator: "SERVICE_UNAVAILABLE" };
      return {
        indicator: "SERVICE_UNAVAILABLE",
        notice: HEALTH_CENTER_UNAVAILABLE_NOTICE,
        url: HEALTH_CENTER_ROOT_URL,
        cached: false,
      };
    }
    cache = { at: now, indicator: "ONLINE" };
    return {
      indicator: "ONLINE",
      notice: null,
      url: HEALTH_CENTER_ROOT_URL,
      cached: false,
    };
  } catch {
    cache = { at: now, indicator: "SERVICE_UNAVAILABLE" };
    return {
      indicator: "SERVICE_UNAVAILABLE",
      notice: HEALTH_CENTER_UNAVAILABLE_NOTICE,
      url: HEALTH_CENTER_ROOT_URL,
      cached: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function openHealthCenterDoor(state: HealthCenterDoorState): { url: string; notice: string | null } {
  if (state.url.includes("/more/emergency")) {
    throw new Error("HEALTH_CENTER_DOOR_MUST_NOT_USE_EMERGENCY");
  }
  return {
    url: HEALTH_CENTER_ROOT_URL,
    notice: state.indicator === "CHECKING" ? null : state.notice,
  };
}