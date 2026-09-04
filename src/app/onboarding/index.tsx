import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  View,
} from 'react-native';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

/**
 * BUKLOD_LEGACY_VERIFICATION_REMOVAL_R22
 *
 * This route is retained only for compatibility with old links/navigation
 * stacks. The former admin-verification interstitial is retired.
 *
 * Signed-in users are returned to the canonical app root, where normal Public
 * scope boot continues. Signed-out users go to login. There is no verification
 * polling, admin-approval wait screen, or account-wide navigation lock here.
 */
export default function OnboardingScreen() {
  const {
    session,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.white,
        }}
      >
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/" />;
}
