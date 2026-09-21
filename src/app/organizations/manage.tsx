/* PATCH_185D_ORG_MOJIBAKE */
/* PATCH_ORG_DIRECTORY_HOME_DOOR_R25 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Stack,
  useRouter,
} from 'expo-router';
import { supabase } from '../../lib/supabase';
import { isActiveMembershipStatus } from '@/lib/buklodOrganization';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

type ScopeRow = {
  id: string;
  name: string;
  description?: string | null;
  parent_scope_id?: string | null;
  visibility?: string | null;
  status?: string | null;
  scope_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ManageableRow = {
  scope_id?: string | null;
  id?: string | null;
};

function upper(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function readJoinPolicy(scope: ScopeRow) {
  const metadata =
    scope.metadata &&
    typeof scope.metadata === 'object' &&
    !Array.isArray(scope.metadata)
      ? scope.metadata
      : {};

  const membership =
    metadata.membership &&
    typeof metadata.membership === 'object' &&
    !Array.isArray(metadata.membership)
      ? (metadata.membership as Record<string, unknown>)
      : {};

  const access =
    metadata.access &&
    typeof metadata.access === 'object' &&
    !Array.isArray(metadata.access)
      ? (metadata.access as Record<string, unknown>)
      : {};

  return upper(
    metadata.join_policy ??
      metadata.joinPolicy ??
      metadata.membership_policy ??
      metadata.membershipPolicy ??
      membership.join_policy ??
      membership.joinPolicy ??
      access.join_policy ??
      access.joinPolicy ??
      '',
  );
}

function joinLabel(scope: ScopeRow, short = false) {
  const policy = readJoinPolicy(scope);

  const approval =
    policy === 'APPROVAL_REQUIRED' ||
    policy === 'REQUEST' ||
    policy === 'REQUEST_TO_JOIN';

  if (short) {
    return approval ? 'REQUEST' : 'JOIN';
  }

  return approval
    ? 'REQUEST TO JOIN'
    : 'JOIN ORGANIZATION';
}

function canShowJoin(
  scope: ScopeRow,
  isMember: boolean,
  canManage: boolean,
) {
  if (isMember || canManage) return false;

  if (
    upper(scope.visibility || 'PUBLIC') !==
    'PUBLIC'
  ) {
    return false;
  }

  return readJoinPolicy(scope) !== 'INVITE_ONLY';
}

export default function OrganizationsManageListScreen() {
  const router = useRouter();
  const { selectScope } = useBuklodScope();
  const { showFeedback } = useBuklodFeedback();

  const reportOrganizationFailure = useCallback(
    (
      error: unknown,
      title: string,
      message: string,
      outcome: string,
    ) => {
      const base = buildBuklodUserFeedback(
        error,
        {
          context: 'general',
          fallbackTitle: title,
          fallbackMessage: message,
        },
      );
      const feedback = {
        ...base,
        tone: 'error' as const,
        title,
        message,
        nextStep: 'Try again. If it repeats, open Need Help.',
        supportCode: base.supportCode ?? 'SYS-500',
        retryable: true,
        needsSupport: true,
      };
      showFeedback(feedback, {
        autoHideMs: null,
        helpParams: {
          category: 'ORGANIZATION',
          errorCode: feedback.supportCode,
          message: feedback.message,
          sourceRoute: '/organizations/manage',
        },
      });
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: feedback.category,
        supportCode: feedback.supportCode,
        route: '/organizations/manage',
        feature: 'Organization',
        outcome,
      });
    },
    [showFeedback],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [manageableIds, setManageableIds] =
    useState<Set<string>>(new Set());
  const [activeMemberIds, setActiveMemberIds] =
    useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id || null;

      const [
        scopesResult,
        manageableResult,
        membershipsResult,
      ] = await Promise.all([
        (supabase as any)
          .from('buklod_scopes')
          .select(
            'id,name,description,parent_scope_id,visibility,status,scope_type,metadata',
          )
          .eq('scope_type', 'ORGANIZATION')
          .neq('status', 'DELETED')
          .order('name', { ascending: true })
          .limit(500),

        (supabase as any).rpc(
          'buklod_my_manageable_organizations_v2',
        ),

        userId
          ? (supabase as any)
              .from('buklod_scope_memberships')
              .select('scope_id,user_id,membership_status')
              .eq('user_id', userId)
              .eq('membership_status', 'ACTIVE')
              .limit(500)
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      if (scopesResult.error) {
        throw scopesResult.error;
      }

      const allScopes =
        (scopesResult.data || []) as ScopeRow[];

      const organizations = allScopes;

      setScopes(organizations);

      const nextManageable = new Set<string>();

      if (!manageableResult.error) {
        (
          (manageableResult.data || []) as ManageableRow[]
        ).forEach(row => {
          const id = String(
            row.scope_id || row.id || '',
          ).trim();

          if (id) {
            nextManageable.add(id);
          }
        });
      }

      setManageableIds(nextManageable);

      const nextMemberships = new Set<string>();

      if (!membershipsResult.error && userId) {
        (
          (membershipsResult.data || []) as any[]
        ).forEach(row => {
          const rowUserId = String(
            row.user_id ??
              row.profile_id ??
              row.member_id ??
              '',
          ).trim();

          const scopeId = String(
            row.scope_id ?? '',
          ).trim();

          const membershipStatus =
            row.membership_status ?? row.status ?? '';

          if (
            rowUserId === userId &&
            scopeId &&
            isActiveMembershipStatus(membershipStatus)
          ) {
            nextMemberships.add(scopeId);
          }
        });
      }

      setActiveMemberIds(nextMemberships);
    } catch (error: any) {
      reportOrganizationFailure(
        error,
        'Organizations unavailable',
        "BUKLOD couldn't load Organizations right now.",
        'organization_load_failed',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roots = useMemo(
    () =>
      scopes.filter(
        scope => !scope.parent_scope_id,
      ),
    [scopes],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, ScopeRow[]>();

    scopes.forEach(scope => {
      if (!scope.parent_scope_id) return;

      const current =
        map.get(scope.parent_scope_id) || [];

      current.push(scope);
      current.sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      map.set(scope.parent_scope_id, current);
    });

    return map;
  }, [scopes]);

  const openJoin = (scope: ScopeRow) => {
    router.push({
      pathname: '/organizations/join' as any,
      params: {
        scopeId: scope.id,
        scope_id: scope.id,
        organizationId: scope.id,
        organization_id: scope.id,
        id: scope.id,
        organizationName: scope.name,
      },
    } as any);
  };

  const openWorkspace = async (scope: ScopeRow) => {
    try {
      await enterScopedWorkspace(
        selectScope,
        scope.id,
        { section: 'home', fromPortal: true },
      );
    } catch (error: unknown) {
      reportOrganizationFailure(
        error,
        'Workspace not opened',
        "BUKLOD couldn't open this Organization workspace right now.",
        'organization_workspace_failed',
      );
    }
  };

  const openManage = (scope: ScopeRow) => {
    router.push({
      pathname:
        '/organizations/scope-manage' as any,
      params: {
        scopeId: scope.id,
        scope_id: scope.id,
        organizationId: scope.id,
        organization_id: scope.id,
        id: scope.id,
        organizationName: scope.name,
      },
    } as any);
  };

  const openUnitsStructure = (scope: ScopeRow) => {
    router.push({
      pathname: '/organizations/suborganizations' as any,
      params: {
        mode: 'units',
        parentScopeId: scope.id,
        parent_scope_id: scope.id,
        organizationId: scope.id,
        organization_id: scope.id,
        id: scope.id,
        parentName: scope.name,
      },
    } as any);
  };

  const createSuborganization = (scope: ScopeRow) => {
    openUnitsStructure(scope);
  };

  const renderSuborganization = (
    scope: ScopeRow,
  ) => {
    const isMember =
      activeMemberIds.has(scope.id);
    const canManage =
      manageableIds.has(scope.id);
    const showJoin = canShowJoin(
      scope,
      isMember,
      canManage,
    );

    return (
      <View key={scope.id} style={styles.subRow}>
        <View style={styles.subText}>
          <Text style={styles.subKind}>{'\u{1F9E9}'} SUB-ORGANIZATION</Text>
          <Text style={styles.subName}>
            {scope.name}
          </Text>
        </View>

        <View style={styles.subButtons}>
          {showJoin ? (
            <Pressable
              onPress={() => openJoin(scope)}
              style={({ pressed }) => [
                styles.subJoin,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.subJoinText}>
                {joinLabel(scope, true)}
              </Text>
            </Pressable>
          ) : null}

          {canManage ? (
            <Pressable
              onPress={() => openManage(scope)}
              style={({ pressed }) => [
                styles.subManage,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.subManageText}>
                MANAGE
              </Text>
            </Pressable>
          ) : null}

                  {isMember ? (
                    <Pressable
                      onPress={() =>
                        void openWorkspace(scope)
                      }
                      style={({ pressed }) => [
                        styles.subOpen,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.subOpenText}>
                        OPEN HOME
                      </Text>
                    </Pressable>
                  ) : null}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'List of Organizations',
        }}
      />

      <BuklodPortalScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            ORGANIZATION DIRECTORY
          </Text>
          <Text style={styles.title}>
            List of Organizations
          </Text>
          <Text style={styles.subtitle}>
            Join an Organization, view its
            Sub-organizations, or manage the exact
            scope when you are an authorized admin.
          </Text>
        </View>

        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Loading Organizations...
            </Text>
          </View>
        ) : roots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No Organizations found.
            </Text>
          </View>
        ) : (
          roots.map(scope => {
            const isMember =
              activeMemberIds.has(scope.id);
            const canManage =
              manageableIds.has(scope.id);
            const showJoin = canShowJoin(
              scope,
              isMember,
              canManage,
            );
            const children =
              childrenByParent.get(scope.id) || [];

            return (
              <View
                key={scope.id}
                style={styles.orgCard}>
                <View style={styles.orgTop}>
                  <View style={styles.orgText}>
                    <Text style={styles.orgKind}>{'\u{1F3DB}\uFE0F'} ORGANIZATION</Text>
                    <Text style={styles.orgName}>
                      {scope.name}
                    </Text>

                    {scope.description ? (
                      <Text
                        style={styles.description}>
                        {scope.description}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={styles.visibilityPill}>
                    <Text
                      style={styles.visibilityText}>
                      {upper(
                        scope.visibility ||
                          'PUBLIC',
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.mainButtons}>
                  {showJoin ? (
                    <Pressable
                      onPress={() => openJoin(scope)}
                      style={({ pressed }) => [
                        styles.joinButton,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={
                          styles.joinButtonText
                        }>
                        {joinLabel(scope)}
                      </Text>
                    </Pressable>
                  ) : null}

                  {canManage ? (
                    <Pressable
                      onPress={() =>
                        openManage(scope)
                      }
                      style={({ pressed }) => [
                        styles.manageButton,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={
                          styles.manageButtonText
                        }>
                        MANAGE ORGANIZATION
                      </Text>
                    </Pressable>
                  ) : null}

                  {isMember ? (
                    <Pressable
                      onPress={() =>
                        void openWorkspace(scope)
                      }
                      style={({ pressed }) => [
                        styles.openButton,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={
                          styles.openButtonText
                        }>
                        OPEN ORGANIZATION HOME
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.subSection}>
                  <View style={styles.subHeader}>
                    <View
                      style={styles.subHeaderText}>
                      <Text style={styles.subTitle}>
                        SUB ORGANIZATION - LIST
                      </Text>
                      <Text
                        style={styles.subCaption}>
                        {children.length}
                        {children.length === 1
                          ? ' sub-organization'
                          : ' sub-organizations'}
                      </Text>
                    </View>

                    {canManage ? (
                      <Pressable
                        onPress={() =>
                          createSuborganization(
                            scope,
                          )
                        }
                        style={({ pressed }) => [
                          styles.createSubButton,
                          pressed &&
                            styles.pressed,
                        ]}>
                        <Text
                          style={
                            styles.createSubText
                          }>
                          CREATE SUB-ORGANIZATION
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {children.length === 0 ? (
                    <Text style={styles.noSub}>
                      No Sub-organizations yet.
                    </Text>
                  ) : (
                    children.map(
                      renderSuborganization,
                    )
                  )}
                </View>
              </View>
            );
          })
        )}
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
    color: '#60746A',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#173B2F',
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    color: '#687970',
    fontSize: 14,
    lineHeight: 20,
  },
  orgCard: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D9E3DE',
    backgroundColor: '#FFFFFF',
    padding: 11,
    gap: 8,
  },
  orgTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  orgText: {
    flex: 1,
    gap: 3,
  },
  orgKind: {
    color: '#61766C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  orgName: {
    color: '#173B2F',
    fontSize: 17,
    fontWeight: '900',
  },
  description: {
    color: '#6B7B73',
    fontSize: 13.5,
    lineHeight: 18,
  },
  visibilityPill: {
    borderRadius: 999,
    backgroundColor: '#EDF4F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  visibilityText: {
    color: '#4D695D',
    fontSize: 12,
    fontWeight: '900',
  },
  mainButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  joinButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#176B4A',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  manageButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#173B2F',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  openButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#176B4A',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  memberPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: '#E8F3ED',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberPillText: {
    color: '#176B4A',
    fontSize: 12,
    fontWeight: '900',
  },
  subSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DEE7E2',
    paddingTop: 12,
    gap: 8,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  subHeaderText: {
    flex: 1,
    gap: 2,
  },
  subTitle: {
    color: '#24483A',
    fontSize: 13.5,
    fontWeight: '900',
  },
  subCaption: {
    color: '#75857D',
    fontSize: 12,
  },
  createSubButton: {
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#176B4A',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createSubText: {
    color: '#176B4A',
    fontSize: 12,
    fontWeight: '900',
  },
  subRow: {
    minHeight: 58,
    borderRadius: 12,
    backgroundColor: '#F6F9F7',
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subText: {
    flex: 1,
    gap: 2,
  },
  subKind: {
    color: '#75857D',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subName: {
    color: '#24483A',
    fontSize: 14,
    fontWeight: '900',
  },
  subButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subJoin: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#176B4A',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subJoinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  subManage: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#173B2F',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subManageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  subOpen: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#176B4A',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subOpenText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  noSub: {
    color: '#7B8A82',
    fontSize: 12.5,
    paddingVertical: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6D7D75',
    textAlign: 'center',
  },
});