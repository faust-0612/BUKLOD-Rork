import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import BuklodPublicDailyMessageBar from '@/components/BuklodPublicDailyMessageBar';
import ConnectRenderBoundary from '@/components/connect/ConnectRenderBoundary';
import {
  registerBuklodDesktopDockOpener,
  tryOpenBuklodDesktopDock,
  type BuklodDesktopDockRequest,
} from '@/lib/buklodDesktopContextDock';
import { buklodInstantReplace } from '@/lib/buklodInstantNavigation';
import { getOfflineCache } from '@/lib/offlineCache';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  readCachedConnectSuggestedContacts,
  loadConnectSuggestedContacts,
  type ConnectSuggestedContact,
} from '@/lib/buklodConnectSuggestedContacts';
import { normalizeBuklodPathname } from '@/lib/buklodSafeArea';
import { resolveBuklodDesktopRailWidths } from '@/lib/buklodWebResponsivePolicy';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const Contribution = React.lazy(() => import('@/components/BuklodCommunityContributionCard'));
const BuklodConnectThread = React.lazy(() => import('@/components/BuklodConnectThread'));
const BuklodDesktopMemberPreview = React.lazy(() => import('@/components/BuklodDesktopMemberPreview'));

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type RouteLink = { label: string; icon: IconName; path: string };
type RecentThread = {
  thread_id: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};
const LEFT_NAV: RouteLink[] = [
  { label: 'Home', icon: 'home-outline', path: '/hub' },
  { label: 'Cluster', icon: 'account-group-outline', path: '/clusters' },
  { label: 'Wall', icon: 'post-outline', path: '/buklod' },
  { label: 'Connect', icon: 'message-text-outline', path: '/messages' },
  { label: 'Profile', icon: 'account-circle-outline', path: '/me' },
  { label: 'Bible', icon: 'book-open-variant', path: '/bible/read' },
];

function isCurrent(path: string, target: string) {
  return path === target || path.startsWith(target + '/');
}

function safeThreads(value: unknown): RecentThread[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry: any): RecentThread[] => {
    const id = String(entry?.thread_id ?? '');
    const userId = String(entry?.other_user_id ?? '');
    if (!id || !userId || seen.has(id)) return [];
    seen.add(id);
    return [{
      thread_id: id,
      other_user_id: userId,
      other_user_name: String(entry?.other_user_name ?? 'BUKLOD member'),
      last_message: typeof entry?.last_message === 'string' ? entry.last_message : null,
      last_message_at: typeof entry?.last_message_at === 'string' ? entry.last_message_at : null,
      unread_count: Math.max(0, Number(entry?.unread_count ?? 0) || 0),
    }];
  }).sort((a, b) => {
    const aTime = Date.parse(a.last_message_at ?? '') || 0;
    const bTime = Date.parse(b.last_message_at ?? '') || 0;
    return bTime - aTime;
  }).slice(0, 8);
}
function formatChatTime(value: string | null) {
  if (!value) return '';
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : '';
}
function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'B';
}

/**
 * BUKLOD_PUBLIC_DESKTOP_DASHBOARD_R1
 * Desktop-only *presentation shell*; never duplicates the Wall/Connect
 * composers, membership permissions, call engine or contribution economics.
 * The reference mockup's sample numbers, contacts and revenue are NOT data.
 */
