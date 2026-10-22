import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function ScopeFormationApprovalsCompatibilityScreen() {
  useEffect(() => {
    const handle = setTimeout(() => {
      router.replace('/scope/faith-monitoring/report' as any);
    }, 0);

    return () => clearTimeout(handle);
  }, []);

  return (
    <View style={[shared.screen, styles.center]}>
      <ActivityIndicator color={colors.green} />
      <Text style={shared.h2}>Opening Formation Submission Report…</Text>
      <Text style={[shared.muted, styles.message]}>
        Formation submissions are now created and checked automatically. Manual approval is no longer required.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  message: {
    maxWidth: 420,
    textAlign: 'center',
  },
});
