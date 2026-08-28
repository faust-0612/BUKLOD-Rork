import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/providers/AuthProvider';

import {
  BuklodScope,
  getMyBuklodScopes,
  setBuklodActiveScope,
} from '@/lib/buklodScope';
import {
  isMzbOrganizationScope,
  resolveMzbOrganizationScopeId,
} from '@/lib/buklodMzbOrganization';
import {
  supabase,
} from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import AsyncStorage
  from '@react-native-async-storage/async-storage';

const BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY =
  'buklod.auth.fresh_login_public.v1';

function scopeCacheKey(userId: string) {
  return `buklod:scopes:v1:${userId}`;
}

/* BUKLOD_GLOBAL_BOOT_R20 */
const SCOPE_PRIMARY_TIMEOUT_MS = 6000;
const SCOPE_LOADING_WATCHDOG_MS = 7000;



type BuklodScopeContextValue = {
  scopes: BuklodScope[];
  activeScope: BuklodScope | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectScope: (scopeId: string) => Promise<void>;
  featureEnabled: (featureKey: string) => boolean;
};

const BuklodScopeContext =
  createContext<BuklodScopeContextValue | null>(
    null
  );

function pickActiveScope(
  rows: BuklodScope[]
): BuklodScope | null {
  return (
    rows.find(
      (scope) =>
        scope.is_active_scope &&
        scope.scope_type !== 'LOCAL'
      /* PATCH_169G_IGNORE_LOCAL_ACTIVE_SCOPE */
    ) ??
    rows.find(
      (scope) =>
        scope.scope_type === 'PUBLIC'
    ) ??
    rows[0] ??
    null
  );
}

