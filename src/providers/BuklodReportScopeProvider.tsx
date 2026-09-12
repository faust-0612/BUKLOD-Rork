import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type BuklodReportScope = {
  scope_id: string;
  scope_type: 'ORGANIZATION' | 'CLUSTER';
  name: string;
  parent_scope_id: string | null;
  scope_status: string | null;
};

type BuklodReportScopeContextValue = {
  scopes: BuklodReportScope[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const Context = createContext<BuklodReportScopeContextValue | null>(null);

/**
 * Read-only reporting scope provider.
 *
 * It reads canonical ACTIVE Organization/Cluster memberships but never calls
 * setBuklodActiveScope and never persists a shared Main active scope. This is
 * required so opening the standalone Report app cannot change BUKLOD Main.
 */
export function BuklodReportScopeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [scopes, setScopes] = useState<BuklodReportScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setScopes([]);
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

      const ids = Array.from(new Set((memberships ?? []).map((row: any) => String(row.scope_id ?? '').trim()).filter(Boolean)));
      if (ids.length === 0) {
        setScopes([]);
        return;
      }

      const { data: rows, error: scopeError } = await (supabase as any)
        .from('buklod_scopes')
        .select('id,name,scope_type,status,parent_scope_id')
        .in('id', ids)
        .in('scope_type', ['ORGANIZATION', 'CLUSTER'])
        .in('status', ['ACTIVE', 'RESTRICTED']);
      if (scopeError) throw scopeError;

      const next = (rows ?? []).flatMap((row: any) => {
        const type = String(row.scope_type ?? '').toUpperCase();
        if (type !== 'ORGANIZATION' && type !== 'CLUSTER') return [];
        return [{
          scope_id: String(row.id),
          scope_type: type as 'ORGANIZATION' | 'CLUSTER',
          name: String(row.name ?? 'BUKLOD'),
          parent_scope_id: row.parent_scope_id ? String(row.parent_scope_id) : null,
          scope_status: row.status ? String(row.status) : null,
        }];
      }).sort((a: BuklodReportScope, b: BuklodReportScope) => {
        if (a.scope_type !== b.scope_type) return a.scope_type === 'ORGANIZATION' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setScopes(next);
    } catch (nextError: any) {
      setScopes([]);
      setError(String(nextError?.message ?? nextError ?? 'Could not load reporting scopes.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ scopes, loading, error, refresh }), [scopes, loading, error, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useBuklodReportScope() {
  const value = useContext(Context);
  if (!value) throw new Error('useBuklodReportScope must be used inside BuklodReportScopeProvider');
  return value;
}
