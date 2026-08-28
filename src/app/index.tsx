import {
  useEffect,
  useState,
} from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { colors } from '@/lib/theme';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export default function Index() {
  const { session, loading, membershipState, profile } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();

  /*
   * Boot should not force Public. Forcing Public here yanked the user
   * out of Organization / Cluster as soon as they opened it.
   */
  const {
    activeScope,
    loading: scopeLoading,
  } =
    useBuklodScope();

  const [
    bootReady,
    setBootReady,
  ] =
    useState(false);

  useEffect(() => {
    if (
      !session?.user?.id ||
      (loading && !profile)
    ) {
      setBootReady(false);
      return;
    }

    if (activeScope || !scopeLoading) {
      setBootReady(true);
      return;
    }

    const readyWatchdog =
      setTimeout(() => {
        setBootReady(true);
      }, 2500);

    return () => {
      clearTimeout(readyWatchdog);
    };
  }, [
    session?.user?.id,
    loading,
    profile,
    scopeLoading,
    activeScope,
  ]);


  if (
    (loading && !session && !profile) ||
    (complianceLoading && !session) ||
    (runtimeLoading && !config) ||
    (membershipState === 'loading' && !profile)
  ) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  if (config?.update_required) return <Redirect href="/system/update-required" />;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access" />;
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;
  const hasCommunityAccess =
    profile?.is_active === true &&
    !!profile?.connection_type;

  if (membershipState !== 'ready' && !hasCommunityAccess) {
    return <Redirect href="/onboarding" />;
  }
  if (
    scopeLoading &&
    !bootReady &&
    !activeScope
  ) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            colors.white,
        }}
      >
        <ActivityIndicator
          color={colors.green}
        />
      </View>
    );
  }

  return (
    <Redirect
      href="/(tabs)/messages"
    />
  );
}
