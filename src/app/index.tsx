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
   * PATCH_171L_REOPEN_PUBLIC_CONNECT
   *
   * Root "/" is used for an already-authenticated app reopen.
   * Before it may open global/personal Connect, normalize the
   * current BUKLOD scope to PUBLIC.
   *
   * This prevents a persisted Organization/Sub-org/Cluster/Church
   * context from leaking into the global Connect screen.
   *
   * Fresh manual/Suggested login does NOT use this root landing
   * route; those flows continue to open Public Home.
   */
  const {
    scopes,
    activeScope,
    loading: scopeLoading,
    selectScope,
  } =
    useBuklodScope();

  const [
    publicConnectReady,
    setPublicConnectReady,
  ] =
    useState(false);

  useEffect(() => {
    let cancelled =
      false;

    if (
      !session?.user?.id ||
      loading ||
      scopeLoading
    ) {
      setPublicConnectReady(
        false
      );

      return () => {
        cancelled = true;
      };
    }

    const publicScope =
      scopes.find(
        scope =>
          scope.scope_type ===
          'PUBLIC'
      );

    if (!publicScope) {
      setPublicConnectReady(
        false
      );

      return () => {
        cancelled = true;
      };
    }

    if (
      activeScope?.scope_id ===
      publicScope.scope_id
    ) {
      setPublicConnectReady(
        true
      );

      return () => {
        cancelled = true;
      };
    }

    setPublicConnectReady(
      false
    );

    void selectScope(
      publicScope.scope_id
    )
      .then(() => {
        if (!cancelled) {
          setPublicConnectReady(
            true
          );
        }
      })
      .catch(error => {
        console.warn(
          'BUKLOD reopen Public scope reset:',
          error
        );

        if (!cancelled) {
          setPublicConnectReady(
            false
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    session?.user?.id,
    loading,
    scopeLoading,
    scopes,
    activeScope?.scope_id,
    selectScope,
  ]);


  if (loading || complianceLoading || runtimeLoading || membershipState === 'loading') {
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
    scopeLoading ||
    !publicConnectReady
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
