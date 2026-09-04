/* PATCH_185D_ORG_MOJIBAKE */
/* PATCH_ORG_PROFILE_SETUP_HUB_R24 */
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
      <Stack.Screen options={{ title: 'Organization Setup' }} />

      <BuklodPortalScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BUKLOD ORGANIZATION</Text>
          <Text style={styles.title}>Organization Setup Hub</Text>
          <Text style={styles.subtitle}>
            Create and prepare the Organization structure here first. Set up the
            root Organization, Sub-organizations, Clusters, access, membership,
            and admin controls before opening a specific Organization workspace.
          </Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>CURRENT STRUCTURE</Text>
          <Text style={styles.noticeText}>
            Organization → Sub-organization → Cluster. Every Cluster must belong
            to an Organization. Organization Home, such as MZB Home, is opened
            only after choosing the exact Organization from the directory.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>CREATE & PRE-SET</Text>

        <Pressable
          onPress={() => router.push('/organizations/create' as any)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>CREATE ORGANIZATION</Text>
            <Text style={styles.actionSubtitle}>
              Create a new root Organization and complete its initial profile,
              type, visibility, and membership settings.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/organizations/manage' as any)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>CREATE SUB-ORGANIZATION</Text>
            <Text style={styles.actionSubtitle}>
              Select the parent root Organization, then create and configure its
              structural Sub-organization.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/clusters/create' as any)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>CREATE CLUSTER</Text>
            <Text style={styles.actionSubtitle}>
              Create a Cluster under one of the Organizations you can manage.
              Parent Organization selection is required.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>STRUCTURE & SETTINGS</Text>

        <Pressable
          onPress={() => router.push('/organizations/manage' as any)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>ORGANIZATION DIRECTORY & STRUCTURE</Text>
            <Text style={styles.actionSubtitle}>
              View root Organizations and Sub-organizations, manage exact scopes,
              configure admins and members, or deliberately open Organization Home.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/organizations/join' as any)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>JOIN ORGANIZATION</Text>
            <Text style={styles.actionSubtitle}>
              Search public Organizations and Sub-organizations, then join or send
              a request according to the configured join policy.
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>

        <View style={styles.footerNote}>
          <Text style={styles.footerTitle}>PRE-SETTING PRINCIPLE</Text>
          <Text style={styles.footerText}>
            Creation, hierarchy, access policy, membership, admins, and Cluster
            placement belong in this setup layer. The scoped Organization Home is
            for the Organization's actual day-to-day workspace after setup.
          </Text>
        </View>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
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
  notice: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#BFD8CB',
    backgroundColor: '#EAF4EE',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
    marginBottom: 4,
  },
  noticeTitle: {
    color: '#176B4A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  noticeText: {
    color: '#426257',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 2,
    color: '#5E7469',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  action: {
    minHeight: 72,
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
    fontSize: 15,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: '#6A7A72',
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: '#176B4A',
    fontSize: 28,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 6,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5E0',
    padding: 12,
    gap: 4,
  },
  footerTitle: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
  },
  footerText: {
    color: '#687970',
    fontSize: 13,
    lineHeight: 18,
  },
});