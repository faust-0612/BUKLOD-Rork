import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { hasMatchingPolicySession, allRequiredPoliciesAccepted } from '@/lib/buklodPolicyAuthGuard';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

export type RequiredPolicy = {
  policy_version_id: string;
  policy_type: 'privacy_notice'|'community_guidelines'|'pastoral_care_notice';
  version: string;
  title: string;
  summary: string;
  acceptance_kind: 'acknowledgement'|'agreement';
  accepted: boolean;
};

type AcceptanceResult = { error?: string; needsLogin?: boolean };
type ComplianceValue = {
  loading: boolean;
  policies: RequiredPolicy[];
  requiresAcceptance: boolean;
  refresh: () => Promise<void>;
  acceptAll: () => Promise<AcceptanceResult>;
};

const ComplianceContext = createContext<ComplianceValue>({
  loading: true,
  policies: [],
  requiresAcceptance: false,
  refresh: async () => {},
  acceptAll: async () => ({}),
});

const COMPLIANCE_TIMEOUT_MS = 5000;
const SESSION_MESSAGE = 'Your BUKLOD session has expired. Please sign in again.';

class PolicySessionUnavailable extends Error {
  constructor() {
    super(SESSION_MESSAGE);
    this.name = 'PolicySessionUnavailable';
  }
}

function unavailablePolicy(): RequiredPolicy {
  return {
    policy_version_id: 'offline',
    policy_type: 'privacy_notice',
    version: 'offline',
    title: 'Policy review temporarily unavailable',
    summary: 'Reconnect or sign in again to verify required acknowledgements.',
    acceptance_kind: 'acknowledgement',
    accepted: false,
  };
}

async function readRequiredPolicies(expectedUserId: string): Promise<RequiredPolicy[]> {
  // getSession() uses Supabase's own persisted/refresh-token logic. A cached
  // AuthProvider user is not proof that an RPC will carry an authenticated JWT.
  const { data: auth, error: sessionError } = await withBuklodTimeout(
    supabase.auth.getSession(),
    COMPLIANCE_TIMEOUT_MS,
    'BUKLOD policy session'
  );
  if (sessionError || !hasMatchingPolicySession(auth.session, expectedUserId)) {
    throw new PolicySessionUnavailable();
  }

  const { data, error } = await withBuklodTimeout(
    supabase.rpc('current_required_policies'),
    COMPLIANCE_TIMEOUT_MS,
    'BUKLOD required policies'
  );
  if (error) throw error;
  return (data ?? []) as RequiredPolicy[];
}

export function ComplianceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { online } = useNetwork();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<RequiredPolicy[]>([]);
  const generationRef = useRef(0);
  const cacheKey = user ? `buklod:policy-ok:${user.id}` : null;

  const refresh = async () => {
    const generation = ++generationRef.current;
    if (!user) {
      setPolicies([]);
      setLoading(false);
      return;
    }

    let cachedOk = false;
    if (cacheKey) {
      try {
        cachedOk = (await AsyncStorage.getItem(cacheKey)) === 'true';
      } catch (error) {
        console.warn('BUKLOD compliance cache:', String((error as Error)?.message ?? error));
      }
    }
    if (generation !== generationRef.current) return;

    // Offline accepted policy is a read-only navigation hint, never a
    // replacement for online server confirmation of a new acceptance.
    if (cachedOk) {
      setPolicies([]);
      setLoading(false);
    }
    if (!online) {
      setPolicies(cachedOk ? [] : [unavailablePolicy()]);
      setLoading(false);
      return;
    }
    if (!cachedOk) setLoading(true);

    try {
      const rows = await readRequiredPolicies(user.id);
      if (generation !== generationRef.current) return;
      setPolicies(rows);
      const ok = allRequiredPoliciesAccepted(rows);
      if (cacheKey) {
        void AsyncStorage.setItem(cacheKey, ok ? 'true' : 'false')
          .catch(error => console.warn('BUKLOD compliance cache save:', String(error)));
      }
    } catch (error) {
      if (generation !== generationRef.current) return;
      console.warn('BUKLOD required policies:', String((error as Error)?.message ?? error));
      setPolicies(cachedOk ? [] : [unavailablePolicy()]);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [user?.id, online]);

  const acceptAll = async (): Promise<AcceptanceResult> => {
    if (!user) return { error: SESSION_MESSAGE, needsLogin: true };
    if (!online) return { error: 'Connect to the internet to save your acknowledgement.' };
    const targetUserId = user.id;
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      // Fetch authoritative policy list instead of trusting offline placeholder
      // or a stale render. Never treat missing=[] from a fallback as acceptance.
      const required = await readRequiredPolicies(targetUserId);

      // Verify identity with Auth server BEFORE an authenticated write.
      const { data: identity, error: identityError } = await withBuklodTimeout(
        supabase.auth.getUser(),
        COMPLIANCE_TIMEOUT_MS,
        'BUKLOD policy identity'
      );
      if (identityError || identity.user?.id !== targetUserId) {
        throw new PolicySessionUnavailable();
      }

      const appVersion = Constants.expoConfig?.version ?? null;
      for (const policy of required.filter(row => !row.accepted)) {
        const { error } = await withBuklodTimeout(
          supabase.rpc('accept_required_policy', {
            p_policy_version_id: policy.policy_version_id,
            p_app_version: appVersion,
          }),
          COMPLIANCE_TIMEOUT_MS,
          'BUKLOD policy acceptance'
        );
        if (error) throw error;
      }

      // The server is authoritative: do not cache accepted=true or route away
      // until every currently required policy is actually confirmed accepted.
      const verified = await readRequiredPolicies(targetUserId);
      if (!allRequiredPoliciesAccepted(verified)) {
        if (generation === generationRef.current) setPolicies(verified);
        return { error: 'Acknowledgement was not confirmed. Please try again.' };
      }
      if (generation === generationRef.current) {
        if (cacheKey) await AsyncStorage.setItem(cacheKey, 'true');
        setPolicies(verified);
      }
      return {};
    } catch (error) {
      const needsLogin = error instanceof PolicySessionUnavailable ||
        /authentication required|jwt expired|invalid jwt/i.test(String((error as Error)?.message ?? ''));
      console.warn('BUKLOD policy acceptance:', String((error as Error)?.message ?? error));
      return {
        error: needsLogin ? SESSION_MESSAGE
          : 'Could not verify your acknowledgement. Check your connection and try again.',
        needsLogin,
      };
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  };

  const value = useMemo(() => ({
    loading,
    policies,
    requiresAcceptance: policies.some(p => !p.accepted),
    refresh,
    acceptAll,
  }), [loading, policies, user?.id, online]);

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance() { return useContext(ComplianceContext); }
