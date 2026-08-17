import React, { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export function AdminGate({
  children,
}: {
  children: ReactNode;
}) {
  const { loading, hasRole } = useAuth();

  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          { justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator color={colors.green} />
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
