import { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { signOutBuklodResilient } from '@/lib/buklodAuthResilience';
import {
  clearAuthSnapshot,
  readAuthSnapshot,
  readPersistedSupabaseSession,
  writeAuthSnapshot,
} from '@/lib/buklodAuthSnapshot';
import { cachedQuery } from '@/lib/performance';
import { useNetwork } from '@/providers/NetworkProvider';

export type AppRole =
  | 'member'
  | 'leader'
  | 'mentor'
  | 'pastor'
  | 'local_admin'
  | 'system_admin';

export type MembershipState =
  | 'loading'
  | 'ready'
  | 'pending'
  | 'rejected'
  | 'none';

export type Profile = {
  id: string;
  full_name: string;
  first_name?: string | null;
  middle_name?: string | null;
  surname?: string | null;
  suffix?: string | null;
  mobile: string | null;
  sex?: 'male' | 'female' | null;
  username?: string | null;
  login_method?: string | null;
  login_identifier?: string | null;
  avatar_url: string | null;
  church_id: string | null;
  is_verified?: boolean;
  connection_type?: 'local_member'|'invited'|'seeking_church'|'community'|null;
  trust_level?: number|null;

  // Legacy primary role.
  // Do not use this as the sole authorization source.
  role: AppRole;

  is_active: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;

  // Active simultaneous BUKLOD roles.
  roles: AppRole[];

  loading: boolean;
  membershipState: MembershipState;

  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (rolesToCheck: AppRole[]) => boolean;

  refreshProfile: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshMembership: () => Promise<void>;

  signOut: () => Promise<void>;
};

const VALID_ROLES: AppRole[] = [
  'member',
  'leader',
  'mentor',
  'pastor',
  'local_admin',
  'system_admin',
];

const LEADERSHIP_ROLES: AppRole[] = [
  'leader',
  'mentor',
  'pastor',
  'local_admin',
  'system_admin',
];

const AuthContext = createContext<AuthContextValue | null>(null);

/* BUKLOD_GLOBAL_BOOT_R20 */
const AUTH_SESSION_TIMEOUT_MS = 8000;
const AUTH_QUERY_TIMEOUT_MS = 4500;

/* BUKLOD_PERFORMANCE_AUTH_CACHE_R1 */
const AUTH_PROFILE_TTL_MS = 60_000;
const AUTH_ROLES_TTL_MS = 60_000;
const AUTH_MEMBERSHIP_TTL_MS = 30_000;
const AUTH_STALE_MS = 5 * 60_000;

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { online } = useNetwork();
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [membershipState, setMembershipState] =
    useState<MembershipState>('loading');

  const bootstrappedRef = useRef(false);
  const sessionUserIdRef = useRef<string | null>(null);
  const lastOnlineHydrationUserRef = useRef<string | null>(null);

  const loadRoles = async (
    userId?: string,
    legacyRole?: AppRole | null,
    force = false,
  ): Promise<AppRole[]> => {
    if (!userId) {
      setRoles([]);
      return [];
    }

    let data: any[] | null = null;

    try {
      data = await cachedQuery<any[]>(
        `auth:roles:${userId}`,
        async () => {
          const result = await withBuklodTimeout(
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', userId)
              .eq('is_active', true),
            AUTH_QUERY_TIMEOUT_MS,
            'BUKLOD roles'
          );

          if (result.error) {
            throw new Error(result.error.message);
          }

          return result.data ?? [];
        },
        {
          ttlMs: AUTH_ROLES_TTL_MS,
          staleMs: AUTH_STALE_MS,
          force,
        },
      );
    } catch (error: any) {
      console.warn(
        'Role load failed:',
        String(error?.message ?? error ?? 'Role request failed.')
      );
    }

    if (!data) {
      const fallback: AppRole[] =
        legacyRole === 'system_admin'
          ? ['system_admin']
          : ['member'];

      if (
        legacyRole &&
        VALID_ROLES.includes(legacyRole) &&
        !fallback.includes(legacyRole)
      ) {
        fallback.push(legacyRole);
      }

      setRoles(fallback);
      return fallback;
    }

    const nextRoles = Array.from(
      new Set(
        data
          .map((row: any) => row.role as AppRole)
          .filter((role: AppRole) => VALID_ROLES.includes(role))
      )
    );

    if (
      !nextRoles.includes('system_admin') &&
      !nextRoles.includes('member')
    ) {
      nextRoles.unshift('member');
    }

    setRoles(nextRoles);
    return nextRoles;
  };

  const loadMembership = async (
    userId?: string,
    _activeRoles: AppRole[] = [],
    knownVerified?: boolean | null,
    force = false,
  ) => {
    if (!userId) {
      setMembershipState('none');
      return;
    }

    let isVerified = knownVerified;

    /*
     * R20: loadProfile already selects is_verified.
     * Do not repeat the same profiles query during normal bootstrap.
     */
    if (isVerified == null) {
      try {
        isVerified = await cachedQuery<boolean>(
          `auth:verified:${userId}`,
          async () => {
            const verification = await withBuklodTimeout(
              supabase
                .from('profiles')
                .select('is_verified')
                .eq('id', userId)
                .maybeSingle(),
              AUTH_QUERY_TIMEOUT_MS,
              'BUKLOD verification'
            );

            if (verification.error) {
              throw new Error(verification.error.message);
            }

            return verification.data?.is_verified === true;
          },
          {
            ttlMs: AUTH_PROFILE_TTL_MS,
            staleMs: AUTH_STALE_MS,
            force,
          },
        );
      } catch (error: any) {
        console.warn(
          'Verification load failed:',
          String(error?.message ?? error ?? 'Verification request failed.')
        );
        setMembershipState('pending');
        return;
      }
    }

    if (isVerified === true) {
      setMembershipState('ready');
      return;
    }

    try {
      const status = await cachedQuery<string | null>(
        `auth:membership:${userId}`,
        async () => {
          const request = await withBuklodTimeout(
            supabase
              .from('church_join_requests')
              .select('status')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            AUTH_QUERY_TIMEOUT_MS,
            'BUKLOD membership'
          );

          if (request.error) {
            throw new Error(request.error.message);
          }

          return request.data?.status ?? null;
        },
        {
          ttlMs: AUTH_MEMBERSHIP_TTL_MS,
          staleMs: AUTH_STALE_MS,
          force,
        },
      );

      if (status === 'rejected') {
        setMembershipState('rejected');
        return;
      }

      setMembershipState('pending');
    } catch (error: any) {
      console.warn(
        'Membership load failed:',
        String(error?.message ?? error ?? 'Membership request failed.')
      );
      setMembershipState((current) =>
        current === 'loading' ? 'pending' : current
      );
    }
  };

  const loadProfile = async (
    userId?: string,
    force = false,
    allowRemote = true,
  ) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setMembershipState('none');
      return;
    }

    const cachedSnapshot = await readAuthSnapshot(userId);
    if (cachedSnapshot) {
      setProfile(cachedSnapshot.profile as Profile);
      setRoles(
        (cachedSnapshot.roles as AppRole[]).filter((role) =>
          VALID_ROLES.includes(role)
        )
      );
      setMembershipState(
        cachedSnapshot.membershipState as MembershipState
      );
    }

    /*
     * BUKLOD_OFFLINE_RUNTIME_R1:
     * Local auth/session data owns startup. Unknown, degraded, and offline
     * network states must not start Supabase profile/role/membership reads.
     * A confirmed-online transition refreshes this snapshot in background.
     */
    if (!allowRemote) {
      if (!cachedSnapshot) {
        setMembershipState((current) =>
          current === 'loading' ? 'pending' : current
        );
      }
      return;
    }

    let nextProfile: Profile | null = null;

    try {
      nextProfile = await cachedQuery<Profile>(
        `auth:profile:${userId}`,
        async () => {
          const result = await withBuklodTimeout(
            supabase
              .from('profiles')
              .select(
                'id,full_name,first_name,middle_name,surname,suffix,mobile,sex,username,login_method,login_identifier,avatar_url,church_id,connection_type,trust_level,is_verified,role,is_active'
              )
              .eq('id', userId)
              .single(),
            AUTH_QUERY_TIMEOUT_MS,
            'BUKLOD profile'
          );

          if (result.error || !result.data) {
            throw new Error(
              result.error?.message ?? 'Profile not available.'
            );
          }

          return result.data as Profile;
        },
        {
          ttlMs: AUTH_PROFILE_TTL_MS,
          staleMs: AUTH_STALE_MS,
          force,
        },
      );
    } catch (error: any) {
      console.warn(
        'Profile load failed:',
        String(error?.message ?? error ?? 'Profile request failed.')
      );

      if (cachedSnapshot) {
        return;
      }

      setMembershipState((current) =>
        current === 'loading' ? 'pending' : current
      );
      return;
    }

    setProfile(nextProfile);

    /*
     * Roles and membership are independent after the profile row
     * is known. Run them together instead of serially.
     * cachedQuery collapses concurrent callers for this same user.
     */
    const [nextRoles] = await Promise.all([
      loadRoles(
        userId,
        nextProfile.role,
        force,
      ),
      loadMembership(
        userId,
        [],
        nextProfile.is_verified ?? null,
        force,
      ),
    ]);

    await writeAuthSnapshot(userId, {
      profile: nextProfile,
      roles: nextRoles,
      membershipState:
        nextProfile.is_verified === true
          ? 'ready'
          : 'pending',
    });
  };

  useEffect(() => {
    let disposed = false;

    const finishBootstrap = () => {
      if (disposed) {
        return;
      }

      bootstrappedRef.current = true;
      setLoading(false);
    };

    void withBuklodTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_TIMEOUT_MS,
      'BUKLOD auth session'
    )
      .then(async ({ data }) => {
        if (disposed) {
          return;
        }

        const nextSession =
          data.session ??
          (await readPersistedSupabaseSession());

        setSession(nextSession);
        sessionUserIdRef.current =
          nextSession?.user?.id ?? null;

        const userId = nextSession?.user?.id;

        /*
         * PERF_STARTUP_R1
         *
         * Session alone is enough to release the auth shell and trusted-
         * device gate. Profile/roles still hydrate via loadProfile
         * (snapshot first, then network when online) without holding
         * loading=true — which previously trapped the whole app on
         * "Restoring your BUKLOD session…" when profile fetches were slow.
         */
        if (!userId) {
          setMembershipState('none');
          finishBootstrap();
          return;
        }

        finishBootstrap();
        await loadProfile(
          userId,
          false,
          onlineRef.current,
        );
      })
      .catch(async (error: any) => {
        if (disposed) {
          return;
        }

        console.warn(
          'BUKLOD auth bootstrap:',
          String(
            error?.message ??
              error ??
              'Session bootstrap failed.'
          )
        );

        const persisted =
          await readPersistedSupabaseSession();

        if (persisted?.user?.id) {
          setSession(persisted);
          sessionUserIdRef.current =
            persisted.user.id;
          finishBootstrap();
          await loadProfile(
            persisted.user.id,
            false,
            onlineRef.current,
          );
          return;
        }

        setMembershipState((current) =>
          current === 'loading' ? 'none' : current
        );
      })
      .finally(finishBootstrap);

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (disposed) {
            return;
          }

          const nextUserId =
            nextSession?.user?.id ?? null;

          /*
           * R20: getSession owns initial hydration.
           * Avoid a duplicate profile/role/membership request.
           */
          if (_event === 'INITIAL_SESSION') {
            return;
          }

          const previousUserId =
            sessionUserIdRef.current;

          setSession(nextSession);
          sessionUserIdRef.current =
            nextUserId;

          if (
            _event === 'SIGNED_OUT' ||
            !nextUserId
          ) {
            void clearAuthSnapshot(previousUserId);
            setProfile(null);
            setRoles([]);
            setMembershipState('none');
            finishBootstrap();
            return;
          }

          /*
           * Token refresh only changes auth tokens.
           * Do not reload profile/roles for every refresh event.
           */
          if (_event === 'TOKEN_REFRESHED') {
            return;
          }

          const sameUser =
            nextUserId ===
            previousUserId;

          if (
            _event === 'SIGNED_IN' &&
            !sameUser
          ) {
            setLoading(true);
          }

          // Supabase may emit SIGNED_IN again when an existing session
          // is confirmed or the app regains focus. Keep the current
          // screen and cached identity; do not repeat profile hydration.
          if (_event === 'SIGNED_IN' && sameUser) {
            finishBootstrap();
            return;
          }

          /*
           * Keep the auth callback synchronous. Defer database
           * hydration outside the auth event callback. Repeated
           * same-user events share the same cached/in-flight reads.
           */
          setTimeout(() => {
            if (disposed) {
              return;
            }

            void loadProfile(
              nextSession?.user.id,
              false,
              onlineRef.current,
            )
              .catch((error: any) => {
                console.warn(
                  'BUKLOD auth state hydration:',
                  String(
                    error?.message ??
                      error ??
                      'Profile refresh failed.'
                  )
                );

                setMembershipState(
                  nextUserId
                    ? 'pending'
                    : 'none'
                );
              })
              .finally(() => {
                if (!disposed) {
                  bootstrappedRef.current = true;
                  setLoading(false);
                }
              });
          }, 0);
        }
      );

    return () => {
      disposed = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  /*
   * One background identity refresh when usable internet returns.
   * Cached UI stays mounted; this never re-enters the global boot spinner.
   */
  useEffect(() => {
    if (!online) {
      lastOnlineHydrationUserRef.current = null;
      return;
    }

    const userId = session?.user?.id ?? null;
    if (!userId) {
      lastOnlineHydrationUserRef.current = null;
      return;
    }

    if (lastOnlineHydrationUserRef.current === userId) {
      return;
    }
    lastOnlineHydrationUserRef.current = userId;

    void loadProfile(
      userId,
      false,
      true,
    ).catch((error: any) => {
      console.warn(
        'BUKLOD online auth refresh:',
        String(
          error?.message ??
            error ??
            'Profile refresh failed.'
        )
      );
    });
  }, [online, session?.user?.id]);

  const value = useMemo<AuthContextValue>(() => {
    const hasRole = (role: AppRole) =>
      roles.includes(role);

    const hasAnyRole = (
      rolesToCheck: AppRole[]
    ) =>
      rolesToCheck.some((role) =>
        roles.includes(role)
      );

    return {
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading,
      membershipState,

      hasRole,
      hasAnyRole,

      refreshProfile: async () => {
        await loadProfile(
          session?.user.id,
          true,
          onlineRef.current,
        );
      },

      refreshRoles: async () => {
        if (!onlineRef.current) {
          return;
        }

        const nextRoles = await loadRoles(
          session?.user.id,
          profile?.role,
          true,
        );

        await loadMembership(
          session?.user.id,
          nextRoles,
          profile?.is_verified ?? null,
          true,
        );
      },

      refreshMembership: async () => {
        if (!onlineRef.current) {
          return;
        }

        await loadMembership(
          session?.user.id,
          roles,
          profile?.is_verified ?? null,
          true,
        );
      },

      signOut: async () => {
        const currentUserId =
          session?.user?.id ?? null;

        // Make logout immediate in the UI even when Supabase /logout is slow.
        // The helper also clears the persisted browser/app auth token.
        sessionUserIdRef.current = null;
        setSession(null);
        setProfile(null);
        setRoles([]);
        setMembershipState('none');
        setLoading(false);

        await clearAuthSnapshot(
          currentUserId
        );

        const { error } =
          await signOutBuklodResilient();

        if (error) {
          console.warn(
            'BUKLOD sign out fallback:',
            String(
              error?.message ??
                error ??
                'Local sign out fallback used.'
            )
          );
        }
      },
    };
  }, [
    session,
    profile,
    roles,
    loading,
    membershipState,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return value;
}
