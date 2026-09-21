import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors } from '@/lib/theme';
import {
  groupedInstitutionModules,
  institutionModuleLabel,
  type BuklodOrganizationModuleId,
} from '@/lib/buklodOrganizationWorkspace';
import {
  loadBuklodOrganizationWorkspaceRuntime,
  type BuklodOrganizationWorkspaceRuntime,
} from '@/lib/buklodOrganizationWorkspaceRuntime';
import {
  enterScopedWorkspace,
} from '@/lib/buklodScopeRoute';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type WorkspaceSection = 'home' | 'community' | 'connect';

type Props = {
  scopeId: string;
  activeSection: WorkspaceSection;
  onOpenSection: (section: WorkspaceSection) => void;
};

function orgScopes(scopes: ReturnType<typeof useBuklodScope>['scopes']) {
  return scopes.filter(
    scope =>
      String(scope.scope_type).toUpperCase() === 'ORGANIZATION' &&
      String(scope.membership_status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
  );
}

export default function BuklodInstitutionalWorkspaceNav({
  scopeId,
  activeSection,
  onOpenSection,
}: Props) {
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const { scopes, selectScope } = useBuklodScope();
  const [runtime, setRuntime] =
    useState<BuklodOrganizationWorkspaceRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRuntime(null);

    void loadBuklodOrganizationWorkspaceRuntime(scopeId)
      .then(next => {
        if (alive) setRuntime(next);
      })
      .catch(() => {
        if (alive) setRuntime(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [scopeId]);

  const organizations = useMemo(
    () => orgScopes(scopes),
    [scopes],
  );

  const grouped = useMemo(
    () =>
      runtime
        ? groupedInstitutionModules({
            config: runtime.config,
            isAdmin: runtime.isAdmin,
          })
        : [],
    [runtime],
  );

  const openModule = useCallback(
    (moduleId: BuklodOrganizationModuleId) => {
      setMenuOpen(false);
      setSwitcherOpen(false);

      if (moduleId === 'overview') {
        onOpenSection('home');
        return;
      }
      if (moduleId === 'community') {
        onOpenSection('community');
        return;
      }
      if (moduleId === 'connect') {
        onOpenSection('connect');
        return;
      }

      router.push({
        pathname: '/organizations/module' as any,
        params: {
          scopeId,
          scope_id: scopeId,
          organization: scopeId,
          module: moduleId,
        },
      });
    },
    [onOpenSection, scopeId],
  );

  const switchOrganization = useCallback(
    async (nextScopeId: string) => {
      setSwitcherOpen(false);
      setMenuOpen(false);
      if (!nextScopeId || nextScopeId === scopeId) return;

      await enterScopedWorkspace(
        selectScope,
        nextScopeId,
        {
          section: 'home',
          fromPortal: true,
        },
      );
    },
    [scopeId, selectScope],
  );

  const backToBuklod = useCallback(() => {
    router.replace('/(tabs)/buklod' as any);
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="small"
          color={colors.green}
        />
        <Text style={styles.loadingText}>
          Preparing Organization workspace…
        </Text>
      </View>
    );
  }

  if (!runtime) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableTitle}>
          Workspace navigation unavailable
        </Text>
        <Text style={styles.unavailableText}>
          The Organization home remains available. You can retry by reopening
          this Organization.
        </Text>
      </View>
    );
  }

  const moduleRows = grouped.map(group => (
    <View key={group.group} style={styles.group}>
      <Text style={styles.groupTitle}>
        {group.group}
      </Text>
      {group.modules.map(module => {
        const active =
          (module.id === 'overview' && activeSection === 'home') ||
          (module.id === 'community' && activeSection === 'community') ||
          (module.id === 'connect' && activeSection === 'connect');

        return (
          <Pressable
            key={module.id}
            accessibilityRole="button"
            onPress={() => openModule(module.id)}
            style={({ pressed }) => [
              styles.moduleRow,
              active && styles.moduleRowActive,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name={module.icon as any}
              size={18}
              color={
                active
                  ? colors.greenDark
                  : '#52675D'
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleText,
                active && styles.moduleTextActive,
              ]}
            >
              {institutionModuleLabel(
                runtime.config,
                module.id,
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ));

  if (desktop) {
    return (
      <View style={styles.desktopRail}>
        <Pressable
          onPress={backToBuklod}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={18}
            color={colors.greenDark}
          />
          <Text style={styles.backText}>
            Back to BUKLOD
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setSwitcherOpen(value => !value)
          }
          style={styles.switcher}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.switcherEyebrow}>
              ORGANIZATION
            </Text>
            <Text
              numberOfLines={1}
              style={styles.switcherName}
            >
              {runtime.scope.name}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={
              switcherOpen
                ? 'chevron-up'
                : 'chevron-down'
            }
            size={20}
            color={colors.greenDark}
          />
        </Pressable>

        {switcherOpen && (
          <View style={styles.switcherList}>
            {organizations.map(scope => (
              <Pressable
                key={scope.scope_id}
                onPress={() =>
                  void switchOrganization(scope.scope_id)
                }
                style={({ pressed }) => [
                  styles.switcherOption,
                  scope.scope_id === scopeId &&
                    styles.switcherOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={styles.switcherOptionText}
                >
                  {scope.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView
          style={styles.groupsScroll}
          contentContainerStyle={styles.groupsContent}
          showsVerticalScrollIndicator={false}
        >
          {moduleRows}
        </ScrollView>

        {runtime.isAdmin && (
          <Pressable
            onPress={() =>
              router.push({
                pathname:
                  '/organizations/setup-wizard' as any,
                params: {
                  organization: scopeId,
                  scopeId,
                },
              })
            }
            style={styles.setupButton}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={17}
              color={colors.greenDark}
            />
            <Text style={styles.setupText}>
              Workspace Setup
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.mobileShell}>
      <View style={styles.mobileTop}>
        <Pressable
          onPress={backToBuklod}
          style={styles.mobileIcon}
          accessibilityLabel="Back to BUKLOD"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.greenDark}
          />
        </Pressable>

        <Pressable
          onPress={() =>
            setSwitcherOpen(value => !value)
          }
          style={styles.mobileOrg}
        >
          <Text
            numberOfLines={1}
            style={styles.mobileOrgText}
          >
            {runtime.scope.name}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={18}
            color={colors.greenDark}
          />
        </Pressable>

        <Pressable
          onPress={() =>
            setMenuOpen(value => !value)
          }
          style={styles.mobileMenuButton}
        >
          <MaterialCommunityIcons
            name={menuOpen ? 'close' : 'menu'}
            size={21}
            color="#FFFFFF"
          />
          <Text style={styles.mobileMenuText}>
            MENU
          </Text>
        </Pressable>
      </View>

      {switcherOpen && (
        <View style={styles.mobilePanel}>
          <Text style={styles.mobilePanelTitle}>
            SWITCH ORGANIZATION
          </Text>
          {organizations.map(scope => (
            <Pressable
              key={scope.scope_id}
              onPress={() =>
                void switchOrganization(scope.scope_id)
              }
              style={styles.mobileOption}
            >
              <Text style={styles.mobileOptionText}>
                {scope.name}
              </Text>
              {scope.scope_id === scopeId && (
                <MaterialCommunityIcons
                  name="check"
                  size={18}
                  color={colors.green}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {menuOpen && (
        <ScrollView
          style={styles.mobilePanel}
          contentContainerStyle={styles.mobileMenuContent}
        >
          {moduleRows}
          {runtime.isAdmin && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname:
                    '/organizations/setup-wizard' as any,
                  params: {
                    organization: scopeId,
                    scopeId,
                  },
                })
              }
              style={styles.setupButton}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={17}
                color={colors.greenDark}
              />
              <Text style={styles.setupText}>
                Workspace Setup
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F4F7F5',
    borderBottomWidth: 1,
    borderBottomColor: '#DDE6E0',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: '700',
  },
  unavailable: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF8E8',
    borderBottomWidth: 1,
    borderBottomColor: '#EAD9A9',
  },
  unavailableTitle: {
    color: '#6B5016',
    fontSize: 12,
    fontWeight: '900',
  },
  unavailableText: {
    marginTop: 2,
    color: '#786531',
    fontSize: 11,
    lineHeight: 15,
  },
  desktopRail: {
    width: 248,
    minWidth: 248,
    maxWidth: 248,
    backgroundColor: '#F7F9F7',
    borderRightWidth: 1,
    borderRightColor: '#DCE5E0',
    padding: 10,
    gap: 9,
  },
  backButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  backText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '900',
  },
  switcher: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#D6E1DA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switcherEyebrow: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  switcherName: {
    marginTop: 2,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  switcherList: {
    borderWidth: 1,
    borderColor: '#D6E1DA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  switcherOption: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EBE7',
  },
  switcherOptionActive: {
    backgroundColor: '#ECF5EF',
  },
  switcherOptionText: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '800',
  },
  groupsScroll: {
    flex: 1,
  },
  groupsContent: {
    paddingBottom: 10,
    gap: 9,
  },
  group: {
    gap: 2,
  },
  groupTitle: {
    marginTop: 3,
    marginBottom: 2,
    paddingHorizontal: 8,
    color: '#829087',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  moduleRow: {
    minHeight: 38,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
  },
  moduleRowActive: {
    backgroundColor: '#E8F3EC',
  },
  moduleText: {
    flex: 1,
    color: '#52675D',
    fontSize: 11.5,
    fontWeight: '800',
  },
  moduleTextActive: {
    color: colors.greenDark,
  },
  setupButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#C9DACF',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 9,
  },
  setupText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.7,
  },
  mobileShell: {
    backgroundColor: '#F7F9F7',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE5E0',
  },
  mobileTop: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  mobileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F2EC',
  },
  mobileOrg: {
    minWidth: 0,
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E1DA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mobileOrgText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  mobileMenuButton: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: colors.greenDark,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mobileMenuText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  mobilePanel: {
    maxHeight: 440,
    borderTopWidth: 1,
    borderTopColor: '#E1E8E3',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  mobilePanelTitle: {
    marginBottom: 5,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  mobileOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4EAE6',
  },
  mobileOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  mobileMenuContent: {
    paddingBottom: 8,
    gap: 8,
  },
});
