import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { colors } from '@/lib/theme';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { supabase } from '@/lib/supabase';
import { isBuklodClassroomApp } from '@/lib/buklodAppTarget';

type HandoffState = 'idle' | 'working' | 'done' | 'failed';
type ClassroomMode = 'STUDENT' | 'FACULTY' | null;

export default function Index() {
  const { session, loading, profile } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();
  const classroomApp = isBuklodClassroomApp();
  const handoff = useLocalSearchParams<{
    buklod_handoff?: string;
    access_token?: string;
    refresh_token?: string;
    classroom_mode?: string;
  }>();
  const [handoffState, setHandoffState] = useState<HandoffState>('idle');

  const requestedMode: ClassroomMode =
    String(handoff.classroom_mode ?? '').toUpperCase() === 'FACULTY'
      ? 'FACULTY'
      : String(handoff.classroom_mode ?? '').toUpperCase() === 'STUDENT'
        ? 'STUDENT'
        : null;

  const handoffRequested =
    classroomApp &&
    String(handoff.buklod_handoff ?? '') === '1' &&
    Boolean(String(handoff.access_token ?? '')) &&
    Boolean(String(handoff.refresh_token ?? ''));

  /*
   * BUKLOD_CLASSROOM_EXTENSION_SSO_R5
   * Main remains the account/session authority. Always adopt the explicit
   * Main handoff, even when Classroom already has a cached session. This
   * prevents a stale Classroom user from overriding the currently signed-in
   * BUKLOD Main account.
   */
  useEffect(() => {
    if (!handoffRequested || handoffState !== 'idle') {
      return;
    }

    setHandoffState('working');

    void supabase.auth
      .setSession({
        access_token: String(handoff.access_token),
        refresh_token: String(handoff.refresh_token),
      })
      .then(({ error }) => {
        if (error) throw error;
        setHandoffState('done');
      })
      .catch(error => {
        console.warn(
          'BUKLOD Classroom session handoff:',
          String(error?.message ?? error ?? 'Session handoff failed.')
        );
        setHandoffState('failed');
      });
  }, [
    handoff.access_token,
    handoff.refresh_token,
    handoffRequested,
    handoffState,
  ]);

  /*
   * BUKLOD_PUBLIC_BOOT_R21
   *
   * A fresh Main app/web boot with an existing session is PERSONAL/GLOBAL.
   * Classroom is different: it shares the same BUKLOD account/backend but
   * owns a focused classroom shell, so it must never reset into Main tabs.
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
    if (classroomApp) {
      publicResetInFlight.current = false;
      setBootReady(Boolean(session?.user?.id));
      return;
    }

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
    classroomApp,
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
    (handoffRequested && (handoffState === 'idle' || handoffState === 'working')) ||
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
    if (handoffRequested && handoffState === 'done' && requestedMode === 'FACULTY') {
      return <Redirect href="/profile/buklod-faculty" />;
    }

    if (handoffRequested && handoffState === 'done' && requestedMode === 'STUDENT') {
      return <Redirect href="/profile/buklod-classrooms" />;
    }

    return <Redirect href="/classroom" />;
  }

  return (
    <Redirect
      href="/(tabs)/messages"
    />
  );
}