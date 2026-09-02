import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  BuklodFocusAppAccess,
  BuklodFoundationAuthorities,
  BuklodFoundationSnapshot,
  BuklodFoundationWorkspace,
} from '@/lib/buklodFoundation';
import { resolveFoundationFocusApps } from '@/lib/buklodFoundation';
import type { BuklodScope } from '@/lib/buklodScope';
import {
  AppRole,
  Profile,
  useAuth,
} from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

const BUKLOD_FOUNDATION_SNAPSHOT_CACHE_KEY =
  'buklod.foundation.snapshot.v1';

type CachedFoundationSnapshot = {
  userId: string;
  focusApps: BuklodFocusAppAccess[];
  cachedAt: number;
};

export type BuklodFoundationState = {
  user: ReturnType<typeof useAuth>['user'];
  profile: Profile | null;
  roles: AppRole[];
  memberships: BuklodScope[];
  activeScope: BuklodScope | null;
  authorities: BuklodFoundationAuthorities;
  focusApps: BuklodFocusAppAccess[];
  workspaces: BuklodFoundationWorkspace[];
  isReady: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  getFocusApp: (app: BuklodFocusAppAccess['app']) => BuklodFocusAppAccess | null;
};

const EMPTY_AUTHORITIES: BuklodFoundationAuthorities = {
  isSystemAdmin: false,
  isScopedAdmin: false,
  mergedRoleKeys: [],
};

const BuklodFoundationContext =
  createContext<BuklodFoundationState | null>(null);

