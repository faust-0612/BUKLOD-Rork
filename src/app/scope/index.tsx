import BuklodCommunitySponsoredAd from '@/components/BuklodCommunitySponsoredAd';
import * as ReactDashboardTheme from 'react';
import {
  ImageBackground as DashboardImageBackground,
  StyleSheet as DashboardStyleSheet,
} from 'react-native';
import {
  DEFAULT_DASHBOARD_THEME,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
// PATCH_170A_SCOPE_THEME
import BuklodHomeScopeBulletins from '@/components/BuklodHomeScopeBulletins';
import BuklodHomeFaithPanel from '@/components/BuklodHomeFaithPanel';
import BuklodScopeBuklodLessonPanel from '@/components/BuklodScopeBuklodLessonPanel';
import BuklodScopeFaithMonitoringSummary from '@/components/BuklodScopeFaithMonitoringSummary';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  createBuklodScopePost,
  getBuklodScopeFeed,
  getBuklodScopePeople,
  rankBuklodScopePosts,
  ScopeFeedMode,
  ScopePerson,
  ScopePost,
  type BuklodScope,
} from '@/lib/buklodScope';

import BuklodScopeBar from '@/components/BuklodScopeBar';
import BuklodScopedDashboardHeader from '@/components/BuklodScopedDashboardHeader';

import { colors } from '@/lib/theme';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

import BuklodCommunityBulletin from '@/components/BuklodCommunityBulletin';
import BuklodExclusiveScopeCommunity from '@/components/BuklodExclusiveScopeCommunity';
import {
  loadScopeDashboardTheme,
  saveScopeDashboardTheme,
} from '@/lib/buklodDashboardTheme';
import BuklodClusterHomeCommandCenter from '@/components/BuklodClusterHomeCommandCenter';
import BuklodScopeHomeDashboard from '@/components/BuklodScopeHomeDashboard';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import BuklodScopeRouteState from '@/components/BuklodScopeRouteState';
import {
  exitScopedWorkspace,
  readRouteScopeId,
} from '@/lib/buklodScopeRoute';
import {
  useBuklodScrollBottomInset,
} from '@/lib/buklodSafeArea';
import { useResolvedScope } from '@/hooks/useResolvedScope';

import BuklodConnectThread
  from '@/components/BuklodConnectThread';


import BuklodScopeAttendanceCard from '@/components/BuklodScopeAttendanceCard';
import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
// PATCH_170B_R3_SCOPE_PERSISTENCE

type Section =
  | 'home'
  | 'community'
  | 'connect';

const SECTIONS: Array<{
  key: Section;
  label: string;
  icon: any;
}> = [
  {
    key: 'home',
    label: 'HOME',
    icon: 'home-outline',
  },
  {
    key: 'community',
    label: 'COMMUNITY',
    icon: 'account-group-outline',
  },
  {
    key: 'connect',
    label: 'CONNECT',
    icon: 'message-text-outline',
  },
];

