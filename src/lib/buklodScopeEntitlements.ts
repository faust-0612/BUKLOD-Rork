import { supabase } from '@/lib/supabase';
import {
  readScopeEntitlementsSnapshot,
  type ScopeEntitlementsSnapshot,
} from '@/lib/buklodCommercialBilling';

export type ScopeCommercialEntitlements = ScopeEntitlementsSnapshot;

type ScopeEntitlementCacheEntry = {
  value: ScopeCommercialEntitlements;
  cachedAt: number;
};

const SCOPE_ENTITLEMENT_FRESH_MS = 30_000;

const cachedByScopeId =
  new Map<string, ScopeEntitlementCacheEntry>();

const inFlightByScopeId =
  new Map<string, Promise<ScopeCommercialEntitlements>>();

export function readScopeCommercialEntitlements(
  data: unknown
): ScopeCommercialEntitlements {
  return readScopeEntitlementsSnapshot(data);
}

export async function fetchScopeCommercialEntitlements(
  scopeId: string,
  forceRefresh = false
): Promise<ScopeCommercialEntitlements> {
  const id = String(scopeId ?? '').trim();

  if (!id) {
    return readScopeCommercialEntitlements(null);
  }

  if (!forceRefresh) {
    const cached = cachedByScopeId.get(id);

    if (
      cached &&
      Date.now() - cached.cachedAt <= SCOPE_ENTITLEMENT_FRESH_MS
    ) {
      return cached.value;
    }

    const inFlight = inFlightByScopeId.get(id);
    if (inFlight) {
      return inFlight;
    }
  }

  const request = (async () => {
    const { data, error } = await (supabase as any).rpc(
      'buklod_scope_entitlements_v1',
      {
        p_scope_id: id,
      }
    );

    if (error) {
      throw error;
    }

    const entitlements = readScopeCommercialEntitlements(data);

    cachedByScopeId.set(id, {
      value: entitlements,
      cachedAt: Date.now(),
    });

    return entitlements;
  })();

  if (!forceRefresh) {
    inFlightByScopeId.set(id, request);
  }

  try {
    return await request;
  } finally {
    if (
      !forceRefresh &&
      inFlightByScopeId.get(id) === request
    ) {
      inFlightByScopeId.delete(id);
    }
  }
}

export function clearScopeCommercialEntitlementsCache(scopeId?: string) {
  if (!scopeId) {
    cachedByScopeId.clear();
    inFlightByScopeId.clear();
    return;
  }

  const id = String(scopeId).trim();
  cachedByScopeId.delete(id);
  inFlightByScopeId.delete(id);
}

export async function verifyScopeCommercialFeature(
  scopeId: string,
  featureCode: string
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_scope_has_commercial_feature_v1',
    {
      p_scope_id: scopeId,
      p_feature_code: featureCode,
    }
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}