async function loadCachedSnapshot(
  userId: string
): Promise<CachedFoundationSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(
      BUKLOD_FOUNDATION_SNAPSHOT_CACHE_KEY
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedFoundationSnapshot;

    if (
      parsed?.userId !== userId ||
      !Array.isArray(parsed.focusApps)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function saveCachedSnapshot(
  userId: string,
  focusApps: BuklodFocusAppAccess[]
) {
  try {
    const payload: CachedFoundationSnapshot = {
      userId,
      focusApps,
      cachedAt: Date.now(),
    };

    await AsyncStorage.setItem(
      BUKLOD_FOUNDATION_SNAPSHOT_CACHE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    /* presentation cache only */
  }
}

async function clearCachedSnapshot() {
  try {
    await AsyncStorage.removeItem(
      BUKLOD_FOUNDATION_SNAPSHOT_CACHE_KEY
    );
  } catch {
    /* ignore */
  }
}

export function BuklodFoundationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    profile,
    roles,
    loading: authLoading,
    hasRole,
  } = useAuth();

  const {
    scopes,
    activeScope,
    loading: scopeLoading,
    refresh: refreshScopes,
  } = useBuklodScope();

  const [focusApps, setFocusApps] = useState<
    BuklodFocusAppAccess[]
  >([]);
  const [workspaces, setWorkspaces] = useState<
    BuklodFoundationWorkspace[]
  >([]);
  const [authorities, setAuthorities] =
    useState<BuklodFoundationAuthorities>(EMPTY_AUTHORITIES);
  const [isReady, setIsReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const resolveGenerationRef = useRef(0);
  const cacheHydratedRef = useRef(false);
  const lastValidSnapshotRef =
    useRef<BuklodFoundationSnapshot | null>(null);

  const isSystemAdmin = hasRole('system_admin');

  const applySnapshot = useCallback(
    (snapshot: BuklodFoundationSnapshot) => {
      lastValidSnapshotRef.current = snapshot;
      setFocusApps(snapshot.focusApps);
      setWorkspaces(snapshot.workspaces);
      setAuthorities(snapshot.authorities);
    },
    []
  );

  const resolveFoundation = useCallback(
    async (options?: { background?: boolean }) => {
      const background = Boolean(options?.background);

      if (!user?.id) {
        setFocusApps([]);
        setWorkspaces([]);
        setAuthorities(EMPTY_AUTHORITIES);
        setIsReady(true);
        setRefreshing(false);
        lastValidSnapshotRef.current = null;
        void clearCachedSnapshot();
        return;
      }

      if (authLoading || scopeLoading) {
        return;
      }

      const generation = ++resolveGenerationRef.current;

      if (background) {
        setRefreshing(true);
      }

      try {
        const snapshot = await resolveFoundationFocusApps({
          isSystemAdmin,
          scopes,
          activeScope,
        });

        if (generation !== resolveGenerationRef.current) {
          return;
        }

        applySnapshot(snapshot);
        void saveCachedSnapshot(user.id, snapshot.focusApps);
        setIsReady(true);
      } catch (error: any) {
        console.warn(
          'BUKLOD foundation resolve failed:',
          String(error?.message ?? error)
        );

        if (generation !== resolveGenerationRef.current) {
          return;
        }

        if (lastValidSnapshotRef.current) {
          applySnapshot(lastValidSnapshotRef.current);
        }

        setIsReady(true);
      } finally {
        if (generation === resolveGenerationRef.current) {
          setRefreshing(false);
        }
      }
    },
    [
      user?.id,
      authLoading,
      scopeLoading,
      isSystemAdmin,
      scopes,
      activeScope,
      applySnapshot,
    ]
  );

  useEffect(() => {
    let active = true;

    cacheHydratedRef.current = false;

    if (!user?.id) {
      setFocusApps([]);
      setWorkspaces([]);
      setAuthorities(EMPTY_AUTHORITIES);
      setIsReady(true);
      setRefreshing(false);
      lastValidSnapshotRef.current = null;
      return () => {
        active = false;
      };
    }

    void loadCachedSnapshot(user.id).then((cached) => {
      if (!active || !cached) {
        return;
      }

      cacheHydratedRef.current = true;

      const hydrated: BuklodFoundationSnapshot = {
        focusApps: cached.focusApps,
        workspaces: [],
        authorities: buildAuthoritiesFromCache(
          cached.focusApps,
          isSystemAdmin
        ),
      };

      lastValidSnapshotRef.current = hydrated;
      setFocusApps(cached.focusApps);
      setAuthorities(hydrated.authorities);
    });

    return () => {
      active = false;
    };
  }, [user?.id, isSystemAdmin]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (authLoading || scopeLoading) {
      setIsReady(false);
      return;
    }

    void resolveFoundation({
      background:
        cacheHydratedRef.current ||
        lastValidSnapshotRef.current !== null,
    });
  }, [
    user?.id,
    authLoading,
    scopeLoading,
    isSystemAdmin,
    scopes,
    activeScope?.scope_id,
    resolveFoundation,
  ]);

  const refresh = useCallback(async () => {
    await refreshScopes();
    await resolveFoundation({ background: true });
  }, [refreshScopes, resolveFoundation]);

  const getFocusApp = useCallback(
    (app: BuklodFocusAppAccess['app']) =>
      focusApps.find((row) => row.app === app) ?? null,
    [focusApps]
  );

  const value = useMemo<BuklodFoundationState>(
    () => ({
      user,
      profile,
      roles,
      memberships: scopes,
      activeScope,
      authorities,
      focusApps,
      workspaces,
      isReady,
      refreshing,
      refresh,
      getFocusApp,
    }),
    [
      user,
      profile,
      roles,
      scopes,
      activeScope,
      authorities,
      focusApps,
      workspaces,
      isReady,
      refreshing,
      refresh,
      getFocusApp,
    ]
  );

  return (
    <BuklodFoundationContext.Provider value={value}>
      {children}
    </BuklodFoundationContext.Provider>
  );
}

function buildAuthoritiesFromCache(
  focusApps: BuklodFocusAppAccess[],
  isSystemAdmin: boolean
): BuklodFoundationAuthorities {
  const mergedRoleKeys = Array.from(
    new Set(
      focusApps.flatMap((row) => row.roleKeys ?? []).map(String)
    )
  );

  return {
    isSystemAdmin,
    isScopedAdmin:
      mergedRoleKeys.some((role) =>
        role.toUpperCase().includes('ADMIN')
      ) || focusApps.some((row) => row.isAppAdmin),
    mergedRoleKeys,
  };
}

export function useBuklodFoundation() {
  const value = useContext(BuklodFoundationContext);

  if (!value) {
    throw new Error(
      'useBuklodFoundation must be used inside BuklodFoundationProvider'
    );
  }

  return value;
}