export default function
ScopeWorkspaceScreen() {
  const {
    isAdmin: canCustomizeDashboard,
  } = useBuklodAccess();

  const [
    dashboardTheme,
    setDashboardTheme,
  ] = ReactDashboardTheme.useState<DashboardTheme>(
    DEFAULT_DASHBOARD_THEME
  );

  const params =
    useLocalSearchParams<{
      section?: string;
      scopeId?: string | string[];
      scope_id?: string | string[];
    }>();

  const routeScopeId =
    readRouteScopeId(params);

  const {
    activeScope,
    scopes,
    selectScope,
    loading,
    error,
    refresh,
  } =
    useBuklodScope();

  const resolution =
    useResolvedScope({
      routeScopeId,
      requireMembership: true,
    });

  const workspaceScope =
    resolution.scope ?? activeScope;

  ReactDashboardTheme.useEffect(
    () => {
      let mounted = true;

      setDashboardTheme(
        DEFAULT_DASHBOARD_THEME
      );

      if (!workspaceScope?.scope_id) {
        return () => {
          mounted = false;
        };
      }

      void loadScopeDashboardTheme(
        workspaceScope.scope_id
      )
        .then(nextTheme => {
          if (mounted) {
            setDashboardTheme(
              nextTheme
            );
          }
        })
        .catch(error => {
          console.warn(
            'Dashboard theme load failed:',
            error
          );
        });

      return () => {
        mounted = false;
      };
    },
    [workspaceScope?.scope_id]
  );


  const initialSection =
    SECTIONS.some(
      (item) =>
        item.key ===
        params.section
    )
      ? (params.section as Section)
      : 'home';

  const [
    section,
    setSection,
  ] =
    useState<Section>(
      initialSection
    );

  useEffect(() => {
    if (
      SECTIONS.some(
        (item) =>
          item.key ===
          params.section
      )
    ) {
      setSection(
        params.section as Section
      );
    }
  }, [params.section]);

  /* PATCH_172I_R3_CLUSTER_TOP_NAV_ALL_SECTIONS */
  const visibleSections =
    SECTIONS;

  /*
   * Cluster uses Public Connect.
   * If an old/deep link opens
   * /scope?section=connect while a
   * Cluster is active, return to Home.
   */
  /* PATCH_172I_R3_CLUSTER_CONNECT_NO_REDIRECT
   * Legacy Cluster Connect-to-Home redirect removed.
   */

  const openSection =
    useCallback(
      (nextSection: Section) => {
        setSection(nextSection);

        router.setParams({
          section: nextSection,
          ...(routeScopeId
            ? { scopeId: routeScopeId }
            : {}),
        } as any);
      },
      [routeScopeId]
    );

  
  /* PATCH_171H_HOOK_ORDER: keep exitWorkspace before all early returns. */
  /*
   * SMOOTH_NAV_R2
   * Restore Public before leaving Cluster so the canonical
   * guard cannot bounce the user back into /scope.
   */
  const exitWorkspace =
    useCallback(
      async () => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        if (
          workspaceScope?.scope_type ===
            'CLUSTER' ||
          workspaceScope?.scope_type ===
            'ORGANIZATION'
        ) {
          await exitScopedWorkspace(
            selectScope,
            scopes,
            '/home'
          );
          return;
        }

        router.back();
      },
      [
        workspaceScope?.scope_type,
        scopes,
        selectScope,
      ]
    );

  const handleWorkspaceBack =
    useCallback(() => {
      if (section !== 'home') {
        openSection('home');
        return;
      }

      void exitWorkspace();
    }, [
      section,
      openSection,
      exitWorkspace,
    ]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (
      resolution.access !==
        'authorized' ||
      !workspaceScope
    ) {
      return;
    }

    const subscription =
      BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (section !== 'home') {
            openSection('home');
            return true;
          }

          void handleWorkspaceBack();
          return true;
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    section,
    handleWorkspaceBack,
    openSection,
    resolution.access,
    workspaceScope,
  ]);

if (
    !workspaceScope &&
    (resolution.access === 'loading' || loading)
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.green}
        />
        <Text style={styles.muted}>
          Loading workspace...
        </Text>
      </View>
    );
  }

  if (
    resolution.access !== 'authorized' ||
    !workspaceScope
  ) {
    return (
      <BuklodScopeRouteState
        access={
          resolution.access === 'authorized'
            ? 'unauthorized'
            : resolution.access
        }
        title="Workspace unavailable"
        message={
          resolution.message ??
          error ??
          'No active BUKLOD scope is available.'
        }
        onRetry={() => {
          void refresh();
        }}
        onBack={() => {
          void exitWorkspace();
        }}
      />
    );
  }

  if (
    workspaceScope.scope_type ===
    'PUBLIC'
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.green}
        />
        <Text style={styles.muted}>
          Opening Public BUKLOD...
        </Text>
      </View>
    );
  }
