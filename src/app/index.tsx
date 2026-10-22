import {
  useEffect,
  useRef,
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
  const { session, loading, profile } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();

  /*
   * BUKLOD_PUBLIC_BOOT_R21
   *
   * A fresh app/web boot with an existing session is PERSONAL/GLOBAL.
   * Never restore a stale Organization/Cluster/Mission Worker workspace as
   * the automatic landing context. Reset to PUBLIC first, then open Community Wall.
   * Managed workspaces remain available only when the user explicitly opens
   * them again from the scope/workspace controls.
   */
  const {
    activeScope,
    scopes,
    selectScope,
    loading: scopeLoading,
  } = useBuklodScope();

  const [
    bootReady,
    setBootReady,
  ] = useState(false);

  const publicResetInFlight =
    useRef(false);

  useEffect(() => {
    if (
      !session?.user?.id ||
      (loading && !profile)
    ) {
      publicResetInFlight.current = false;
      setBootReady(false);
      return;
    }

    if (
      activeScope?.scope_type ===
      'PUBLIC'
    ) {
      publicResetInFlight.current = false;
      setBootReady(true);
      return;
    }

    const publicScope =
      scopes.find(
        scope =>
          scope.scope_type ===
          'PUBLIC'
      );

    if (publicScope) {
      if (
        !publicResetInFlight.current
      ) {
        publicResetInFlight.current = true;

        /*
         * PERF_STARTUP_R1: selectScope updates local activeScope
         * immediately; do not hold the index spinner for persistence.
         */
        void selectScope(
          publicScope.scope_id
        )
          .catch(error => {
            console.warn(
              'BUKLOD boot Public scope reset:',
              error
            );
          })
          .finally(() => {
            publicResetInFlight.current = false;
          });
      }

      setBootReady(true);
      return;
    }

    if (!scopeLoading) {
      /*
       * Defensive fallback for accounts where PUBLIC scope could not be
       * loaded. Do not hold the whole app forever.
       */
      setBootReady(true);
    }
  }, [
    session?.user?.id,
    loading,
    profile,
    scopeLoading,
    activeScope?.scope_id,
    activeScope?.scope_type,
    scopes,
    selectScope,
  ]);

  if (
    (loading && !session && !profile) ||
    (complianceLoading && !session) ||
    (runtimeLoading && !config)
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

  /*
   * BUKLOD_LEGACY_VERIFICATION_REMOVAL_R22
   * Account/admin verification is no longer an application-wide gate.
   * A valid signed-in BUKLOD account enters the normal app immediately.
   * Organization/Cluster membership and feature-specific permissions remain
   * enforced only where those features actually require them.
   */

  if (!bootReady) {
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
      href="/(tabs)/buklod"
    />
  );
}
