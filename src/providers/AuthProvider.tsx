import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

  const loadRoles = async (
    userId?: string,
    legacyRole?: AppRole | null
  ): Promise<AppRole[]> => {
    if (!userId) {
      setRoles([]);
      return [];
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.warn('Role load failed:', error.message);

      // Compatibility fallback only if user_roles could not be read.
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

    // Every active BUKLOD account has Member as its baseline role.
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
    _activeRoles: AppRole[] = []
  ) => {
    if (!userId) {
      setMembershipState('none');
      return;
    }

    // Verification is now the universal entry gate.
    // Role and group do not bypass System Admin verification.
    const { data: verification, error: verificationError } =
      await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', userId)
        .maybeSingle();

    if (verificationError) {
      console.warn(
        'Verification load failed:',
        verificationError.message
      );
      setMembershipState('pending');
      return;
    }

    if (verification?.is_verified === true) {
      setMembershipState('ready');
      return;
    }

    const { data: request } = await supabase
      .from('church_join_requests')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (request?.status === 'rejected') {
      setMembershipState('rejected');
      return;
    }

    // Signed-in but not System Admin verified:
    // keep the account on the onboarding/verification screen.
    setMembershipState('pending');
  };

  const loadProfile = async (userId?: string) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setMembershipState('none');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,full_name,first_name,middle_name,surname,suffix,mobile,sex,username,login_method,login_identifier,avatar_url,church_id,connection_type,trust_level,is_verified,role,is_active'
      )
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Profile load failed:', error.message);
      setProfile(null);
      setRoles([]);
      setMembershipState('none');
      return;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);

    const nextRoles = await loadRoles(
      userId,
      nextProfile.role
    );

    await loadMembership(userId, nextRoles);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);

      await loadProfile(data.session?.user.id);

      setLoading(false);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        async (_event, nextSession) => {
          /* PATCH_171C_SIGNIN_DIRECT_HOME_RACE_FIX */
          if (_event === 'SIGNED_IN') {
            // Initial app boot already starts with loading=true.
            // A manual sign-in happens after loading has become false,
            // so raise the gate again until loadProfile() finishes.
            setLoading(true);
          }

          setSession(nextSession);

          await loadProfile(nextSession?.user.id);

          setLoading(false);
        }
      );

    return () => {
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
        await supabase.auth.signOut();
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
