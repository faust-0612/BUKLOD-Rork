import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';

export default function ProfileFocusAppsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Focus Apps' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>BUKLOD Focus Apps</Text>
        <Text style={styles.body}>
          Focus Apps are available without an Organization subscription.
          Create or join an Organization or Sub-organization to use its
          workspaces. Existing role and membership permissions still apply.
        </Text>
        <BuklodFoundationWorkspaceNav />
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '900', color: '#173B2F' },
  body: { fontSize: 13, lineHeight: 19, color: '#5F6F67' },
});
