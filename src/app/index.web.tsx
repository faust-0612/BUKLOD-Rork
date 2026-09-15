import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

/* BUKLOD_CITY_WEB_HOME_R1
 * Web only: preserve every existing boot/security/compliance gate, reset fresh
 * sessions to PUBLIC, then enter /city. Native index.tsx remains unchanged and
 * continues to enter Community Wall.
 */
export default function IndexWeb() {
  const { session, loading, profile } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();
  const { activeScope, scopes, selectScope, loading: scopeLoading } = useBuklodScope();
  const [bootReady, setBootReady] = useState(false);
  const publicResetInFlight = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || (loading && !profile)) {
      publicResetInFlight.current = false;
      setBootReady(false);
      return;
    }

    if (activeScope?.scope_type === 'PUBLIC') {
      publicResetInFlight.current = false;
      setBootReady(true);
      return;
    }

    const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');
    if (publicScope) {
      setBootReady(false);
      if (!publicResetInFlight.current) {
        publicResetInFlight.current = true;
        void selectScope(publicScope.scope_id)
          .catch(error => console.warn('BUKLOD City web boot Public scope reset:', error))
          .finally(() => { publicResetInFlight.current = false; });
      }
      return;
    }

    if (!scopeLoading) setBootReady(true);
  }, [session?.user?.id, loading, profile, scopeLoading, activeScope?.scope_id, activeScope?.scope_type, scopes, selectScope]);

  if ((loading && !session && !profile) || (complianceLoading && !session) || (runtimeLoading && !config)) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}><ActivityIndicator color={colors.green} /></View>;
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  if (config?.update_required) return <Redirect href="/system/update-required" />;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access" />;
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;

  if (!bootReady) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}><ActivityIndicator color={colors.green} /></View>;
  }

  return <Redirect href="/city" />;
}
