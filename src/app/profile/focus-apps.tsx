import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';
import BuklodOrganizationFocusSubscriptionCard from '@/components/BuklodOrganizationFocusSubscriptionCard';
import FacultySubscriptionCard from '@/components/faculty/FacultySubscriptionCard';
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
          Individual Faculty access and Organization Focus Apps use separate
          entitlement models. Paying for BUKLOD Faculty does not require a
          separate Classroom, Attendance, or Quiz examiner payment.
        </Text>

        <Text style={styles.section}>Individual Faculty</Text>
        <FacultySubscriptionCard />

        <Text style={styles.section}>Organization Focus Apps</Text>
        <Text style={styles.body}>
          Organization portals use their Organization subscription. Cluster
          Premium and lesson packages remain separate from the individual
          BUKLOD Faculty bundle.
        </Text>
        {organizationId ? (
          <BuklodOrganizationFocusSubscriptionCard
            organizationId={organizationId}
          />
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              Join an Organization first to manage Organization-scoped Focus
              Apps. This is not required for an individual Faculty subscription.
            </Text>
          </View>
        )}
        <BuklodFoundationWorkspaceNav />
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '900', color: '#173B2F' },
  section: { fontSize: 15, fontWeight: '900', color: '#173B2F', marginTop: 6 },
  body: { fontSize: 13, lineHeight: 19, color: '#5F6F67' },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
  },
});
