import React, { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card } from '@/components/UI';
import { useAdminShared } from '@/components/useAdminShared';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useAuth } from '@/providers/AuthProvider';

export function AdminGate({
  children,
}: {
  children: ReactNode;
}) {
  const shared = useAdminShared();
  const { theme } = useBuklodTheme();
  const { loading, hasRole, session } = useAuth();

  if (loading && !session) {
    return (
      <View
        style={[
          shared.screen,
          { justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!hasRole('system_admin')) {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>
          Administrator Access
        </Text>

        <Card>
          <Text style={shared.body}>
            This area is restricted to authorized BUKLOD System Administrators.
          </Text>
        </Card>

        <Button
          title="BACK"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  return <>{children}</>;
}