export default function BuklodPublicDesktopDashboard({
  children,
}: { children: React.ReactNode }) {
  const pathname = normalizeBuklodPathname(usePathname());
  const { width: viewportWidth } = useWindowDimensions();
  const railWidths = resolveBuklodDesktopRailWidths(viewportWidth);
  const { profile, session } = useAuth();
  const { activeScope, scopes, selectScope } = useBuklodScope();
  const { unreadCount: notificationsUnread } = useNotifications();
  const { theme } = useBuklodTheme();
  const userId = session?.user?.id ?? null;
  const [search, setSearch] = useState('');
  const [connectTab, setConnectTab] = useState<'chats' | 'calls' | 'contacts'>('chats');
  const [threads, setThreads] = useState<RecentThread[]>([]);
  const [contacts, setContacts] = useState<ConnectSuggestedContact[]>([]);
  const [connectStatus, setConnectStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [connectOwnerId, setConnectOwnerId] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState('');
  const [pendingSidebarNavigation, setPendingSidebarNavigation] = useState<{
    path: string; params?: Record<string, string>; ownerId: string | null; sequence: number;
  } | null>(null);
  const [dockRequest, setDockRequest] = useState<{
    userId: string; request: BuklodDesktopDockRequest;
  } | null>(null);
  const requestId = useRef(0);
  const sidebarNavigationSequence = useRef(0);

  // User-bound, in-memory only; closing the dock preserves the center route.
  useEffect(() => {
    if (!userId || !profile) return;
    return registerBuklodDesktopDockOpener(request => {
      setDockRequest({ userId, request });
    });
  }, [userId, Boolean(profile)]);

  // Navigation itself is an explicit user choice; never keep stale detail
  // controls mounted when the main workspace route changes.
  useEffect(() => {
    setDockRequest(null);
  }, [pathname]);

  const visibleDock = userId && dockRequest?.userId === userId
    ? dockRequest.request : null;

  const expandDock = () => {
    if (!visibleDock) return;
    setDockRequest(null);
    if (visibleDock.kind === 'profile') {
      router.push({
        pathname: '/member/[id]',
        params: {
          id: visibleDock.userId,
          name: visibleDock.displayName ?? '',
        },
      } as any);
    } else if (visibleDock.kind === 'direct') {
      router.push({
        pathname: '/connect/personal/[threadId]',
        params: {
          threadId: visibleDock.threadId,
          otherUserName: visibleDock.otherUserName ?? '',
          otherUserId: visibleDock.otherUserId ?? '',
          targetUserId: visibleDock.targetUserId ?? '',
        },
      } as any);
    } else {
      router.push({
        pathname: '/connect/community/[scopeId]',
        params: {
          scopeId: visibleDock.scopeId,
          scopeName: visibleDock.scopeName ?? '',
          scopeType: visibleDock.scopeType ?? '',
        },
      } as any);
    }
  };

  // DESKTOP_SIDEBAR_SCOPE_EXIT_R1
  // An active Cluster changes asynchronously. Routing immediately after
  // selectScope() lets the canonical guard see the OLD managed scope and
  // bounce global Home/Wall/Connect back to /scope. Only route after React
  // confirms the Public scope, without ever bypassing scope authorization.
  const commitSidebarNavigation = useCallback((
    path: string,
    params?: Record<string, string>,
  ) => {
    setDockRequest(null);
    const leavingScopedPage = pathname === '/scope' || pathname.startsWith('/scope/');
    if (params) {
      const href = { pathname: path as any, params } as any;
      if (leavingScopedPage) router.replace(href);
      else router.push(href);
    } else if (
      leavingScopedPage ||
      path === '/hub' || path === '/buklod' ||
      path === '/messages' || path === '/me'
    ) {
      buklodInstantReplace(path as any);
    } else {
      router.push(path as any);
    }
  }, [pathname]);

  useEffect(() => {
    if (!pendingSidebarNavigation) return;
    if (pendingSidebarNavigation.ownerId !== userId) {
      setPendingSidebarNavigation(null);
      return;
    }
    if (pendingSidebarNavigation.sequence !== sidebarNavigationSequence.current) return;
    if (activeScope?.scope_type !== 'PUBLIC') return;

    const target = pendingSidebarNavigation;
    setPendingSidebarNavigation(null);
    commitSidebarNavigation(target.path, target.params);
  }, [pendingSidebarNavigation, activeScope?.scope_type,
      activeScope?.scope_id, userId, commitSidebarNavigation]);

  const navigate = useCallback(async (path: string, params?: Record<string, string>) => {
    setNavigationError('');
    const sequence = ++sidebarNavigationSequence.current;
    const inManagedScope = activeScope?.scope_type === 'CLUSTER' ||
      activeScope?.scope_type === 'ORGANIZATION';

    if (!inManagedScope) {
      setPendingSidebarNavigation(null);
      commitSidebarNavigation(path, params);
      return;
    }

    const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');
    if (!publicScope) {
      setPendingSidebarNavigation(null);
      setNavigationError('Public workspace is not ready. Retry the navigation.');
      return;
    }

    // Queue the LATEST click; never render a global screen against Cluster data.
    setPendingSidebarNavigation({ path, params, ownerId: userId, sequence });
    try {
      await selectScope(publicScope.scope_id);
      // The effect above runs after activeScope PUBLIC is committed.
    } catch (error) {
      if (sidebarNavigationSequence.current === sequence) {
        setPendingSidebarNavigation(null);
        setNavigationError('Unable to leave Cluster. Retry the navigation.');
      }
    }
  }, [activeScope?.scope_type, scopes, selectScope, commitSidebarNavigation, userId]);

  const refreshConnect = useCallback(async () => {
    const sequence = ++requestId.current;
    setConnectOwnerId(userId);
    setThreads([]);
    setContacts([]);
    setConnectStatus('loading');
    if (!userId) return;
    const [cached, recentCached] = await Promise.all([
      getOfflineCache<{ personal: RecentThread[] }>('connect-hub:public', {
        userId, allowStale: true,
      }).catch(() => null),
      readCachedConnectSuggestedContacts(userId, 10).catch(() => [] as ConnectSuggestedContact[]),
    ]);
    if (sequence !== requestId.current) return;
    if (cached?.data?.personal) setThreads(safeThreads(cached.data.personal));
    if (recentCached.length) setContacts(recentCached);
    const [recent, suggested] = await Promise.all([
      withBuklodTimeout<any>(
        (supabase as any).rpc('buklod_connect_personal_threads'),
        6000,
        'Desktop Connect preview',
      ).catch(() => ({ error: true, data: null })),
      withBuklodTimeout(
        loadConnectSuggestedContacts(10),
        6000,
        'Desktop Connect contacts',
      ).catch(() => null),
    ]);
    if (sequence !== requestId.current) return;
    if (!recent?.error && Array.isArray(recent.data)) setThreads(safeThreads(recent.data));
    if (Array.isArray(suggested)) setContacts(suggested);
    setConnectStatus(recent?.error ? 'offline' : 'ready');
  }, [userId]);

  useEffect(() => {
    void refreshConnect();
    return () => { requestId.current += 1; };
  }, [refreshConnect]);

  const title = pathname === '/hub' ? 'Main Dashboard'
    : pathname === '/buklod' ? 'Community Wall'
    : pathname === '/messages' ? 'Connect'
    : pathname === '/me' ? 'My BUKLOD'
    : pathname.startsWith('/scope') ? 'Cluster / Organization Workspace'
    : pathname.startsWith('/points') ? 'BUKLOD Points'
    : pathname.startsWith('/personal-home') ? 'Personal Dashboard'
    : pathname.startsWith('/profile') ? 'Profile & Settings'
    : pathname.startsWith('/connect') ? 'Connect'
    : pathname.startsWith('/clusters') ? 'Clusters'
    : pathname.startsWith('/bible') ? 'My Bible'
    : 'BUKLOD Dashboard';
  // Account switch privacy: render no previous-user chat/contact data even
  // for the frame before useEffect clears asynchronous cached state.
  const visibleThreads = connectOwnerId === userId ? threads : [];
  const visibleContacts = connectOwnerId === userId ? contacts : [];
  const unreadChats = visibleThreads.reduce((sum, item) => sum + item.unread_count, 0);
  const bg = theme.canvas;
  const surface = theme.surface;
  const border = theme.border;
  const mainColor = theme.accent;
  const muted = theme.textMuted;
  const ink = theme.textPrimary;

  const iconButton = (label: string, icon: IconName, onPress: () => void, count = 0) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} style={({ pressed }) => [
        styles.roundButton, { backgroundColor: surface }, pressed && styles.pressed,
      ]}>
      <MaterialCommunityIcons name={icon} size={23} color={ink} />
      {count > 0 ? <View style={styles.bubble}><Text style={styles.bubbleText}>{Math.min(count, 99)}{count > 99 ? '+' : ''}</Text></View> : null}
    </Pressable>
  );

  // Never display account-scoped rail content on login/onboarding hydration.
  if (!userId || !profile) return <View style={styles.contentOnly}>{children}</View>;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.layoutFrame, { backgroundColor: bg }]}>
        <View style={[styles.header, { backgroundColor: surface, borderColor: border }]}>
          <Pressable onPress={() => void navigate('/hub')}
            accessibilityRole="button" accessibilityLabel="BUKLOD Home"
            style={styles.brand}>
            <Image source={require('../../assets/release/buklod-main-canonical.png')}
              resizeMode="contain" accessibilityLabel="BUKLOD canonical logo" style={styles.brandLogo} />
            {/* This approved PNG already contains the BUKLOD wordmark.
                Do not append a second, separate BUKLOD title. */}
          </Pressable>
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={[styles.pageTitle, { color: ink }]}>{title}</Text>
            <Text numberOfLines={1} style={[styles.pageSub, { color: muted }]}>Community · Faith · Connection · Service</Text>
          </View>
          <View style={[styles.searchArea, { backgroundColor: bg, borderColor: border }]}>
            <MaterialCommunityIcons name="magnify" color={muted} size={21} />
            <TextInput
              accessibilityLabel="Search people and conversations"
              placeholder="Search people and conversations"
              placeholderTextColor={muted}
              value={search} onChangeText={setSearch} returnKeyType="search"
              onSubmitEditing={() => {
                const query = search.trim();
                if (query) void navigate('/messages', { desktopSearch: query });
              }}
              style={[styles.searchInput, { color: ink }]}
            />
            {search.trim() ? <Pressable accessibilityRole="button" accessibilityLabel="Search"
              onPress={() => void navigate('/messages', { desktopSearch: search.trim() })}>
              <MaterialCommunityIcons name="arrow-right" color={mainColor} size={23} />
            </Pressable> : null}
          </View>
          <View style={styles.encouragementHeaderSlot}>
            <BuklodPublicDailyMessageBar forceVisible compact />
          </View>
          {iconButton('Notifications', 'bell-outline', () => void navigate('/notifications'), notificationsUnread)}
          <Pressable accessibilityRole="button" accessibilityLabel="Open my profile"
            onPress={() => void navigate('/me')} style={styles.profileButton}>
            {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> :
              <MaterialCommunityIcons name="account-circle" size={35} color={mainColor} />}
          </Pressable>
        </View>
        <View style={styles.columns}>
          <ScrollView style={[styles.leftRail, {
              backgroundColor: bg,
              width: railWidths.left, minWidth: railWidths.left,
              maxWidth: railWidths.left, flexBasis: railWidths.left,
            }]} contentContainerStyle={styles.railContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.navGroup}>
              {LEFT_NAV.map(item => {
                const selected = isCurrent(pathname, item.path) ||
                  (item.path === '/clusters' && pathname.startsWith('/scope')) ||
                  (item.path === '/me' && (
                    pathname.startsWith('/points') ||
                    pathname.startsWith('/profile') ||
                    pathname.startsWith('/personal-home')
                  )) ||
                  (item.path === '/messages' && pathname.startsWith('/connect/'));
                return (
                  <Pressable key={item.path} accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    onPress={() => void navigate(item.path)}
                    style={({ pressed }) => [
                      styles.navButton,
                      { backgroundColor: selected ? theme.accentSoft : surface,
                        borderColor: selected ? mainColor : border },
                      pressed && styles.pressed,
                    ]}>
                    <MaterialCommunityIcons name={item.icon} color={selected ? mainColor : ink} size={23} />
                    <Text style={[styles.navText, { color: selected ? mainColor : ink }]}>{item.label}</Text>
                    {item.path === '/messages' && unreadChats > 0 ?
                      <Text style={styles.navCount}>{Math.min(99, unreadChats)}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.sideCard, { backgroundColor: surface, borderColor: border }]}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="hand-heart-outline" size={22} color="#18915A" />
                <Text style={[styles.sectionTitle, { color: ink }]}>Contribution</Text>
              </View>
              <Suspense fallback={<ActivityIndicator color={mainColor} accessibilityLabel="Loading Contribution" />}>
                <Contribution key={userId} />
              </Suspense>
            </View>
            <View style={[styles.sideCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.sideHeading, { color: ink }]}>Sponsored</Text>
              <BuklodSponsorSlot placement="home" />
            </View>
          </ScrollView>

          <View style={[styles.center, { backgroundColor: surface, borderColor: border }]}>
            {navigationError ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss navigation message"
                onPress={() => setNavigationError('')} style={styles.errorRow}>
                <Text style={styles.errorText}>{navigationError}</Text>
              </Pressable>
            ) : null}
            {children}
          </View>

          <ScrollView style={[styles.rightRail, {
              backgroundColor: bg,
              width: railWidths.right, minWidth: railWidths.right,
              maxWidth: railWidths.right, flexBasis: railWidths.right,
            }]}
            contentContainerStyle={styles.railContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.sideCard, { backgroundColor: surface, borderColor: border }]}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="message-outline" size={23} color="#159F68" />
                <View style={styles.fill}>
                  <Text style={[styles.sectionTitle, { color: ink }]}>Connect Dashboard</Text>
                  <Text style={[styles.small, { color: muted }]}>Your messages and contacts</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Refresh Connect"
                  onPress={() => void refreshConnect()}>
                  <MaterialCommunityIcons name="refresh" size={22} color={mainColor} />
                </Pressable>
              </View>
              <View style={[styles.tabs, { borderColor: border }]}>
                {(['chats', 'calls', 'contacts'] as const).map(tab => (
                  <Pressable key={tab} accessibilityRole="button" accessibilityLabel={tab}
                    accessibilityState={{ selected: connectTab === tab }}
                    onPress={() => setConnectTab(tab)}
                    style={[styles.tabButton, { backgroundColor: connectTab === tab ? mainColor : bg }]}>
                    <Text style={[styles.tabText, { color: connectTab === tab ? '#FFFFFF' : ink }]}>
                      {tab === 'chats' ? 'Chats' : tab === 'calls' ? 'Calls' : 'Contacts'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {connectTab === 'chats' ? (
                <>
                  <View style={styles.sectionTitleRow}>
                    <Text style={[styles.sideHeading, { color: ink }]}>Recent Chats</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="View all chats"
                      onPress={() => void navigate('/messages')}>
                      <Text style={[styles.viewAll, { color: mainColor }]}>View All</Text>
                    </Pressable>
                  </View>
                  {visibleThreads.slice(0, 5).map(thread => (
                    <Pressable key={thread.thread_id} accessibilityRole="button"
                      accessibilityLabel={'Open chat with ' + thread.other_user_name}
                      onPress={() => {
                        if (!tryOpenBuklodDesktopDock({
                          kind: 'direct',
                          threadId: thread.thread_id,
                          otherUserId: thread.other_user_id,
                          otherUserName: thread.other_user_name,
                        })) {
                          void navigate('/connect/personal/' + encodeURIComponent(thread.thread_id));
                        }
                      }}
                      style={[styles.chatRow, { borderBottomColor: border }]}>
                      <View style={[styles.memberMark, { backgroundColor: theme.accentSoft }]}>
                        <Text style={[styles.memberInitials, { color: mainColor }]}>{initials(thread.other_user_name)}</Text>
                      </View>
                      <View style={styles.fill}>
                        <Text numberOfLines={1} style={[styles.chatName, { color: ink }]}>{thread.other_user_name}</Text>
                        <Text numberOfLines={1} style={[styles.small, { color: muted }]}>
                          {thread.last_message || 'Open conversation'}
                        </Text>
                      </View>
                      <View style={styles.timeCol}>
                        <Text style={[styles.tiny, { color: muted }]}>{formatChatTime(thread.last_message_at)}</Text>
                        {thread.unread_count > 0 ? (
                          <View style={styles.unread}><Text style={styles.unreadText}>{Math.min(thread.unread_count, 99)}</Text></View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                  {!visibleThreads.length ? (
                    <Text style={[styles.empty, { color: muted }]}>
                      {connectStatus === 'loading' ? 'Loading chats…'
                        : connectStatus === 'offline' ? 'Connect is offline. Open the inbox for cached messages.'
                        : 'No recent chats. Open Connect to start a conversation.'}
                    </Text>
                  ) : null}
                </>
              ) : connectTab === 'calls' ? (
                <View style={styles.callPanel}>
                  <MaterialCommunityIcons name="phone-in-talk-outline" color={mainColor} size={33} />
                  <Text style={[styles.callCopy, { color: ink }]}>Open a conversation to start a supported voice or video call.</Text>
                  <Pressable style={[styles.primaryAction, { backgroundColor: mainColor }]}
                    accessibilityRole="button" accessibilityLabel="Open calling conversations"
                    onPress={() => void navigate('/messages')}>
                    <Text style={styles.primaryText}>Open Connect</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={[styles.sideHeading, { color: ink }]}>Recent Contacts</Text>
                  {visibleContacts.slice(0, 7).map(person => (
                    <Pressable key={person.user_id} accessibilityRole="button"
                      accessibilityLabel={'Message ' + person.full_name}
                      onPress={() => {
                        if (!tryOpenBuklodDesktopDock({
                          kind: 'direct',
                          threadId: 'new',
                          targetUserId: person.user_id,
                          otherUserName: person.full_name,
                        })) {
                          void navigate('/connect/personal/new', {
                            targetUserId: person.user_id,
                            otherUserName: person.full_name,
                          });
                        }
                      }}
                      style={[styles.chatRow, { borderBottomColor: border }]}>
                      {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.smallAvatar} /> :
                        <View style={[styles.memberMark, { backgroundColor: theme.accentSoft }]}>
                          <Text style={[styles.memberInitials, { color: mainColor }]}>{initials(person.full_name)}</Text>
                        </View>}
                      <Text style={[styles.chatName, styles.fill, { color: ink }]} numberOfLines={1}>{person.full_name}</Text>
                      <MaterialCommunityIcons name="message-outline" size={18} color={mainColor} />
                    </Pressable>
                  ))}
                  {!visibleContacts.length ? <Text style={[styles.empty, { color: muted }]}>No contacts available yet.</Text> : null}
                </>
              )}
              <View style={styles.quickRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Open Connect inbox"
                  onPress={() => void navigate('/messages')}
                  style={[styles.quickButton, { backgroundColor: theme.accentSoft }]}>
                  <MaterialCommunityIcons name="message-text-outline" size={20} color={mainColor} />
                  <Text style={[styles.quickText, { color: ink }]}>Messages</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Start a call from Connect"
                  onPress={() => { setConnectTab('calls'); void navigate('/messages'); }}
                  style={[styles.quickButton, { backgroundColor: theme.accentSoft }]}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color={mainColor} />
                  <Text style={[styles.quickText, { color: ink }]}>Start Call</Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.sideCard, { backgroundColor: surface, borderColor: border }]}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="bell-outline" size={21} color={mainColor} />
                <Text style={[styles.sectionTitle, { color: ink }]}>Recent Activity</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Open notifications"
                onPress={() => void navigate('/notifications')} style={styles.actionLink}>
                <Text style={[styles.small, { color: ink }]}>
                  {notificationsUnread > 0
                    ? String(notificationsUnread) + ' unread notifications'
                    : 'Open Notification Center'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" color={mainColor} size={22} />
              </Pressable>
            </View>
            <View style={[styles.sideCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.sideHeading, { color: ink }]}>Sponsored</Text>
              <BuklodSponsorSlot placement="community" />
            </View>
          </ScrollView>

          {/* Contextual desktop dock: non-routing view over the right rail.
              Home/Wall and navigation remain mounted and interactive. */}
          {visibleDock ? (
            <View
              accessibilityLabel="Connect conversation side panel"
              style={[styles.contextDock, {
                backgroundColor: surface,
                borderColor: border,
              }]}
            >
              <View style={[styles.dockToolbar, { borderBottomColor: border }]}>
                <Text numberOfLines={1} style={[styles.dockTitle, { color: ink }]}>
                  {visibleDock.kind === 'direct'
                    ? (visibleDock.otherUserName || 'Personal Connect')
                    : visibleDock.kind === 'community'
                      ? (visibleDock.scopeName || 'Community Connect')
                      : (visibleDock.displayName || 'Member Profile')}
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={visibleDock.kind === 'profile'
                    ? 'Expand member profile' : 'Expand conversation to full screen'}
                  onPress={expandDock} style={styles.dockControl}>
                  <MaterialCommunityIcons name="arrow-expand" size={20} color={mainColor} />
                  <Text style={[styles.dockControlText, { color: mainColor }]}>Expand</Text>
                </Pressable>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={visibleDock.kind === 'profile'
                    ? 'Close member profile panel' : 'Close conversation panel'}
                  onPress={() => setDockRequest(null)} style={styles.dockControl}>
                  <MaterialCommunityIcons name="close" size={22} color={ink} />
                </Pressable>
              </View>
              <View style={styles.dockContent}>
                <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading details" color={mainColor} />}>
                {visibleDock.kind === 'profile' ? (
                  <BuklodDesktopMemberPreview
                    key={visibleDock.userId + ':' + userId}
                    userId={visibleDock.userId}
                    onMessage={() => {
                      const opened = tryOpenBuklodDesktopDock({
                        kind: 'direct', threadId: 'new',
                        targetUserId: visibleDock.userId,
                        otherUserName: visibleDock.displayName ?? '',
                      });
                      if (!opened) {
                        router.push({
                          pathname: '/connect/personal/[threadId]',
                          params: {
                            threadId: 'new',
                            targetUserId: visibleDock.userId,
                            otherUserName: visibleDock.displayName ?? '',
                          },
                        } as any);
                      }
                    }}
                  />
                ) : (
                  <ConnectRenderBoundary
                    key={(visibleDock.kind === 'direct' ? visibleDock.threadId : visibleDock.scopeId) + ':' + userId}
                    surface={visibleDock.kind === 'direct' ? 'personal_thread' : 'community_thread'}
                    onFallbackClose={() => setDockRequest(null)}
                  >
                    <BuklodConnectThread
                      key={(visibleDock.kind === 'direct' ? visibleDock.threadId : visibleDock.scopeId) + ':' + userId}
                      mode={visibleDock.kind === 'direct' ? 'direct' : 'scope'}
                      containerId={visibleDock.kind === 'direct'
                        ? (visibleDock.threadId === 'new' ? '' : visibleDock.threadId)
                        : visibleDock.scopeId}
                      pendingTargetUserId={visibleDock.kind === 'direct' && visibleDock.threadId === 'new'
                        ? visibleDock.targetUserId : undefined}
                      initialTitle={visibleDock.kind === 'direct'
                        ? visibleDock.otherUserName : visibleDock.scopeName}
                      initialSubtitle={visibleDock.kind === 'community' ? visibleDock.scopeType : undefined}
                      initialOtherUserId={visibleDock.kind === 'direct'
                        ? (visibleDock.otherUserId || visibleDock.targetUserId) : undefined}
                      onBackOverride={() => setDockRequest(null)}
                    />
                  </ConnectRenderBoundary>
                )}
                </Suspense>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, minHeight: 0 },
  contentOnly: { flex: 1, minWidth: 0, minHeight: 0 },
  layoutFrame: { flex: 1, width: '100%', maxWidth: 1590, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  header: { height: 80, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, marginBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', minWidth: 86 },
  brandLogo: { width: 66, height: 66, borderRadius: 12 },
  titleBlock: { flex: 1, minWidth: 100, maxWidth: 290 },
  pageTitle: { fontSize: 18, fontWeight: '900' },
  pageSub: { fontSize: 11, marginTop: 2 },
  searchArea: { flex: 1.4, minWidth: 180, maxWidth: 480, height: 40, borderWidth: 1, borderRadius: 24,
    paddingHorizontal: 12, alignItems: 'center', flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 12, paddingVertical: 5 },
  encouragementHeaderSlot: {
    flex: 1.15, minWidth: 165, maxWidth: 340, height: 52,
    justifyContent: 'center',
  },
  roundButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  bubble: { position: 'absolute', right: -5, top: -4, minWidth: 17, height: 17, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#D42C48', paddingHorizontal: 3 },
  bubbleText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  profileButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 35, height: 35, borderRadius: 19 },
  columns: { flex: 1, flexDirection: 'row', gap: 12, minWidth: 0, minHeight: 0, alignItems: 'stretch' },
  // ScrollView defaults are flex-growing on the web. Explicitly freeze both rails.
  leftRail: {
    flexGrow: 0, flexShrink: 0, minHeight: 0, borderRadius: 18,
    // The routed chat cannot place an invisible hit target over navigation.
    position: 'relative', zIndex: 1,
  },
  rightRail: { flexGrow: 0, flexShrink: 0, minHeight: 0, borderRadius: 18 },
  railContent: { gap: 10, paddingBottom: 20 },
  center: { flex: 1, flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 0, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  navGroup: { gap: 6 },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 47, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1 },
  navText: { fontSize: 14, fontWeight: '800', flex: 1 },
  navCount: { fontSize: 11, color: '#FFFFFF', backgroundColor: '#D42C48', borderRadius: 9,
    minWidth: 18, textAlign: 'center', overflow: 'hidden' },
  sideCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  sectionTitle: { fontSize: 14, fontWeight: '900' },
  sideHeading: { fontSize: 13, fontWeight: '900', flex: 1 },
  small: { fontSize: 11, lineHeight: 15 },
  tiny: { fontSize: 9 },
  fill: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden', padding: 2, gap: 2 },
  tabButton: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '900' },
  viewAll: { fontSize: 11, fontWeight: '900' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  memberMark: { width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  memberInitials: { fontSize: 11, fontWeight: '900' },
  smallAvatar: { width: 35, height: 35, borderRadius: 18 },
  chatName: { fontSize: 12, fontWeight: '800' },
  timeCol: { alignItems: 'flex-end', gap: 4 },
  unread: { backgroundColor: '#126AC0', borderRadius: 10, minWidth: 17, paddingHorizontal: 3,
    paddingVertical: 2, alignItems: 'center' },
  unreadText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  empty: { fontSize: 11, lineHeight: 17, paddingVertical: 13 },
  callPanel: { paddingVertical: 20, alignItems: 'center', gap: 12 },
  callCopy: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  primaryAction: { paddingVertical: 11, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  primaryText: { fontSize: 12, color: '#FFFFFF', fontWeight: '900' },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4 },
  quickText: { fontSize: 11, fontWeight: '800' },
  actionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Positioned relative to the columns; it never takes layout width from the Wall.
  contextDock: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 438, maxWidth: '100%', zIndex: 400,
    borderWidth: 1, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000000', shadowOffset: { width: -5, height: 4 },
    shadowRadius: 22, shadowOpacity: 0.15, elevation: 15,
  },
  dockToolbar: {
    minHeight: 50, flexShrink: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, borderBottomWidth: 1, gap: 7,
  },
  dockTitle: { fontWeight: '900', fontSize: 13, flex: 1, minWidth: 0 },
  dockControl: { minHeight: 40, minWidth: 40, paddingHorizontal: 5,
    flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  dockControlText: { fontWeight: '800', fontSize: 11 },
  dockContent: { flex: 1, minHeight: 0, minWidth: 0 },
  pressed: { opacity: 0.7 },
  errorRow: { padding: 8, backgroundColor: '#FFF0F0' },
  errorText: { color: '#932222', fontSize: 12 },
});
