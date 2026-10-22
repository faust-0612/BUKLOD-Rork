import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';
import BuklodOrganizationFocusSubscriptionCard from '@/components/BuklodOrganizationFocusSubscriptionCard';
import { resolveOrganizationIdFromScope } from '@/lib/buklodOrganizationFocusApps';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

export default function ProfileFocusAppsScreen() {
  const { activeScope, scopes } = useBuklodScope();
  const organizationId = useMemo(
    () =>
      resolveOrganizationIdFromScope(activeScope) ??
      scopes.map((scope) => resolveOrganizationIdFromScope(scope)).find(Boolean) ??
      '',
    [activeScope, scopes],
  );

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Focus Apps' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>BUKLOD Focus Apps</Text>
        <Text style={styles.body}>
          Premium portals stay locked until the Organization subscription is
          verified. Prices: ₱59/month or ₱499/year. Cluster Premium and lesson
          packages remain separate.
        </Text>
        {organizationId ? (
          <BuklodOrganizationFocusSubscriptionCard
            organizationId={organizationId}
          />
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              Join an Organization first. Focus Apps attach to that Organization
              only.
            </Text>
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/focus-directory' as any)} style={styles.card}>
          <Text style={styles.title}>Open App Directory ›</Text>
        </Pressable>
        <BuklodFoundationWorkspaceNav />
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '900', color: '#173B2F' },
  body: { fontSize: 13, lineHeight: 19, color: '#5F6F67' },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
  },
});
