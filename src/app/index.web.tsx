import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { colors } from '@/lib/theme';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

function withBootTimeout<T>(promise: Promise<T>, ms = 7000) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('BUKLOD_PUBLIC_SCOPE_RESET_TIMEOUT'));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}


/* BUKLOD_FINAL_WEB_COMMUNITY_ROOT_R1 */
export default function IndexWeb() {
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

  const [bootError, setBootError] =
    useState<string | null>(null);
  const [bootRetryNonce, setBootRetryNonce] =
    useState(0);

  useEffect(() => {
    if (
      !session?.user?.id ||
      (loading && !profile)
    ) {
      publicResetInFlight.current = false;
      setBootError(null);
      setBootReady(false);
      return;
    }

    if (
      activeScope?.scope_type ===
      'PUBLIC'
    ) {
      publicResetInFlight.current = false;
      setBootError(null);
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

        setBootError(null);

        void (async () => {
          try {
            await withBootTimeout(
              selectScope(publicScope.scope_id)
            );
          } catch (error) {
            console.warn(
              'BUKLOD web boot Public scope reset:',
              error
            );
            setBootError(
              'BUKLOD could not restore the Public workspace. Check your connection and retry.'
            );
          } finally {
            publicResetInFlight.current = false;
          }
        })();
      }

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
    bootRetryNonce,
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

  if (bootError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.white,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: '800',
            textAlign: 'center',
          }}
        >
          {bootError}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry Public workspace"
          onPress={() => {
            setBootError(null);
            setBootRetryNonce(value => value + 1);
          }}
          style={{
            marginTop: 16,
            minHeight: 44,
            paddingHorizontal: 18,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.green,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: '900' }}>
            RETRY PUBLIC WORKSPACE
          </Text>
        </Pressable>
      </View>
    );
  }

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