return (
    <View
      style={[[[
        styles.screen,
        {
          backgroundColor:
            dashboardTheme.backgroundColor,
        },
      ], (/* PATCH_172I_CLUSTER_CONNECT_FLUSH */ (workspaceScope.scope_type === 'ORGANIZATION' || workspaceScope.scope_type === 'CLUSTER') && section === 'connect') && { /* PATCH_172H_CONTENT_WRAPPER_FLUSH */ marginTop: 0, paddingTop: 0 }], (/* PATCH_172I_CLUSTER_CONNECT_FLUSH */ (workspaceScope.scope_type === 'ORGANIZATION' || workspaceScope.scope_type === 'CLUSTER') && section === 'connect') && { /* PATCH_172H_WORKSPACE_GAP_ZERO */ gap: 0 }]}
    >
      {!!dashboardTheme.backgroundImage && (
        <DashboardImageBackground
          source={{
            uri: dashboardTheme.backgroundImage,
          }}
          resizeMode="cover"
          style={DashboardStyleSheet.absoluteFill}
        />
      )}
      <BuklodScopedDashboardHeader
        scopeName={workspaceScope.name}
        scopeType={workspaceScope.scope_type}
        geoLevel={workspaceScope.geo_level}
        section={section}
        onBack={handleWorkspaceBack}
        theme={dashboardTheme}
        canCustomize={canCustomizeDashboard}
        onThemeChange={async nextTheme => {
          await saveScopeDashboardTheme(
            workspaceScope.scope_id,
            nextTheme
          );

          setDashboardTheme(
            nextTheme
          );
        }}
      />
      {/* PATCH_172F_ORG_STATIC_TITLE_NO_SELECTOR */}
      {/* PATCH_172I_R3_CLUSTER_NO_SCOPE_SELECTOR */}
      {workspaceScope.scope_type !== 'ORGANIZATION' &&
       workspaceScope.scope_type !== 'CLUSTER' && (
        <BuklodScopeBar />
      )}

      {section !== 'connect' && (
        <></>
      )}

      <View
        style={[[
          styles.tabs,
          {
            backgroundColor:
              dashboardTheme.cardColor,
          },
        ], (/* PATCH_172I_CLUSTER_CONNECT_FLUSH */ (workspaceScope.scope_type === 'ORGANIZATION' || workspaceScope.scope_type === 'CLUSTER') && section === 'connect') && { /* PATCH_172H_TOP_NAV_FLUSH */ marginBottom: 0 }]}
      >
        {visibleSections.map(
          (item) => {
            const active =
              section === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() =>
                  openSection(
                    item.key
                  )
                }
                style={[
                  styles.tab,
                  active &&
                    styles.tabOn,
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={18}
                  color={
                    active
                      ? colors.greenDark
                      : colors.muted
                  }
                />

                <Text
                  style={[
                    styles.tabText,
                    active &&
                      styles.tabTextOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }
        )}

      </View>

      {section === 'home' && workspaceScope ? (
        <View style={{ flex: 1, minHeight: 0 }}>
        <ScopeHome
          scope={workspaceScope}
          onOpenCommunity={() =>
            openSection('community')
          }
          onOpenConnect={() =>
            openSection('connect')
          }
        />
        </View>
      ) : null}

      {section ===
        'community' && workspaceScope ? (
        <View style={{ flex: 1, minHeight: 0 }}>
        <ScopeCommunity scope={workspaceScope} />
        </View>
      ) : null}

      {section === 'connect' && workspaceScope ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          {workspaceScope.scope_type ===
            'ORGANIZATION' ||
          workspaceScope.scope_type ===
            'CLUSTER'
            ? (
                <OrganizationCommunityConnect
                  scope={workspaceScope}
                  onBack={() => openSection('home')}
                />
              )
            : (
                <ScopeConnect scope={workspaceScope} />
              )}
        </View>
        ) : null}
    </View>
  );
}

/* PATCH_170B_CLUSTER_HOME_ROUTER
 * Cluster keeps the approved member command center (no manageMode on Home).
 * Organization / Sub-organization use the shared Phase 1 dashboard.
 */
function ScopeHome({
  scope,
  onOpenCommunity,
  onOpenConnect,
}: {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
  onOpenConnect?: () => void;
}) {
  if (scope.scope_type === 'CLUSTER') {
    return (
      <BuklodClusterHomeCommandCenter
        scope={scope}
        onOpenCommunity={onOpenCommunity}
        onOpenConnect={onOpenConnect}
        manageMode={false}
      />
    );
  }

  if (scope.scope_type === 'ORGANIZATION') {
    return (
      <BuklodScopeHomeDashboard
        scope={scope}
        onOpenCommunity={onOpenCommunity}
        onOpenConnect={onOpenConnect}
      />
    );
  }

  return <LegacyScopeHome scope={scope} />;
}

function LegacyScopeHome({
  scope,
}: {
  scope: BuklodScope;
}) {
  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: 12,
    });
  const showFaithContent =
    Boolean(scope.show_faith_content);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: scrollBottomInset,
        },
      ]}
    >
      <View style={styles.hero}>
        <Text
          style={
            styles.heroType
          }
        >
          {scope.scope_type}
          {scope.geo_level
            ? ` \u2022 ${scope.geo_level}`
            : ''}
        </Text>

        <Text
          style={
            styles.heroTitle
          }
        >
          {scope.name}
        </Text>

        <Text
          style={
            styles.heroText
          }
        >
          {scope.scope_type ===
          'CLUSTER'
            ? 'Your Cluster Home'
            : scope.scope_type ===
              'CHURCH'
            ? 'Your Location Home'
            : 'Your BUKLOD Home'}
        </Text>
      </View>

      {showFaithContent && (
        <>
          <BuklodScopeFaithMonitoringSummary scope={scope} />
          <BuklodScopeBuklodLessonPanel scope={scope} />
          <BuklodHomeFaithPanel scopeId={scope.scope_id} />
        </>
      )}

      <BuklodHomeScopeBulletins />
      {/* PATCH_177A_SCOPE_ATTENDANCE_CARD */}
      <BuklodScopeAttendanceCard
        scopeId={scope.scope_id}
        scopeType={scope.scope_type}
      />

      {scope.scope_type !== 'CLUSTER' && (
        <BuklodCommunityBulletin />
      )}

      <BuklodScreenBottomBanner placement="home" variant="large" />
    </ScrollView>
  );
}


