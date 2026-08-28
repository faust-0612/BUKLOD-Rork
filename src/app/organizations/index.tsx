/* PATCH_185D_ORG_MOJIBAKE */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Stack,
  useRouter,
} from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

export default function OrganizationsIndexScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Organization' }} />

      <BuklodPortalScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BUKLOD ORGANIZATION</Text>
          <Text style={styles.title}>Organization</Text>
          <Text style={styles.subtitle}>
            Open the Organization list or create a new Organization.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/organizations/manage' as any)}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.pressed,
          ]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>
              LIST OF ORGANIZATIONS
            </Text>
            <Text style={styles.actionSubtitle}>
              View Organizations and Sub-organizations, then use
              the actions available for your exact role.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/organizations/create' as any)}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.pressed,
          ]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>
              CREATE ORGANIZATION
            </Text>
            <Text style={styles.actionSubtitle}>
              Create a new root Organization.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
        paddingHorizontal: 12,
    paddingTop: 12,
paddingBottom: 24,
    gap: 8,
    backgroundColor: '#F4F7F5',
  },
  header: {
    gap: 5,
    marginBottom: 4,
  },
  eyebrow: {
    color: '#5E7469',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#173B2F',
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: '#687970',
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minHeight: 66,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  actionText: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    color: '#173B2F',
    fontSize: 15.5,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: '#6A7A72',
    fontSize: 13.5,
    lineHeight: 18,
  },
  chevron: {
    color: '#176B4A',
    fontSize: 28,
    fontWeight: '700',
  },
});