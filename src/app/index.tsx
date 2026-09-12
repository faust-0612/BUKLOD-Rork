import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

/**
 * Standalone BUKLOD Report boot.
 *
 * Reuses the canonical BUKLOD account/session and global safety gates, but
 * never boots into BUKLOD Main tabs or resets the user into a PUBLIC/Main
 * workspace. Account approval/access rules remain authoritative.
 */
export default function Index() {
  const { session, loading, profile, membershipState } = useAuth();
  const { loading: complianceLoading, requiresAcceptance } = useCompliance();
  const { loading: runtimeLoading, config } = useRuntimeConfig();

  if (
    (loading && !session && !profile) ||
    (complianceLoading && !session) ||
    (runtimeLoading && !config) ||
    (session && membershipState === 'loading' && !profile)
  ) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!session) return <Redirect href="/report-login" />;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance" />;
  if (config?.update_required) return <Redirect href="/system/update-required" />;
  if (config?.pilot_access_required && !config?.pilot_access_granted) {
    return <Redirect href="/system/pilot-access" />;
  }
  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;

  const hasCommunityAccess = profile?.is_active === true && Boolean(profile?.connection_type);
  const hasCanonicalAccess =
    profile?.is_active === true &&
    (membershipState === 'ready' || hasCommunityAccess);

  if (!hasCanonicalAccess) {
    return <Redirect href="/report-access-pending" />;
  }

  return <Redirect href="/reports" />;
}