/* PATCH_169D_EXCLUSIVE_SCOPE_COMMUNITY
 * Organization, child Organization/Sub-organization and Cluster
 * use one exact-scope social Community implementation.
 * PUBLIC / LOCAL / CHURCH keep the previous implementation below.
 */
function ScopeCommunity({
  scope,
}: {
  scope: BuklodScope;
}) {
  if (
    scope.scope_type === 'ORGANIZATION' ||
    scope.scope_type === 'CLUSTER'
  ) {
    return (
      <BuklodExclusiveScopeCommunity
        scope={scope}
      />
    );
  }

  return <LegacyScopeCommunity scope={scope} />;
}

function LegacyScopeCommunity({
  scope,
}: {
  scope: BuklodScope;
}) {

  const [posts, setPosts] =
    useState<ScopePost[]>([]);

  const [
    feedMode,
    setFeedMode,
  ] =
    useState<ScopeFeedMode>(
      'for_you'
    );

  const [body, setBody] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const displayPosts =
    useMemo(
      () =>
        rankBuklodScopePosts(
          posts,
          feedMode
        ),
      [
        posts,
        feedMode,
      ]
    );

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        setPosts(
          await getBuklodScopeFeed(
            scope.scope_id,
            60
          )
        );
      } catch (error: any) {
        Alert.alert(
          'Community',
          String(
            error?.message ??
            error
          )
        );
      } finally {
        setLoading(false);
      }
    }, [
      scope.scope_id,
    ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    const text =
      body.trim();

    if (!text) {
      return;
    }

    setBusy(true);

    try {
      await createBuklodScopePost(
        scope.scope_id,
        text,
        'general'
      );

      setBody('');
      await load();
    } catch (error: any) {
      Alert.alert(
        'Community',
        String(
          error?.message ??
          error
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <BuklodCommunitySponsoredAd audience="scope" />
      <View style={styles.card}>
        <Text
          style={
            styles.cardTitle
          }
        >
          Community Feed
        </Text>

        <View
          style={
            styles.feedModeRow
          }
        >
          {(
            [
              [
                'for_you',
                'FOR YOU',
              ],
              [
                'latest',
                'LATEST',
              ],
            ] as const
          ).map(
            ([
              value,
              label,
            ]) => {
              const selected =
                feedMode === value;

              return (
                <Pressable
                  key={value}
                  onPress={() =>
                    setFeedMode(
                      value
                    )
                  }
                  style={[
                    styles.feedModeButton,
                    selected &&
                      styles.feedModeButtonOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedModeText,
                      selected &&
                        styles.feedModeTextOn,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>

        <Text
          style={
            styles.muted
          }
        >
          {feedMode ===
          'for_you'
            ? 'Automatic ranking inside the selected scope using recency, scope relevance, interaction affinity, content preference, engagement, and priority.'
            : 'Newest posts first inside the selected scope.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text
          style={
            styles.cardTitle
          }
        >
          Share with {scope.name}
        </Text>

        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Share an update..."
          placeholderTextColor={
            colors.muted
          }
          style={styles.composer}
        />

        <Pressable
          disabled={
            busy ||
            !body.trim()
          }
          onPress={() =>
            void publish()
          }
          style={[
            styles.primary,
            (busy ||
              !body.trim()) &&
              styles.disabled,
          ]}
        >
          <Text
            style={
              styles.primaryText
            }
          >
            {busy
              ? 'POSTING...'
              : 'POST'}
          </Text>
        </Pressable>
      </View>

      {loading && (
        <ActivityIndicator
          color={colors.green}
        />
      )}

      {!loading &&
        displayPosts.length ===
          0 && (
          <View style={styles.card}>
            <Text
              style={
                styles.muted
              }
            >
              No posts yet in this community.
            </Text>
          </View>
        )}

      {displayPosts.map(
        (post) => (
          <View
            key={post.id}
            style={styles.card}
          >
            <Text
              style={
                styles.postAuthor
              }
            >
              {resolvePersonDisplayName(
                post.author_name,
                post.user_id,
              )}
            </Text>

            <Text
              style={
                styles.postMeta
              }
            >
              {post.category
                ?.toUpperCase() ??
                'POST'}
              {' \u2022 '}
              {new Date(
                post.created_at
              ).toLocaleString()}
            </Text>

            <Text
              style={
                styles.bodyText
              }
            >
              {post.body}
            </Text>
          </View>
        )
      )}
    </ScrollView>
  );
}


/*
 * PATCH_172E_ORG_COMMUNITY_ONLY_CONNECT
 *
 * Parent Organization and Sub-organization Connect are exact-scope
 * COMMUNITY conversations only. Personal messages stay exclusively
 * in the global bottom Connect (/messages).
 */
function OrganizationCommunityConnect({
  scope,
  onBack,
}: {
  scope: BuklodScope;
  onBack?: () => void;
}) {
  if (
    scope.scope_type !==
      'ORGANIZATION' &&
    scope.scope_type !==
      'CLUSTER'
  ) {
    return null;
  }

  return (
    <View
      style={[{
        flex: 1,
        minHeight: 0,
      }, { /* PATCH_172H_ORG_CONNECT_SHELL_FLUSH */ marginTop: 0, paddingTop: 0 }]}
    >
      <BuklodConnectThread
        mode="scope"
        containerId={
          scope.scope_id
        }
        onBackOverride={onBack}
      />
    </View>
  );
}

function ScopeConnect({
  scope,
}: {
  scope: BuklodScope;
}) {
  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: 12,
    });

  const [query, setQuery] =
    useState('');

  const [people, setPeople] =
    useState<ScopePerson[]>([]);

  const [loading, setLoading] =
    useState(false);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        setPeople(
          await getBuklodScopePeople(
            scope.scope_id,
            query.trim(),
            60
          )
        );
      } catch (error: any) {
        Alert.alert(
          'Connect',
          String(
            error?.message ??
            error
          )
        );
      } finally {
        setLoading(false);
      }
    }, [
      scope.scope_id,
      query,
    ]);

  useEffect(() => {
    const delay =
      query.trim().length > 0
        ? 250
        : 0;

    const timer =
      setTimeout(
        () => {
          void load();
        },
        delay
      );

    return () =>
      clearTimeout(timer);
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: scrollBottomInset,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text
          style={
            styles.cardTitle
          }
        >
          Connect in {scope.name}
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search member..."
          placeholderTextColor={
            colors.muted
          }
          style={styles.search}
        />
      </View>

      {loading && (
        <ActivityIndicator
          color={colors.green}
        />
      )}

      {!loading &&
        people.length === 0 && (
          <View style={styles.card}>
            <Text
              style={
                styles.muted
              }
            >
              No members matched your search.
            </Text>
          </View>
        )}

      {people.map(
        (person) => (
          <View
            key={
              person.user_id
            }
            style={styles.person}
          >
                    <BuklodTappableAvatar
                      userId={person.user_id}
                      uri={person.avatar_url}
                      name={person.full_name}
                      size={42}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/connect/personal/[threadId]',
                          params: {
                            threadId: 'new',
                            targetUserId:
                              person.user_id,
                            otherUserName:
                              person.full_name ??
                              '',
                          },
                        } as any)
                      }
                    />

                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname:
                            '/connect/personal/[threadId]',
                          params: {
                            threadId: 'new',
                            targetUserId:
                              person.user_id,
                            otherUserName:
                              person.full_name ??
                              '',
                          },
                        } as any)
                      }
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.personName
                }
              >
                {person.full_name}
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                Open private messaging
              </Text>
            </Pressable>

            <MaterialCommunityIcons
              name="chevron-right"
              size={21}
              color={colors.muted}
            />
          </View>
        )
      )}

    </ScrollView>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
      paddingLeft: 0,
      marginLeft: 0,
      paddingStart: 0,
      marginStart: 0,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 22,
      backgroundColor:
        colors.background,
    },
    header: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingTop: 7,
      paddingBottom: 8,
      backgroundColor:
        colors.greenDark,
    },
    back: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor:
        'rgba(255,255,255,0.12)',
    },
    headerEyebrow: {
      color:
        'rgba(255,255,255,0.72)',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    headerTitle: {
      marginTop: 1,
      color: colors.white,
      fontSize: 18,
      fontWeight: '900',
    },
    tabs: {
      minHeight: 54,
      flexDirection: 'row',
      paddingHorizontal: 7,
      paddingVertical: 6,
      gap: 5,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      backgroundColor:
        colors.white,
    },
    tab: {
      flex: 1,
      minHeight: 41,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: 11,
    },
    tabOn: {
      backgroundColor:
        'rgba(39,93,69,0.09)',
    },
    tabText: {
      color: colors.muted,
      fontSize: 8.5,
      fontWeight: '900',
    },
    tabTextOn: {
      color:
        colors.greenDark,
    },
    content: {
      padding: 12,
      gap: 6,
      paddingLeft: 0,
      marginLeft: 0,
      paddingStart: 0,
      marginStart: 0,
    },
    hero: {
      padding: 17,
      borderRadius: 0,
      backgroundColor:
        colors.greenDark,
      paddingLeft: 0,
      marginLeft: 0,
      paddingStart: 0,
      marginStart: 0,
    },
    heroType: {
      color:
        'rgba(255,255,255,0.72)',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    heroTitle: {
      marginTop: 3,
      color: colors.white,
      fontSize: 23,
      fontWeight: '900',
    },
    heroText: {
      marginTop: 5,
      color:
        'rgba(255,255,255,0.82)',
      fontSize: 11,
      lineHeight: 17,
    },
    card: {
      padding: 13,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 0,
      backgroundColor:
        colors.white,
      paddingLeft: 0,
      marginLeft: 0,
      paddingStart: 0,
      marginStart: 0,
    },
    cardTitle: {
      color:
        colors.greenDark,
      fontSize: 14,
      fontWeight: '900',
    },
    bodyText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 19,
    },
    muted: {
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
    },
    infoRow: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      gap: 6,
    },
    infoLabel: {
      flex: 1,
      color: colors.muted,
      fontSize: 10,
    },
    infoValue: {
      flex: 1,
      textAlign: 'right',
      color: colors.text,
      fontSize: 9,
      fontWeight: '900',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    featureChip: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: 'hidden',
      color: colors.greenDark,
      backgroundColor:
        'rgba(39,93,69,0.08)',
      fontSize: 8,
      fontWeight: '900',
    },
    feedModeRow: {
      flexDirection: 'row',
      gap: 6,
    },
    feedModeButton: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 999,
      backgroundColor:
        colors.white,
    },
    feedModeButtonOn: {
      borderColor:
        colors.green,
      backgroundColor:
        'rgba(39,93,69,0.09)',
    },
    feedModeText: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '900',
    },
    feedModeTextOn: {
      color:
        colors.greenDark,
    },
    composer: {
      minHeight: 92,
      maxHeight: 180,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      color: colors.text,
      textAlignVertical: 'top',
    },
    search: {
      minHeight: 44,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 11,
      color: colors.text,
    },
    primary: {
      minHeight: 43,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor:
        colors.greenDark,
    },
    primaryText: {
      color: colors.white,
      fontSize: 10,
      fontWeight: '900',
    },
    disabled: {
      opacity: 0.45,
    },
    postAuthor: {
      color:
        colors.greenDark,
      fontSize: 12,
      fontWeight: '900',
    },
    postMeta: {
      color: colors.muted,
      fontSize: 8,
      fontWeight: '700',
    },
    person: {
      minHeight: 65,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      backgroundColor:
        colors.white,
    },
    avatar: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor:
        'rgba(39,93,69,0.10)',
    },
    avatarText: {
      color:
        colors.greenDark,
      fontSize: 16,
      fontWeight: '900',
    },
    personName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    title: {
      color:
        colors.greenDark,
      fontSize: 20,
      fontWeight: '900',
    },
  });