export function BuklodScopeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } =
    useAuth();

  const [scopes, setScopes] =
    useState<BuklodScope[]>([]);

  const [
    activeScope,
    setActiveScope,
  ] =
    useState<BuklodScope | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const scopesRef = useRef(scopes);
  scopesRef.current = scopes;
  const activeScopeRef = useRef(activeScope);
  activeScopeRef.current = activeScope;

  const refresh =
    useCallback(async () => {
      if (!user?.id) {
        setScopes([]);
        setActiveScope(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (scopesRef.current.length === 0) {
        setLoading(true);
      }

      let loadedFromCache = false;

      try {
        const cachedRaw =
          await AsyncStorage.getItem(
            scopeCacheKey(user.id)
          );

        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as {
            scopes?: BuklodScope[];
            activeScopeId?: string | null;
          };

          if (Array.isArray(cached?.scopes) && cached.scopes.length) {
            loadedFromCache = true;

            if (scopesRef.current.length === 0) {
              setScopes(cached.scopes);
              setActiveScope(
                cached.scopes.find(
                  scope =>
                    scope.scope_id ===
                    cached.activeScopeId
                ) ??
                pickActiveScope(cached.scopes)
              );
              setLoading(false);
            }
          }
        }
      } catch {
        // Cached scopes are optional.
      }

      /*
       * R20: secondary scope enrichment must never hold a loading
       * indicator forever if a browser/network request never settles.
       */
      const loadingWatchdog = setTimeout(() => {
        setLoading(false);
      }, SCOPE_LOADING_WATCHDOG_MS);

      try {
        /* PATCH_172A_SCOPE_HIERARCHY_ENRICHMENT */
        const baseRows =
          await withBuklodTimeout(
            getMyBuklodScopes(),
            SCOPE_PRIMARY_TIMEOUT_MS,
            'BUKLOD scopes'
          );

        let rows = baseRows;

        const scopeIds =
          baseRows
            .map(scope => scope.scope_id)
            .filter(Boolean);

        if (scopeIds.length > 0) {
          const {
            data: hierarchyRows,
            error: hierarchyError,
          } =
            await supabase
              .from('buklod_scopes')
              .select('id,parent_scope_id')
              .in('id', scopeIds);

          if (!hierarchyError) {
            const parentById =
              new Map(
                (hierarchyRows ?? [])
                  .map(row => [
                    String(row.id),
                    row.parent_scope_id
                      ? String(row.parent_scope_id)
                      : null,
                  ] as const)
              );

            rows =
              baseRows.map(scope => ({
                ...scope,
                parent_scope_id:
                  parentById.get(scope.scope_id) ??
                  scope.parent_scope_id ??
                  null,
              }));
          }
          else {
            console.warn(
              'BUKLOD scope hierarchy enrichment:',
              hierarchyError
            );
          }
        }

        /*
         * PATCH_172C_R3_ACTIVE_MEMBER_SCOPE_MERGE
         *
         * Every ACTIVE member of an Organization, child Organization
         * (Sub-organization), or Cluster must receive the actual shared
         * scope selector button. Admin role is NOT required.
         *
         * The canonical RPC remains the primary source. This supplements
         * any ACTIVE managed membership omitted by older RPC logic.
         */
        const membershipResult =
          await withBuklodTimeout<{
            data: any;
            error: any;
          }>(
            supabase
              .from('buklod_scope_memberships')
              .select('scope_id')
              .eq('user_id', user.id)
              .eq(
                'membership_status',
                'ACTIVE'
              ),
            4000,
            'Scope memberships'
          ).catch((error: any) => ({
            data: null,
            error: {
              message:
                String(
                  error?.message ??
                    error ??
                    'membership timeout'
                ),
            },
          }));

        const activeManagedMembershipRows =
          membershipResult?.data;
        const activeManagedMembershipError =
          membershipResult?.error;

        if (
          activeManagedMembershipError
        ) {
          console.warn(
            'BUKLOD active memberships:',
            activeManagedMembershipError
          );
        } else {

        const activeManagedScopeIds =
          Array.from(
            new Set(
              (
                activeManagedMembershipRows ??
                []
              )
                .map((row: { scope_id?: string | null }) =>
                  row.scope_id
                    ? String(
                        row.scope_id
                      )
                    : ''
                )
                .filter(Boolean)
            )
          );

        if (
          activeManagedScopeIds.length >
          0
        ) {
          const {
            data: activeManagedScopeRows,
            error: activeManagedScopeError,
          } =
            await supabase
              .from('buklod_scopes')
              .select(
                'id,name,scope_type,status,visibility,geo_level,parent_scope_id'
              )
              .in(
                'id',
                activeManagedScopeIds
              )
              .in(
                'scope_type',
                [
                  'ORGANIZATION',
                  'CLUSTER',
                ]
              )
              .in(
                'status',
                [
                  'ACTIVE',
                  'RESTRICTED',
                ]
              );

          if (
            activeManagedScopeError
          ) {
            throw activeManagedScopeError;
          }

          const managedById =
            new Map(
              (
                activeManagedScopeRows ??
                []
              ).map(row => [
                String(row.id),
                row,
              ] as const)
            );

          /*
           * Keep richer RPC data for scopes already returned, but make
           * ACTIVE membership and hierarchy authoritative.
           */
          rows =
            rows.map(scope => {
              const managed =
                managedById.get(
                  scope.scope_id
                );

              if (!managed) {
                return scope;
              }

              return {
                ...scope,
                membership_status:
                  'ACTIVE',
                parent_scope_id:
                  managed
                    .parent_scope_id
                    ? String(
                        managed
                          .parent_scope_id
                      )
                    : null,
              };
            });

          const existingScopeIds =
            new Set(
              rows.map(
                scope =>
                  scope.scope_id
              )
            );

          for (
            const managed of
            managedById.values()
          ) {
            const scopeId =
              String(managed.id);

            if (
              existingScopeIds.has(
                scopeId
              )
            ) {
              continue;
            }

            rows.push({
              scope_id:
                scopeId,
              scope_type:
                managed
                  .scope_type as
                  BuklodScope[
                    'scope_type'
                  ],
              name:
                String(
                  managed.name ??
                    'BUKLOD'
                ),
              scope_status:
                managed.status ??
                null,
              visibility:
                managed.visibility ??
                null,
              geo_level:
                managed.geo_level ??
                null,
              parent_scope_id:
                managed
                  .parent_scope_id
                  ? String(
                      managed
                        .parent_scope_id
                    )
                  : null,
              membership_status:
                'ACTIVE',
              role_keys: [],
              is_admin: false,
              is_active_scope:
                false,
              feature_keys: [],
            } as BuklodScope);

            existingScopeIds.add(
              scopeId
            );
          }
        }
        }
        /*
         * PATCH_171K_R3_FRESH_AUTH_PUBLIC_SCOPE
         *
         * A real login action sets this intent BEFORE Supabase emits
         * SIGNED_IN. Therefore the first scope refresh after login
         * ignores any stale persisted Cluster/Organization active scope
         * and immediately presents PUBLIC locally.
         *
         * App reopen has no fresh-login intent, so its existing root
         * route remains global/personal Connect.
         */
        const freshLoginPublicIntent =
          await AsyncStorage.getItem(
            BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY
          );

        const freshPublicScope =
          freshLoginPublicIntent ===
            '1'
            ? (
                rows.find(
                  scope =>
                    scope.scope_type ===
                    'PUBLIC'
                ) ??
                null
              )
            : null;

        const mzbOrganizationScopeId =
          await resolveMzbOrganizationScopeId();

        rows = rows.map(scope => ({
          ...scope,
          is_mzb_organization: isMzbOrganizationScope(
            {
              scope_id: scope.scope_id,
              scope_type: scope.scope_type,
            },
            mzbOrganizationScopeId
          ),
        }));

        setScopes(rows);

        const currentId =
          activeScopeRef.current?.scope_id ??
          null;
        const keptScope =
          currentId
            ? rows.find(
                scope =>
                  scope.scope_id ===
                  currentId
              ) ??
              null
            : null;

        const nextActive =
          freshPublicScope ??
          keptScope ??
          pickActiveScope(rows);

        setActiveScope(
          nextActive
        );

        if (freshPublicScope) {
          await AsyncStorage.removeItem(
            BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY
          );

          /*
           * Persist Public without blocking Home navigation.
           */
          void setBuklodActiveScope(
            freshPublicScope.scope_id
          ).catch(error => {
            console.warn(
              'BUKLOD fresh-login Public scope persistence:',
              error
            );
          });
        }
        else {
          if (
            freshLoginPublicIntent ===
            '1'
          ) {
            await AsyncStorage.removeItem(
              BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY
            );
          }
        }
        setError(null);

        void AsyncStorage.setItem(
          scopeCacheKey(user.id),
          JSON.stringify({
            scopes: rows,
            activeScopeId:
              nextActive?.scope_id ??
              null,
          }),
        ).catch(() => undefined);
      } catch (nextError: any) {
        console.warn(
          'BUKLOD scope load:',
          nextError
        );

        if (
          scopesRef.current.length === 0 &&
          !activeScopeRef.current &&
          !loadedFromCache
        ) {
          setScopes([]);
          setActiveScope(null);
          setError(
            String(
              nextError?.message ??
              nextError
            )
          );
        } else {
          setError(null);
        }
      } finally {
        clearTimeout(loadingWatchdog);
        setLoading(false);
      }
    }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectScope =
    useCallback(
      async (scopeId: string) => {
        const target =
          scopes.find(
            (scope) =>
              scope.scope_id ===
              scopeId
          );

        if (!target) {
          throw new Error(
            'Scope is not available to this account.'
          );
        }

        if (
          target.scope_type ===
            'SYSTEM'
        ) {
          throw new Error(
            'SYSTEM is not a community scope.'
          );
        }

        /* PATCH_169G_BLOCK_LOCAL_SELECT
         * LOCAL is geography metadata/filtering only.
         * It must never become a separate app dashboard.
         */
        if (
          target.scope_type ===
            'LOCAL'
        ) {
          throw new Error(
            'Location is a Public Community feed filter, not a dashboard.'
          );
        }

        setActiveScope(target);

        setScopes(
          (current) =>
            current.map(
              (scope) => ({
                ...scope,
                is_active_scope:
                  scope.scope_id ===
                  scopeId,
              })
            )
        );

        if (user?.id) {
          void AsyncStorage.setItem(
            scopeCacheKey(user.id),
            JSON.stringify({
              scopes: scopes.map(scope => ({
                ...scope,
                is_active_scope:
                  scope.scope_id ===
                  scopeId,
              })),
              activeScopeId: scopeId,
            }),
          ).catch(() => undefined);
        }

        /*
         * PERF: update local scope immediately for navigation;
         * persist active scope without blocking UI transitions.
         */
        void setBuklodActiveScope(
          scopeId
        ).catch((error) => {
          console.warn(
            'BUKLOD scope persistence:',
            error
          );
        });
      },
      [scopes, user?.id]
    );

  const featureEnabled =
    useCallback(
      (featureKey: string) =>
        Boolean(
          activeScope
            ?.feature_keys
            ?.includes(
              featureKey
            )
        ),
      [activeScope]
    );

  const value =
    useMemo<BuklodScopeContextValue>(
      () => ({
        scopes,
        activeScope,
        loading,
        error,
        refresh,
        selectScope,
        featureEnabled,
      }),
      [
        scopes,
        activeScope,
        loading,
        error,
        refresh,
        selectScope,
        featureEnabled,
      ]
    );

  return (
    <BuklodScopeContext.Provider
      value={value}
    >
      {children}
    </BuklodScopeContext.Provider>
  );
}

export function useBuklodScope() {
  const value =
    useContext(
      BuklodScopeContext
    );

  if (!value) {
    throw new Error(
      'useBuklodScope must be used inside BuklodScopeProvider'
    );
  }

  return value;
}
