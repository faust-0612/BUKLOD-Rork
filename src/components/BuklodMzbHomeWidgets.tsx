import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import MzbRandomWallPhoto from '@/components/MzbRandomWallPhoto';
import { buklodReportLandingPath } from '@/lib/buklodReportRoutes';
import type { BuklodScope } from '@/lib/buklodScope';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { colors } from '@/lib/theme';

type Props = {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
};

/**
 * MZB-specific home sections rendered inside the canonical scope dashboard.
 */
export default function BuklodMzbHomeWidgets({
  scope,
  onOpenCommunity,
}: Props) {
  const { isExactScopeAdmin, isSystemAdmin } = useBuklodAccess();
  const showAdminTools =
    scope.is_admin || isExactScopeAdmin || isSystemAdmin;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MZB MINISTRY</Text>
        <Text style={styles.cardText}>
          Welcome to {scope.name}. Community, Connect, and Manage use the same
          scoped workspace as every other Organization.
        </Text>
        <Pressable
          onPress={() =>
            router.push('/mzb/organization' as any)
          }
          style={({ pressed }) => [
            styles.membershipLink,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="account-cog-outline"
            size={18}
            color={colors.greenDark}
          />
          <Text style={styles.membershipLinkText}>
            Organization membership & settings
          </Text>
        </Pressable>
      </View>

      <MzbRandomWallPhoto
        onOpenCommunity={onOpenCommunity}
      />

      {showAdminTools ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MZB ADMIN TOOLS</Text>
          <View style={styles.linkRow}>
            <FaithLink
              icon="file-upload-outline"
              label="BUKLOD Report"
              onPress={() =>
                router.push(buklodReportLandingPath(scope.scope_id) as any)
              }
            />
            <FaithLink
              icon="account-heart-outline"
              label="Visitors"
              onPress={() =>
                router.push({
                  pathname: '/organizations/manage-feature',
                  params: {
                    organization: scope.scope_id,
                    feature: 'Visitors',
                  },
                } as any)
              }
            />
            <FaithLink
              icon="view-dashboard-outline"
              label="Builder"
              onPress={() =>
                router.push({
                  pathname: '/organizations/manage-feature',
                  params: {
                    organization: scope.scope_id,
                    feature: 'Dashboard Builder',
                  },
                } as any)
              }
            />
            <FaithLink
              icon="shield-crown-outline"
              label="Manage"
              onPress={() =>
                router.push({
                  pathname: '/organizations/scope-manage',
                  params: {
                    organization: scope.scope_id,
                    organizationName: scope.name,
                  },
                } as any)
              }
            />
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>FAITH & FORMATION</Text>
        <View style={styles.linkRow}>
          <FaithLink
            icon="book-open-page-variant"
            label="Daily Bible"
            onPress={() => router.push('/bible' as any)}
          />
          <FaithLink
            icon="hands-pray"
            label="Prayer"
            onPress={() => router.push('/(tabs)/prayer' as any)}
          />
          <FaithLink
            icon="school-outline"
            label="Learn"
            onPress={() => router.push('/(tabs)/learn' as any)}
          />
          <FaithLink
            icon="hand-heart"
            label="Bayanihan"
            onPress={() => router.push('/bayanihan' as any)}
          />
        </View>
      </View>
    </>
  );
}

function FaithLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={colors.greenDark}
      />
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.greenDark,
  },
  cardText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  membershipLink: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FBF9',
  },
  membershipLinkText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#173B2F',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FBF9',
  },
  linkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#173B2F',
  },
  pressed: {
    opacity: 0.75,
  },
});
