import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { isManagedCommunityScope } from '@/lib/buklodScopeRoute';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

/**
 * System Admin or scoped org/cluster/sub-org/sub-cluster admins.
 */
export function ConfigCenterGate({
  children,
}: {
  children: ReactNode;
}) {
  const { loading, hasRole } = useAuth();
  const { activeScope } = useBuklodScope();

  const scopeAdmin =
    Boolean(activeScope?.is_admin) &&
    !!activeScope &&
    isManagedCommunityScope(activeScope);

  const allowed =
    hasRole('system_admin') || scopeAdmin;

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

  if (!allowed) {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>
          Configuration Center
        </Text>

        <Card>
          <Text style={shared.body}>
            Available to System Administrators and
            administrators of your Organization, Sub-organization,
            Cluster, or Sub-cluster.
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
