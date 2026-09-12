import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { BuklodScope } from '@/lib/buklodScope';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type BuklodReportScopeContextValue = {
  scopes: BuklodScope[];
  activeScope: BuklodScope | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectScope: (scopeId: string) => Promise<void>;
  featureEnabled: (featureKey: string) => boolean;
};

const Context = createContext<BuklodReportScopeContextValue | null>(null);

/**
 * Read-only reporting scope provider.
 *
 * This standalone app reads canonical ACTIVE Organization/Cluster memberships
 * but NEVER calls setBuklodActiveScope and NEVER persists the selected Report
 * workspace to BUKLOD Main. `selectScope` is deliberately local React state.
 */
export function BuklodReportScopeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [scopes, setScopes] = useState<BuklodScope[]>([]);
  const [activeScope, setActiveScope] = useState<BuklodScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setScopes([]);
      setActiveScope(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: memberships, error: membershipError } = await (supabase as any)
        .from('buklod_scope_memberships')
        .select('scope_id')
        .eq('user_id', user.id)
        .eq('membership_status', 'ACTIVE')
        .is('left_at', null);
      if (membershipError) throw membershipError;

      const ids = Array.from(
        new Set(
          (memberships ?? [])
            .map((row: any) => String(row.scope_id ?? '').trim())
            .filter(Boolean)
        )
      );

      if (ids.length === 0) {
        setScopes([]);
        setActiveScope(null);
        return;
      }

      const { data: rows, error: scopeError } = await (supabase as any)
        .from('buklod_scopes')
        .select('id,name,scope_type,status,visibility,geo_level,parent_scope_id')
        .in('id', ids)
        .in('scope_type', ['ORGANIZATION', 'CLUSTER'])
        .in('status', ['ACTIVE', 'RESTRICTED']);
      if (scopeError) throw scopeError;

      const next: BuklodScope[] = (rows ?? [])
        .flatMap((row: any) => {
          const type = String(row.scope_type ?? '').trim().toUpperCase();
          if (type !== 'ORGANIZATION' && type !== 'CLUSTER') return [];

          return [{
            scope_id: String(row.id),
            scope_type: type as BuklodScope['scope_type'],
            name: String(row.name ?? 'BUKLOD'),
            parent_scope_id: row.parent_scope_id ? String(row.parent_scope_id) : null,
            scope_status: row.status ? String(row.status) : null,
            visibility: row.visibility ? String(row.visibility) : null,
            geo_level: row.geo_level ? String(row.geo_level) : null,
            membership_status: 'ACTIVE',
            role_keys: [],
            is_admin: false,
            member_count: null,
            show_faith_content: null,
            feature_keys: [],
            is_active_scope: false,
          } as BuklodScope];
        })
        .sort((a: BuklodScope, b: BuklodScope) => {
          if (a.scope_type !== b.scope_type) return a.scope_type === 'ORGANIZATION' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      setScopes(next);
      setActiveScope((current) => {
        const kept = current
          ? next.find((scope) => scope.scope_id === current.scope_id) ?? null
          : null;
        const selected = kept ?? next[0] ?? null;
        return selected ? { ...selected, is_active_scope: true } : null;
      });
    } catch (nextError: any) {
      setScopes([]);
      setActiveScope(null);
      setError(String(nextError?.message ?? nextError ?? 'Could not load reporting scopes.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectScope = useCallback(async (scopeId: string) => {
    const id = String(scopeId ?? '').trim();
    const target = scopes.find((scope) => scope.scope_id === id);
    if (!target) throw new Error('Reporting scope is not available to this account.');

    // Deliberately local only. Do not persist to BUKLOD Main or shared backend.
    setActiveScope({ ...target, is_active_scope: true });
    setScopes((current) => current.map((scope) => ({
      ...scope,
      is_active_scope: scope.scope_id === id,
    })));
  }, [scopes]);

  const featureEnabled = useCallback((featureKey: string) => {
    return Boolean(activeScope?.feature_keys?.includes(featureKey));
  }, [activeScope]);

  const value = useMemo<BuklodReportScopeContextValue>(() => ({
    scopes,
    activeScope,
    loading,
    error,
    refresh,
    selectScope,
    featureEnabled,
  }), [scopes, activeScope, loading, error, refresh, selectScope, featureEnabled]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useBuklodReportScope() {
  const value = useContext(Context);
  if (!value) {
    throw new Error('useBuklodReportScope must be used inside BuklodReportScopeProvider');
  }
  return value;
}
