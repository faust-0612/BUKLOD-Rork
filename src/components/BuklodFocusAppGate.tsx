import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import type { BuklodFocusApp } from '@/lib/buklodFoundation';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';

export default function BuklodFocusAppGate({
  app,
  children,
  fallback = null,
}: {
  app: BuklodFocusApp;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { loading, verifyFocusApp } = useBuklodAccess();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    void verifyFocusApp(app).then((access) => {
      if (!cancelled) {
        setAllowed(access.canSee);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [app, loading, verifyFocusApp]);

  if (loading || allowed === null) {
    if (fallback) return <>{fallback}</>;

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

  if (!allowed) {
    if (fallback) return <>{fallback}</>;

    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>Workspace Access</Text>

        <Card>
          <Text style={shared.body}>
            This workspace is available to members with the appropriate
            Organization or Sub-organization role. Check your membership
            and assigned permissions with the workspace administrator.
          </Text>
        </Card>

        <Button
          title="ORGANIZATIONS"
          onPress={() => router.push('/organizations' as any)}
        />

        <Button
          title="BACK"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  return <>{children}</>;
}
