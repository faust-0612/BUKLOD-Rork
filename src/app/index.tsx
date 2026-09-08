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
import { CLASSROOM_APP_IDENTITY, isClassroomApp } from '@/lib/appTarget';

export default function Index() {
  const { session, loading, profile } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();
  const classroomApp = isClassroomApp();

  /*
   * BUKLOD_PUBLIC_BOOT_R21
   *
   * Main keeps its existing PUBLIC/global boot behavior.
   * The standalone Classroom target must never inherit Main's automatic
   * Public -> Connect landing path; once auth/compliance are ready it opens
   * the dedicated Classroom shell instead.
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

    if (classroomApp) {
      publicResetInFlight.current = false;
      setBootReady(true);
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
      setBootReady(false);

      if (
        !publicResetInFlight.current
      ) {
        publicResetInFlight.current = true;

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

      return;
    }

    if (!scopeLoading) {
      setBootReady(true);
    }
  }, [
    session?.user?.id,
    loading,
    profile,
    classroomApp,
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

  if (classroomApp) {
    return <Redirect href={CLASSROOM_APP_IDENTITY.homeRoute as any} />;
  }

  return (
    <Redirect
      href="/(tabs)/messages"
    />
  );
}
