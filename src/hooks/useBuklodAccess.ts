import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodFoundation } from '@/hooks/useBuklodFoundation';

import type { BuklodEntitlement } from '@/lib/buklodAccess';
import {
  isExactScopeAdmin,
  isScopeAdmin,
  normalizedScopeRoles,
  scopeHasEntitlement,
  scopeHasRole,
  verifyScopeEntitlement,
} from '@/lib/buklodAccess';
import type { BuklodFocusApp } from '@/lib/buklodFoundation';
import { evaluateFocusAppAccess } from '@/lib/buklodFoundation';
import {
  fetchScopeCommercialEntitlements,
  type ScopeCommercialEntitlements,
} from '@/lib/buklodScopeEntitlements';

export function useBuklodAccess() {
  const { hasRole: hasAppRole } = useAuth();

  const {
    activeScope,
    scopes,
    loading,
  } = useBuklodScope();

  const {
    isReady: foundationReady,
    getFocusApp,
    authorities,
    memberships,
  } = useBuklodFoundation();

  const [commercialEntitlements, setCommercialEntitlements] =
    useState<ScopeCommercialEntitlements | null>(null);

  const [commercialLoading, setCommercialLoading] = useState(false);

  useEffect(() => {
    const scopeId = activeScope?.scope_id;

    if (!scopeId) {
      setCommercialEntitlements(null);
      return;
    }

    let active = true;
    setCommercialLoading(true);

    void fetchScopeCommercialEntitlements(scopeId)
      .then((result) => {
        if (active) {
          setCommercialEntitlements(result);
        }
      })
      .catch(() => {
        if (active) {
          setCommercialEntitlements(null);
        }
      })
      .finally(() => {
        if (active) {
          setCommercialLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeScope?.scope_id]);

  const systemAdmin =
    hasAppRole('system_admin');

  const roleKeys =
    useMemo(
      () =>
        foundationReady && authorities.mergedRoleKeys.length
          ? authorities.mergedRoleKeys
          : normalizedScopeRoles(activeScope),
      [foundationReady, authorities.mergedRoleKeys, activeScope]
    );

  const exactScopeAdmin =
    isExactScopeAdmin(activeScope);

  const isMzbExempt =
    commercialEntitlements?.paid_features_exempt === true;

  const paidFeaturesExempt = isMzbExempt;

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
          entitlement,
          commercialEntitlements
        ),
      [activeScope, commercialEntitlements, systemAdmin]
    );

  const verifyEntitlement =
    useCallback(
      async (
        entitlement: BuklodEntitlement
      ) => {
        if (systemAdmin) return true;

        return verifyScopeEntitlement(
          activeScope,
          entitlement,
          commercialEntitlements
        );
      },
      [activeScope, commercialEntitlements, systemAdmin]
    );

  const verifyFocusApp =
    useCallback(
      async (app: BuklodFocusApp) => {
        if (foundationReady) {
          const cached = getFocusApp(app);

          if (cached) {
            return cached;
          }

          return {
            app,
            canSee: false,
            isSystemAdmin: systemAdmin,
            isAppAdmin: systemAdmin,
            workspace: null,
            scopeType: activeScope?.scope_type ?? null,
            scopeId: activeScope?.scope_id ?? null,
            roleKeys: authorities.mergedRoleKeys,
          };
        }

        return evaluateFocusAppAccess(app, {
          isSystemAdmin: systemAdmin,
          scopes: memberships.length
            ? memberships
            : activeScope
              ? [activeScope]
              : [],
          activeScope,
        });
      },
      [
        foundationReady,
        getFocusApp,
        systemAdmin,
        memberships,
        activeScope,
        authorities.mergedRoleKeys,
      ]
    );

  return {
    loading: loading || !foundationReady || commercialLoading,
    activeScope,
    scopeType:
      activeScope?.scope_type ?? null,
    roleKeys,
    isSystemAdmin:
      systemAdmin,
    isMzbExempt,
    paidFeaturesExempt,
    commercialEntitlements,
    isExactScopeAdmin:
      exactScopeAdmin,
    isScopedAdmin:
      exactScopeAdmin && !systemAdmin,
    isAdmin:
      systemAdmin ||
      isScopeAdmin(activeScope),
    hasRole,
    hasEntitlement,
    verifyEntitlement,
    verifyFocusApp,
  };
}
