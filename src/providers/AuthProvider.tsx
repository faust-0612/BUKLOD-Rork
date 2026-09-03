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

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [membershipState, setMembershipState] =
    useState<MembershipState>('loading');

  const bootstrappedRef = useRef(false);
  const sessionUserIdRef = useRef<string | null>(null);

  const loadRoles = async (
    userId?: string,
    legacyRole?: AppRole | null
  ): Promise<AppRole[]> => {
    if (!userId) {
      setRoles([]);
      return [];
    }

    const { data, error } =
      await withBuklodTimeout(
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('is_active', true),
        AUTH_QUERY_TIMEOUT_MS,
        'BUKLOD roles'
      ).catch((nextError: any) => ({
        data: null,
        error: {
          message: String(
            nextError?.message ??
              nextError ??
              'Role request timed out.'
          ),
        },
      }));

    if (error) {
      console.warn('Role load failed:', error.message);

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
        (data ?? [])
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
    knownVerified?: boolean | null
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
      const {
        data: verification,
        error: verificationError,
      } = await withBuklodTimeout(
        supabase
          .from('profiles')
          .select('is_verified')
          .eq('id', userId)
          .maybeSingle(),
        AUTH_QUERY_TIMEOUT_MS,
        'BUKLOD verification'
      ).catch((nextError: any) => ({
        data: null,
        error: {
          message: String(
            nextError?.message ??
              nextError ??
              'Verification request timed out.'
          ),
        },
      }));

      if (verificationError) {
        console.warn(
          'Verification load failed:',
          verificationError.message
        );
        setMembershipState('pending');
        return;
      }

      isVerified =
        verification?.is_verified === true;
    }

    if (isVerified === true) {
      setMembershipState('ready');
      return;
    }

    const {
      data: request,
      error: requestError,
    } = await withBuklodTimeout(
      supabase
        .from('church_join_requests')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      AUTH_QUERY_TIMEOUT_MS,
      'BUKLOD membership'
    ).catch((nextError: any) => ({
      data: null,
      error: {
        message: String(
          nextError?.message ??
            nextError ??
            'Membership request timed out.'
        ),
      },
    }));

    if (requestError) {
      console.warn(
        'Membership load failed:',
        requestError.message
      );
      setMembershipState((current) =>
        current === 'loading' ? 'pending' : current
      );
      return;
    }

    if (request?.status === 'rejected') {
      setMembershipState('rejected');
      return;
    }

    setMembershipState('pending');
  };

  const loadProfile = async (userId?: string) => {
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

    const { data, error } =
      await withBuklodTimeout(
        supabase
          .from('profiles')
          .select(
            'id,full_name,first_name,middle_name,surname,suffix,mobile,sex,username,login_method,login_identifier,avatar_url,church_id,connection_type,trust_level,is_verified,role,is_active'
          )
          .eq('id', userId)
          .single(),
        AUTH_QUERY_TIMEOUT_MS,
        'BUKLOD profile'
      ).catch((nextError: any) => ({
        data: null,
        error: {
          message: String(
            nextError?.message ??
              nextError ??
              'Profile request timed out.'
          ),
        },
      }));

    if (error || !data) {
      console.warn(
        'Profile load failed:',
        error?.message ?? 'Profile not available.'
      );

      if (cachedSnapshot) {
        return;
      }

      setMembershipState((current) =>
        current === 'loading' ? 'pending' : current
      );
      return;
    }

    const nextProfile = data as Profile;
    setProfile(nextProfile);

    /*
     * Roles and membership are independent after the profile row
     * is known. Run them together instead of serially.
     */
    const [nextRoles] = await Promise.all([
      loadRoles(
        userId,
        nextProfile.role
      ),
      loadMembership(
        userId,
        [],
        nextProfile.is_verified ?? null
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

        const session =
          data.session ??
          (await readPersistedSupabaseSession());

        setSession(session);
        sessionUserIdRef.current =
          session?.user?.id ?? null;

        await loadProfile(
          session?.user.id
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
          await loadProfile(persisted.user.id);
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

          /*
           * Keep the auth callback synchronous. Defer database
           * hydration outside the auth event callback.
           */
          setTimeout(() => {
            if (disposed) {
              return;
            }

            void loadProfile(
              nextSession?.user.id
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
        await loadProfile(session?.user.id);
      },

      refreshRoles: async () => {
        const nextRoles = await loadRoles(
          session?.user.id,
          profile?.role
        );

        await loadMembership(
          session?.user.id,
          nextRoles
        );
      },

      refreshMembership: async () => {
        await loadMembership(
          session?.user.id,
          roles
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
