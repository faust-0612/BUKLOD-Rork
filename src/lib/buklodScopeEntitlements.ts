import { supabase } from '@/lib/supabase';
import {
  readScopeEntitlementsSnapshot,
  type ScopeEntitlementsSnapshot,
} from '@/lib/buklodCommercialBilling';

export type ScopeCommercialEntitlements = ScopeEntitlementsSnapshot;

let cachedByScopeId = new Map<string, ScopeCommercialEntitlements>();

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

  if (!forceRefresh && cachedByScopeId.has(id)) {
    return cachedByScopeId.get(id)!;
  }

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
  cachedByScopeId.set(id, entitlements);
  return entitlements;
}

export function clearScopeCommercialEntitlementsCache(scopeId?: string) {
  if (!scopeId) {
    cachedByScopeId.clear();
    return;
  }

  cachedByScopeId.delete(String(scopeId).trim());
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
