import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { colors } from '@/lib/theme';
import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';
import {
  loadBuklodOrganizationWorkspaceRuntime,
} from '@/lib/buklodOrganizationWorkspaceRuntime';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

export default function OrganizationsIndexScreen() {
  const { scopes, selectScope } = useBuklodScope();

  const organizations = useMemo(
    () =>
      scopes.filter(
        scope =>
          scope.scope_type === 'ORGANIZATION' &&
          !scope.parent_scope_id &&
          String(
            scope.membership_status ?? 'ACTIVE',
          ).toUpperCase() === 'ACTIVE',
      ),
    [scopes],
  );

  const manageable = useMemo(
    () =>
      organizations.filter(
        scope => scope.is_admin,
      ),
    [organizations],
  );

  const openOrganization = async (scopeId: string) => {
    const runtime =
      await loadBuklodOrganizationWorkspaceRuntime(scopeId);
    const landing = runtime.config.defaultLandingModule;

    if (landing === 'overview') {
      await enterScopedWorkspace(
        selectScope,
        scopeId,
        {
          section: 'home',
          fromPortal: true,
        },
      );
      return;
    }

    if (landing === 'community' || landing === 'connect') {
      await enterScopedWorkspace(
        selectScope,
        scopeId,
        {
          section:
            landing === 'community'
              ? 'community'
              : 'connect',
          fromPortal: true,
        },
      );
      return;
    }

    await selectScope(scopeId);
    ((router as any).canDismiss?.()
      ? router.dismissAll()
      : undefined);
    router.replace({
      pathname: '/organizations/module' as any,
      params: {
        scopeId,
        organization: scopeId,
        module: landing,
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{ title: 'My Organizations' }}
      />

      <BuklodPortalScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={() =>
            router.replace('/(tabs)/buklod' as any)
          }
          style={styles.back}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.greenDark}
          />
          <Text style={styles.backText}>
            Back to BUKLOD
          </Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            BUKLOD ORGANIZATION
          </Text>
          <Text style={styles.title}>
            My Organizations
          </Text>
          <Text style={styles.subtitle}>
            Open the institutional workspaces where you are an active member.
            Each Organization keeps its own members, units, modules and
            permissions.
          </Text>
        </View>

        {organizations.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="domain-off"
              size={36}
              color={colors.muted}
            />
            <Text style={styles.emptyTitle}>
              You have not joined an Organization yet.
            </Text>
            <Text style={styles.emptyText}>
              Discover an Organization or use an invite from an institution.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {organizations.map(scope => (
              <Pressable
                key={scope.scope_id}
                onPress={() =>
                  void openOrganization(scope.scope_id)
                }
                style={({ pressed }) => [
                  styles.organization,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.orgIcon}>
                  <MaterialCommunityIcons
                    name="domain"
                    size={24}
                    color={colors.greenDark}
                  />
                </View>
                <View style={styles.orgCopy}>
                  <Text
                    numberOfLines={1}
                    style={styles.orgName}
                  >
                    {scope.name}
                  </Text>
                  <Text style={styles.orgMeta}>
                    {scope.is_admin
                      ? 'Organization Admin'
                      : 'Active Member'}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={colors.muted}
                />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              router.push('/organizations/join' as any)
            }
            style={styles.action}
          >
            <MaterialCommunityIcons
              name="account-plus-outline"
              size={22}
              color={colors.greenDark}
            />
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>
                Find or join an Organization
              </Text>
              <Text style={styles.actionText}>
                Discover public institutions or enter through an approved
                Organization invitation.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.muted}
            />
          </Pressable>

          <Pressable
            onPress={() =>
              router.push('/organizations/create' as any)
            }
            style={styles.action}
          >
            <MaterialCommunityIcons
              name="domain-plus"
              size={22}
              color={colors.greenDark}
            />
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>
                Create an Organization
              </Text>
              <Text style={styles.actionText}>
                Start one configurable institutional workspace. No separate
                application or code fork is created.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>

        {manageable.length > 0 ? (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>
              ADMINISTRATION
            </Text>
            <Pressable
              onPress={() =>
                router.push(
                  '/organizations/manage' as any,
                )
              }
              style={styles.adminAction}
            >
              <MaterialCommunityIcons
                name="cog-outline"
                size={21}
                color={colors.greenDark}
              />
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>
                  Organization directory & setup
                </Text>
                <Text style={styles.actionText}>
                  Manage structure, membership, admins, access and existing
                  Organization settings.
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.muted}
              />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.principle}>
          <Text style={styles.principleTitle}>
            ONE CORE • MANY INSTITUTIONS
          </Text>
          <Text style={styles.principleText}>
            Schools, businesses, churches, NGOs, training centers and
            associations use the same BUKLOD Organization engine with different
            configuration—not different software forks.
          </Text>
        </View>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 12,
    backgroundColor: '#F4F7F5',
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  header: {
    gap: 5,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
  },
  list: {
    gap: 8,
  },
  organization: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E2DB',
    backgroundColor: '#FFFFFF',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orgIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#EAF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgCopy: {
    flex: 1,
    minWidth: 0,
  },
  orgName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  orgMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    minHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  emptyTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  actions: {
    gap: 8,
  },
  action: {
    minHeight: 68,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  actionText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  adminSection: {
    gap: 7,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  adminAction: {
    minHeight: 68,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#BFD6C7',
    backgroundColor: '#EDF6F0',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  principle: {
    borderRadius: 13,
    backgroundColor: '#173B2F',
    padding: 14,
  },
  principleTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  principleText: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.72,
  },
});
