import {
  useCallback,
  useMemo,
} from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

import type { BuklodEntitlement } from '@/lib/buklodAccess';
import {
  isScopeAdmin,
  normalizedScopeRoles,
  scopeHasEntitlement,
  scopeHasRole,
  verifyScopeEntitlement,
} from '@/lib/buklodAccess';

export function useBuklodAccess() {
  const { hasRole: hasAppRole } = useAuth();

  const {
    activeScope,
    loading,
  } = useBuklodScope();

  const systemAdmin =
    hasAppRole('system_admin');

  const roleKeys =
    useMemo(
      () => normalizedScopeRoles(activeScope),
      [activeScope]
    );

  const hasRole =
    useCallback(
      (role: string) =>
        systemAdmin ||
        scopeHasRole(activeScope, role),
      [activeScope, systemAdmin]
    );

  const hasEntitlement =
    useCallback(
      (entitlement: BuklodEntitlement) =>
        systemAdmin ||
        scopeHasEntitlement(
          activeScope,
          entitlement
        ),
      [activeScope, systemAdmin]
    );

  const verifyEntitlement =
    useCallback(
      async (
        entitlement: BuklodEntitlement
      ) => {
        if (systemAdmin) return true;

        return verifyScopeEntitlement(
          activeScope,
          entitlement
        );
      },
      [activeScope, systemAdmin]
    );

  return {
    loading,
    activeScope,
    scopeType:
      activeScope?.scope_type ?? null,
    roleKeys,
    isSystemAdmin:
      systemAdmin,
    isAdmin:
      systemAdmin ||
      isScopeAdmin(activeScope),
    hasRole,
    hasEntitlement,
    verifyEntitlement,
  };
}
