import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { tryOpenBuklodDesktopDock } from '@/lib/buklodDesktopContextDock';
import { ensureBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
import {
  buildBuklodPersonalCallId,
  formatBuklodCallStartError,
} from '@/lib/buklodStreamCall';
import {
  restoreActiveNonPttCallIfAny,
} from '@/lib/buklodActiveNonPttCall';
import { FLATLIST_TUNING } from '@/lib/performanceInstrumentation';
import { SCALE_LIMITS } from '@/lib/performanceScale';
import {
  useBuklodScrollBottomInset,
} from '@/lib/buklodSafeArea';
import { supabase } from '@/lib/supabase';
import {
  acquireSharedRealtimeSubscription,
} from '@/lib/performance';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  formatConnectTimestamp,
  connectAlbumInboxPreview,
} from '@/lib/buklodConnect';
import {
  connectSpacing,
  connectTypography,
  type CommunityFilterKey,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  ConnectThemeProvider,
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ChatBackgroundProvider,
} from '@/providers/ChatBackgroundProvider';
import {
  ConnectCommunityFilters,
} from '@/components/connect/ConnectCommunityFilters';
import {
  ConnectCommunityRow,
} from '@/components/connect/ConnectCommunityRow';
import {
  ConnectInboxRow,
} from '@/components/connect/ConnectInboxRow';
import {
  ConnectInboxSearch,
} from '@/components/connect/ConnectInboxSearch';
import {
  ConnectInboxTabs,
} from '@/components/connect/ConnectInboxTabs';
import {
  ConnectSuggestedContacts,
} from '@/components/connect/ConnectQuickContacts';
import {
  enrichConnectSuggestedContactsWithNotes,
  loadConnectSuggestedContacts,
  readCachedConnectSuggestedContacts,
  type ConnectSuggestedContact,
} from '@/lib/buklodConnectSuggestedContacts';
import {
  ConnectThemeSelectorButton,
} from '@/components/connect/ConnectThemeSelector';
import { ConnectPressable } from '@/components/connect/ConnectPressable';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';
import {
  ConnectThreadBackground,
} from '@/components/connect/ConnectThreadBackground';
import {
  BuklodFocusVisibleRow,
} from '@/components/HomeMotion';
import { HIBLA } from '@/lib/connectHibla';
import ConnectRenderBoundary from '@/components/connect/ConnectRenderBoundary';
import { partitionConnectInboxThreads } from '@/lib/connectInboxClassification';
import { communityUnreadTabCounts } from '@/lib/connectInboxBadgeTotals';
import { invalidateBuklodConnectUnreadCaches } from '@/lib/buklodR4RequestShield';

type PersonalThread = {
  thread_id: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};
type Person = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};
type CommunityRoom = {
  scope_id: string;
  scope_type: 'LOCAL' | 'CLUSTER' | 'CHURCH' | 'ORGANIZATION';
  scope_name: string;
  geo_level: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

const n = (value: any) =>
  Math.max(0, Number(value ?? 0) || 0);

type ConnectScreenProps = {
  forcedScopeId?: string;
};

function repairBuklodPreviewText(
  value: string | null | undefined
) {
  const input = String(value ?? '');

  if (
    !/[\u00C2\u00C3\u00E2\u00F0\u00EF]/.test(input)
  ) {
    return input;
  }

  const cp1252: Record<number, number> = {
    0x20AC: 0x80,
    0x201A: 0x82,
    0x0192: 0x83,
    0x201E: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02C6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8A,
    0x2039: 0x8B,
    0x0152: 0x8C,
    0x017D: 0x8E,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201C: 0x93,
    0x201D: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02DC: 0x98,
    0x2122: 0x99,
    0x0161: 0x9A,
    0x203A: 0x9B,
    0x0153: 0x9C,
    0x017E: 0x9E,
    0x0178: 0x9F,
  };

  const suspectCount = (text: string) =>
    (text.match(/[\u00C2\u00C3\u00E2\u00F0\u00EF]/g) || []).length;

  return input.replace(
    /[\x00-\xFF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]+/g,
    run => {
      if (!/[\u00C2\u00C3\u00E2\u00F0\u00EF]/.test(run)) {
        return run;
      }

      const bytes: number[] = [];

      for (const char of run) {
        const code = char.codePointAt(0) ?? 0;

        if (code <= 0xff) {
          bytes.push(code);
          continue;
        }

        const mapped = cp1252[code];

        if (typeof mapped !== 'number') {
          return run;
        }

        bytes.push(mapped);
      }

      try {
        const encoded = bytes
          .map(
            byte =>
              '%' + byte.toString(16).padStart(2, '0')
          )
          .join('');

        const decoded = decodeURIComponent(encoded);

        return suspectCount(decoded) < suspectCount(run)
          ? decoded
          : run;
      } catch {
        return run;
      }
    }
  );
}

function connectMessagePreview(
  value: string | null | undefined
) {
  const text = repairBuklodPreviewText(value);

  if (
    /^\[\[BUKLOD_AVATAR_REACTION:[a-z_]+\]\]$/.test(
      text.trim()
    )
  ) {
    return 'Avatar reaction';
  }

  const albumPreview = connectAlbumInboxPreview(text);
  if (albumPreview) {
    return albumPreview;
  }

  return text || 'No messages yet';
}

function formatInboxTime(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfMessage = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMessage.getTime()) /
      86400000
  );

  if (dayDiff === 0) {
    return date.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (dayDiff === 1) {
    return 'Yesterday';
  }

  if (dayDiff < 7) {
    return date.toLocaleDateString('en-PH', {
      weekday: 'short',
    });
  }

  return formatConnectTimestamp(value);
}

function iconFor(type: CommunityRoom['scope_type']) {
  return type === 'LOCAL' || type === 'CHURCH'
    ? 'map-marker-radius-outline'
    : type === 'ORGANIZATION'
      ? 'domain'
      : 'account-group-outline';
}

function matchesCommunityFilter(
  room: CommunityRoom,
  filter: CommunityFilterKey
) {
  if (filter === 'all') {
    return true;
  }

  const type = String(room.scope_type ?? '').toUpperCase();
  const geo = String(room.geo_level ?? '').toUpperCase();

  if (filter === 'organization') {
    return (
      type === 'ORGANIZATION' &&
      !geo.includes('SUB')
    );
  }

  if (filter === 'sub_org') {
    return (
      type === 'ORGANIZATION' &&
      geo.includes('SUB')
    );
  }

  if (filter === 'cluster') {
    return type === 'CLUSTER';
  }

  if (filter === 'location') {
    return type === 'CHURCH' || type === 'LOCAL';
  }

  return true;
}

function communitySectionLabel(
  filter: CommunityFilterKey
) {
  if (filter === 'all') {
    return null;
  }

  if (filter === 'sub_org') {
    return 'SUB-ORGANIZATION';
  }

  if (filter === 'location') {
    return 'LOCATION';
  }

  return filter.toUpperCase();
}

export default function ConnectScreen(
  props: ConnectScreenProps = {}
) {
  return (
    <ConnectThemeProvider>
      <ChatBackgroundProvider>
        <ConnectRenderBoundary surface="inbox">
          <ConnectScreenInner {...props} />
        </ConnectRenderBoundary>
      </ChatBackgroundProvider>
    </ConnectThemeProvider>
  );
}

function createInboxStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.canvas,
    },
    listContent: {
      paddingBottom: connectSpacing.sectionGap + 12,
    },
    communityListContent: {
      paddingBottom: connectSpacing.sectionGap + 8,
    },
    inboxHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: connectSpacing.screenHorizontal,
      paddingTop: 4,
      paddingBottom: 6,
    },
    hero: {
      marginBottom: 0,
      minHeight: 89,
      paddingTop: 7,
      paddingBottom: 8,
      paddingHorizontal: 14,
      backgroundColor: HIBLA.pine,
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
      overflow: 'hidden',
    },
    heroArc: {
      position: 'absolute',
      width: 170,
      height: 170,
      top: -48,
      right: -48,
      borderRadius: 85,
      borderWidth: 1,
      borderColor: 'rgba(237,201,120,0.55)',
    },
    heroEyebrow: {
      color: HIBLA.gold,
      fontSize: 10,
      letterSpacing: 2.1,
      fontWeight: '900',
    },
    heroTitle: {
      marginTop: 2,
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '900',
      lineHeight: 25,
      fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    },
    heroSubtitle: {
      color: '#DBF3E4',
      fontSize: 11,
      marginTop: 1,
    },
    heroCount: {
      alignSelf: 'flex-start',
      marginTop: 3,
      paddingHorizontal: 9,
      paddingVertical: 3,
      backgroundColor: '#E8F7ED',
      borderRadius: 14,
    },
    heroCountText: {
      color: HIBLA.pineDeep,
      fontSize: 11,
      fontWeight: '800',
    },
    searchDock: {
      marginTop: -12,
      marginHorizontal: 8,
      paddingTop: 4,
      paddingBottom: 5,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
    },
    contactsTitle: {
      color: HIBLA.pineDeep,
      fontSize: 17,
      fontWeight: '800',
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 8,
    },
    sectionTitle: {
      color: HIBLA.pineDeep,
      fontSize: 18,
      fontWeight: '900',
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 8,
    },
    priorityCard: {
      marginHorizontal: 10,
      marginBottom: 8,
      padding: 11,
      borderRadius: 20,
      backgroundColor: '#FFF2CD',
    },
    priorityLabel: {
      color: '#705015',
      fontWeight: '900',
      fontSize: 12,
      marginBottom: 6,
    },
    priorityName: {
      color: HIBLA.ink,
      fontSize: 15,
      fontWeight: '800',
    },
    priorityPreview: {
      color: HIBLA.muted,
      fontSize: 13,
      marginTop: 3,
    },
    sectionLabel: {
      ...connectTypography.sectionLabel,
      color: theme.textMuted,
      paddingHorizontal: connectSpacing.screenHorizontal,
      paddingTop: 4,
      paddingBottom: 6,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 28,
    },
    emptyTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyText: {
      marginTop: 6,
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}

function ConnectScreenInner({
  forcedScopeId,
}: ConnectScreenProps = {}) {
  const { theme } = useConnectTheme();
  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: 12,
    });
  const styles = useMemo(
    () => ({
      ...createInboxStyles(theme),
      listContent: {
        ...createInboxStyles(theme).listContent,
        paddingBottom: scrollBottomInset,
      },
      communityListContent: {
        ...createInboxStyles(theme).communityListContent,
        paddingBottom: scrollBottomInset,
      },
    }),
    [scrollBottomInset, theme]
  );
  const { profile } = useAuth();
  const desktopSearchParams = useLocalSearchParams<{ desktopSearch?: string }>();
  const { isConnected, isInternetReachable } = useNetwork();
  const connectOnline =
    isConnected && isInternetReachable !== false;
  const profileId = (profile as any)?.id as string | undefined;
  const [tab, setTab] =
    useState<'personal' | 'community' | 'requests'>(forcedScopeId ? 'community' : 'personal');
  const [personal, setPersonal] =
    useState<PersonalThread[]>([]);
  const [requestThreadIds, setRequestThreadIds] = useState<string[]>([]);
  const [rooms, setRooms] =
    useState<CommunityRoom[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const incoming = desktopSearchParams.desktopSearch;
    if (typeof incoming === 'string' && incoming.trim()) {
      setQuery(incoming.trim().slice(0, 100));
    }
  }, [desktopSearchParams.desktopSearch]);
  const [people, setPeople] =
    useState<Person[]>([]);
  const [suggestedContacts, setSuggestedContacts] =
    useState<ConnectSuggestedContact[]>([]);
  const [refreshing, setRefreshing] =
    useState(false);
  const [communityFilter, setCommunityFilter] =
    useState<CommunityFilterKey>('all');

  /* BUKLOD_OFFLINE_R2_CONNECT_HUB */
  const connectHubOfflineCacheKey =
    `connect-hub:${forcedScopeId ?? 'public'}`;
  const connectContext = `${profileId ?? ''}:${forcedScopeId ?? 'public'}`;
  const connectContextRef = useRef(connectContext);
  connectContextRef.current = connectContext;

  useEffect(() => {
    // Do not show the previous account or previous scoped room after a switch.
    setPersonal([]);
    setRequestThreadIds([]);
    setRooms([]);
    setSuggestedContacts([]);
  }, [connectContext]);

  useEffect(() => {
    if (!profileId) {
      return;
    }

    let active = true;

    void getOfflineCache<{
      personal: PersonalThread[];
      requestThreadIds?: string[];
      rooms: CommunityRoom[];
    }>(
      connectHubOfflineCacheKey,
      {
        userId: profileId,
        allowStale: true,
      }
    )
      .then(cached => {
        if (!active || !cached?.data) {
          return;
        }

        if (cached.data.personal?.length) {
          setPersonal(current =>
            current.length
              ? current
              : cached.data.personal
          );
        }

        if (cached.data.requestThreadIds?.length) {
          setRequestThreadIds(cached.data.requestThreadIds);
        }

        if (cached.data.rooms?.length) {
          setRooms(current =>
            current.length
              ? current
              : cached.data.rooms
          );
        }
      })
      .catch(() => undefined);

    // Suggestions and avatars have their own persistent user-scoped snapshot.
    // Render it without waiting for RPCs on every Connect <-> Wall navigation.
    void readCachedConnectSuggestedContacts(profileId, 40)
      .then(rows => {
        if (active && rows.length && connectContextRef.current ===
          `${profileId}:${forcedScopeId ?? 'public'}`) {
          setSuggestedContacts(current => current.length ? current : rows);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [
    connectHubOfflineCacheKey,
    profileId,
  ]);

  useEffect(() => {
    if (
      !profileId ||
      (
        personal.length === 0 &&
        rooms.length === 0
      )
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        void setOfflineCache(
          connectHubOfflineCacheKey,
          {
            personal,
            requestThreadIds,
            rooms,
          },
          {
            userId: profileId,
            ttlMs: 30 * 60 * 1000,
          }
        ).catch(
          () => undefined
        );
      }, 180);

    return () =>
      clearTimeout(timer);
  }, [
    connectHubOfflineCacheKey,
    personal,
    profileId,
    requestThreadIds,
    rooms,
  ]);
  const searchInputRef =
    useRef<TextInput | null>(null);

  const personalThreadPath =
    '/connect/personal/[threadId]';

  const communityThreadPath =
    '/connect/community/[scopeId]';

  const loadSequenceRef = useRef(0);
  // Focus changes within a warm inbox must not replay four network requests.
  // Realtime and periodic refreshes remain active independently.
  const lastInboxSyncRef = useRef<{ context: string; at: number }>({ context: '', at: 0 });
  const load = useCallback(async () => {
    if (!profileId) {
      return;
    }

    if (!connectOnline) {
      return;
    }

    // A slower previous refresh must never restore an already-read badge.
    const sequence = ++loadSequenceRef.current;
    const requestedContext = connectContext;
    const [p, r, suggested, requests] = await Promise.all([
      withBuklodTimeout<any>(
        (supabase as any).rpc(
          'buklod_connect_personal_threads'
        ),
        6000,
        'Connect threads'
      ).catch(() => ({ data: null, error: { message: 'offline' } })),
      withBuklodTimeout<any>(
        (supabase as any).rpc(
          'buklod_connect_community_rooms'
        ),
        6000,
        'Connect rooms'
      ).catch(() => ({ data: null, error: { message: 'offline' } })),
      withBuklodTimeout(
        loadConnectSuggestedContacts(40),
        6000,
        'Connect people'
      ).catch(() => [] as ConnectSuggestedContact[]),
      withBuklodTimeout<any>(
        (supabase as any).rpc('buklod_connect_message_requests_v1'),
        6000,
        'Connect message requests'
      ).catch(() => ({ data: null, error: { message: 'offline' } })),
    ]);

    if (connectContextRef.current !== requestedContext || sequence !== loadSequenceRef.current) return;

    let nextSuggested = suggested;

    if (!nextSuggested.length && !p.error && Array.isArray(p.data)) {
      const recentContacts = (p.data ?? [])
        .map((thread: any) => ({
          user_id: String(thread.other_user_id ?? ''),
          full_name: String(thread.other_user_name ?? 'BUKLOD Member'),
          avatar_url: thread.other_avatar_url
            ? String(thread.other_avatar_url)
            : null,
          shared_scope_label: 'Recent chat',
          rank_name: null,
          thread_id: thread.thread_id
            ? String(thread.thread_id)
            : null,
          unread_count: Number(thread.unread_count ?? 0),
          quick_note: null,
        }))
        .filter((row: ConnectSuggestedContact) => !!row.user_id);
      // Optional notes must never block the Connect inbox.
      nextSuggested = recentContacts;
      if (recentContacts.length) {
        nextSuggested = await withBuklodTimeout(
          enrichConnectSuggestedContactsWithNotes(recentContacts),
          2000,
          'Connect contact notes'
        ).catch(() => recentContacts);
      }
    }

    if (connectContextRef.current !== requestedContext || sequence !== loadSequenceRef.current) return;

    if (!p.error && !r.error) {
      lastInboxSyncRef.current = { context: requestedContext, at: Date.now() };
    }

    if (!p.error) {
      setPersonal(
        (p.data ?? []).map((x: any) => ({
          ...x,
          unread_count: n(x.unread_count),
        }))
      );
    }

    if (!requests.error && Array.isArray(requests.data)) {
      setRequestThreadIds(requests.data
        .map((row: any) => String(row.thread_id ?? '').trim())
        .filter(Boolean));
    }

    if (!r.error) {
      setRooms(
        (r.data ?? []).map((x: any) => ({
          ...x,
          unread_count: n(x.unread_count),
        }))
      );
    }

    // Retain previously loaded suggestions on transient empty responses.
    if (connectContextRef.current === requestedContext) {
      setSuggestedContacts(current => nextSuggested.length ? nextSuggested : current);
    }

  }, [profileId, connectOnline, connectContext]);

  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  /*
   * BUKLOD PERFORMANCE 001
   *
   * Do not listen to every Connect message in the platform.
   * The hub subscribes only to the signed-in user's known
   * personal threads and accessible scope rooms.
   *
   * A low-frequency refresh catches newly-created threads
   * without bringing back global Postgres Changes listeners.
   */

  const personalRealtimeKey =
    Array.from(
      new Set(
        personal
          .map(item =>
            String(
              item.thread_id ?? ''
            ).trim()
          )
          .filter(Boolean)
      )
    )
      .sort()
      .join(',');

  const scopeRealtimeKey =
    Array.from(
      new Set(
        (
          forcedScopeId
            ? [forcedScopeId]
            : rooms.map(
                item =>
                  item.scope_id
              )
        )
          .map(value =>
            String(
              value ?? ''
            ).trim()
          )
          .filter(Boolean)
      )
    )
      .sort()
      .join(',');

  // Reuse a warm authorized inbox during rapid tab changes. An actual
  // stale snapshot, first entry, reconnect, polling or realtime still syncs.
  useFocusEffect(useCallback(() => {
    if (!profileId || !connectOnline) return;
    const synced = lastInboxSyncRef.current;
    if (synced.context !== connectContext ||
        Date.now() - synced.at >= 15_000) {
      void loadRef.current();
    }
  }, [profileId, connectContext, connectOnline]));

  useEffect(() => {
    const pollTimer =
      setInterval(
        () => {
          void load();
        },
        SCALE_LIMITS.messagesInboxPollMs
      );

    return () => {
      clearInterval(
        pollTimer
      );
    };
  }, [load]);

  useEffect(() => {
    if (!profileId) {
      return;
    }

    const threadIds = personalRealtimeKey
      ? personalRealtimeKey.split(',')
      : [];
    const scopeIds = scopeRealtimeKey
      ? scopeRealtimeKey.split(',')
      : [];

    const chunks = (ids: string[], size = 100) => {
      const result: string[][] = [];
      for (let index = 0; index < ids.length; index += size) {
        result.push(ids.slice(index, index + size));
      }
      return result;
    };

    const releases: Array<() => void> = [];

    const registerSharedChannel = (
      kind: 'direct' | 'scope',
      ids: string[],
    ) => {
      if (!ids.length) return;

      const stableIds = [...ids].sort();
      const registryKey =
        `connect-hub:${kind}:${profileId}:${stableIds.join(',')}`;

      const release = acquireSharedRealtimeSubscription(
        registryKey,
        () => {
          // Realtime inserts must bypass the 10s inbox snapshot TTL.
          invalidateBuklodConnectUnreadCaches(kind);
          void loadRef.current();
        },
        emit => {
          const channelName =
            `connect-hub:${kind}:${profileId}:${stableIds.join('-')}`;
          let channel = supabase.channel(channelName);

          for (const idChunk of chunks(stableIds)) {
            channel = channel.on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table:
                  kind === 'direct'
                    ? 'buklod_connect_direct_messages'
                    : 'buklod_connect_scope_messages',
                filter:
                  kind === 'direct'
                    ? `thread_id=in.(${idChunk.join(',')})`
                    : `scope_id=in.(${idChunk.join(',')})`,
              },
              payload => emit(payload),
            );
          }

          const subscribed = channel.subscribe();
          return () => {
            void supabase.removeChannel(subscribed);
          };
        },
      );

      releases.push(release);
    };

    registerSharedChannel('direct', threadIds);
    registerSharedChannel('scope', scopeIds);

    return () => {
      for (const release of releases) {
        release();
      }
    };
  }, [
    profileId,
    personalRealtimeKey,
    scopeRealtimeKey,
  ]);

  useEffect(() => {
    const clean = query.trim();

    if (clean.length < 2) {
      setPeople([]);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      const result = await (supabase as any).rpc(
        'buklod_connect_people_search',
        {
          _query: clean,
          _limit: 20,
        }
      );

      if (!cancelled && !result.error) {
        setPeople(result.data ?? []);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const [callingUserId, setCallingUserId] =
    useState<string | null>(null);

  const callPerson = async (
    userId: string,
    threadId?: string | null
  ) => {
    if (!profileId || callingUserId) {
      return;
    }

    setCallingUserId(userId);

    try {
      const callClient = await ensureBuklodStreamVideoClient();

      if (
        restoreActiveNonPttCallIfAny(
          callClient.state.calls
        )
      ) {
        return;
      }

      /*
       * Every ringing attempt gets a fresh ID, including search calls
       * before a direct thread has been resolved.
       */
      const callId =
        buildBuklodPersonalCallId(
          threadId || userId
        );

      const call = callClient.call('default', callId);

      await call.getOrCreate({
        ring: true,
        video: false,
        data: {
          members: [
            { user_id: profileId },
            { user_id: userId },
          ],
          custom: {
            buklod_call_scope: 'PERSONAL',
            buklod_call_mode: 'audio',
            buklod_call_source: 'SEARCH',
            buklod_thread_id: threadId ?? null,
          },
        },
      });
    } catch (error: any) {
      console.warn('BUKLOD search audio call:', error);

      Alert.alert(
        'Call unavailable',
        formatBuklodCallStartError(
          error
        )
      );
    } finally {
      setCallingUserId(null);
    }
  };

  const callPersonalRow = async (item: any) => {
    try {
      let targetUserId = String(
        item?.user_id ?? item?.other_user_id ?? ''
      ).trim();

      if (!targetUserId && item?.thread_id) {
        const details = await (supabase as any).rpc(
          'buklod_connect_direct_thread_details',
          { _thread_id: item.thread_id }
        );

        if (details.error) {
          throw details.error;
        }

        const d = Array.isArray(details.data)
          ? details.data[0]
          : details.data;

        targetUserId = String(
          d?.other_user_id ?? ''
        ).trim();
      }

      if (!targetUserId) {
        Alert.alert(
          'Call unavailable',
          'This member could not be identified.'
        );
        return;
      }

      await callPerson(
        targetUserId,
        item?.thread_id
      );
    } catch (error: any) {
      console.warn('BUKLOD personal row:', error);

      Alert.alert(
        'Call unavailable',
        'Could not start the call.'
      );
    }
  };

  const openPerson = (
    userId: string,
    fullName?: string
  ) => {
    setQuery('');
    setPeople([]);

    if (tryOpenBuklodDesktopDock({
      kind: 'direct', threadId: 'new',
      targetUserId: userId, otherUserName: fullName ?? '',
    })) return;

    router.push({
      pathname: personalThreadPath as any,
      params: {
        threadId: 'new',
        targetUserId: userId,
        otherUserName: fullName ?? '',
      },
    } as any);
  };

  const openSuggestedContact = (
    contact: ConnectSuggestedContact
  ) => {
    if (contact.thread_id) {
      openPersonalThread(contact.thread_id, {
        thread_id: contact.thread_id,
        other_user_id: contact.user_id,
        other_user_name: contact.full_name,
        last_message: null,
        last_message_at: null,
        unread_count: contact.unread_count,
      });
      return;
    }

    openPerson(contact.user_id, contact.full_name);
  };

  const openPersonalThread = (
    threadId: string,
    item?: PersonalThread
  ) => {
    if (tryOpenBuklodDesktopDock({
      kind: 'direct', threadId,
      otherUserName: item?.other_user_name ?? '',
      otherUserId: item?.other_user_id ?? '',
    })) return;

    router.push({
      pathname: personalThreadPath as any,
      params: {
        threadId,
        otherUserName: item?.other_user_name ?? '',
        otherUserId: item?.other_user_id ?? '',
      },
    } as any);
  };

  const openCommunityRoom = (
    scopeId: string,
    item?: CommunityRoom
  ) => {
    if (tryOpenBuklodDesktopDock({
      kind: 'community', scopeId,
      scopeName: item?.scope_name ?? '',
      scopeType: item?.scope_type ?? '',
    })) return;

    router.push({
      pathname: communityThreadPath as any,
      params: {
        scopeId,
        scopeName: item?.scope_name ?? '',
        scopeType: item?.scope_type ?? '',
      },
    } as any);
  };

  const visibleRooms = forcedScopeId
    ? rooms.filter(room => room.scope_id === forcedScopeId)
    : rooms;

  const filteredRooms = visibleRooms.filter(room =>
    matchesCommunityFilter(room, communityFilter)
  );

  const isSearching = query.trim().length >= 2;
  const { requests: requestThreads, personal: regularThreads } =
    partitionConnectInboxThreads(personal, requestThreadIds);
  const priorityThread = tab === 'personal' && !isSearching
    ? regularThreads.find(item => n(item.unread_count) > 0) ?? null
    : null;
  const personalListData = (
    isSearching
      ? people
      : tab === 'requests'
        ? requestThreads
        : regularThreads.filter(item => item.thread_id !== priorityThread?.thread_id)
  ) as any[];

  const { cluster: clusterUnread, org: orgUnread } =
    communityUnreadTabCounts(rooms);

  const sectionLabel =
    communitySectionLabel(communityFilter);
  const unreadTotal = tab === 'requests'
    ? requestThreads.reduce((total, item) => total + n(item.unread_count), 0)
    : tab === 'personal'
      ? regularThreads.reduce((total, item) => total + n(item.unread_count), 0)
      : visibleRooms.reduce((total, item) => total + n(item.unread_count), 0);

  const renderHiblaHeader = (community: boolean) => (
    <>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroArc} />
        <Text style={styles.heroEyebrow}>BUKLOD • CONNECT</Text>
        <Text style={styles.heroTitle}>Mga Ugnayan</Text>
        <Text style={styles.heroSubtitle}>Mas malapit ang bawat isa.</Text>
        <View style={styles.heroCount}>
          <Text style={styles.heroCountText}>
            {unreadTotal > 0
              ? `${unreadTotal > 99 ? '99+' : unreadTotal} bagong mensahe`
              : 'Walang bagong mensahe'}
          </Text>
        </View>
      </View>
      <View style={styles.searchDock}>
        <View style={styles.inboxHeader}>
          <ConnectInboxSearch
            inline
            inputRef={searchInputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={isSearching ? 'Hanapin ang miyembro…' : 'Hanapin ang usapan'}
          />
          <ConnectThemeSelectorButton />
        </View>
      </View>
      {tab === 'personal' && !community && !isSearching && (
        <>
          <Text style={styles.contactsTitle}>Mga kasama</Text>
          <ConnectSuggestedContacts
            currentUser={profileId ? {
              user_id: profileId,
              full_name: String((profile as any)?.full_name ?? 'You'),
              avatar_url: (profile as any)?.avatar_url ?? null,
            } : null}
            contacts={suggestedContacts}
            onOpenContact={openSuggestedContact}
            onStatusNoteSaved={() => void loadRef.current()}
          />
        </>
      )}
      {!isSearching ? (
        <BuklodFirstViewAd
          placement="messages"
          placementId={community ? 'connect_community_first_view' : 'connect_personal_first_view'}
        />
      ) : null}
      <ConnectInboxTabs
        tab={tab}
        requestCount={requestThreads.length}
        personalUnread={regularThreads.reduce((total, item) => total + n(item.unread_count), 0)}
        clusterUnread={clusterUnread}
        orgUnread={orgUnread}
        communityFilter={communityFilter}
        onTabChange={setTab}
        onCommunityFilterChange={setCommunityFilter}
      />
      {community && !forcedScopeId && (
        <ConnectCommunityFilters active={communityFilter} onChange={setCommunityFilter} />
      )}
      {community && !!sectionLabel && (
        <Text style={styles.sectionLabel}>{sectionLabel}</Text>
      )}
      {tab === 'requests' && !isSearching && (
        <Text style={styles.sectionLabel}>
          Mga unang mensahe mula sa hindi mo pa nakakausap. Kapag sumagot ka, lilipat sa Personal.
        </Text>
      )}
      {!community && priorityThread && (
        <ConnectPressable
          accessibilityLabel={`Open priority conversation with ${priorityThread.other_user_name}`}
          onPress={() => openPersonalThread(priorityThread.thread_id, priorityThread)}
          style={styles.priorityCard}
        >
          <Text style={styles.priorityLabel}>⚑ Unahin</Text>
          <Text numberOfLines={1} style={styles.priorityName}>{priorityThread.other_user_name}</Text>
          <Text numberOfLines={1} style={styles.priorityPreview}>
            {connectMessagePreview(priorityThread.last_message)}
          </Text>
        </ConnectPressable>
      )}
      <Text style={styles.sectionTitle}>
        {community ? 'Mga grupong usapan' : isSearching ? 'Mga resulta' : tab === 'requests' ? 'Message Requests' : 'Mga usapan'}
      </Text>
    </>
  );


  // Preserve the same VirtualizedList across tab taps. Its header contains
  // the appearance modal and SDK ads; replacing the list destroys them mid-press.
  return (
    <ConnectThreadBackground style={styles.screen}>
      <View style={styles.body}>
        <FlatList
          ListHeaderComponent={renderHiblaHeader(tab === 'community')}
          data={tab === 'community' ? filteredRooms : personalListData}
          keyExtractor={(item: any) =>
            String(tab === 'community' ? item.scope_id : (item.thread_id ?? item.user_id))
          }
          initialNumToRender={FLATLIST_TUNING.inbox.initialNumToRender}
          maxToRenderPerBatch={FLATLIST_TUNING.inbox.maxToRenderPerBatch}
          updateCellsBatchingPeriod={FLATLIST_TUNING.inbox.updateCellsBatchingPeriod}
          windowSize={FLATLIST_TUNING.inbox.windowSize}
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={theme.accent}
            />
          }
          contentContainerStyle={tab === 'community' ? styles.communityListContent : styles.listContent}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={tab === 'personal' && priorityThread && !isSearching ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {tab === 'community'
                  ? 'No community rooms yet'
                  : isSearching ? 'No user found'
                    : tab === 'requests' ? 'Walang message requests'
                      : 'No personal conversations yet'}
              </Text>
              {tab !== 'community' ? (
                <Text style={styles.emptyText}>
                  {tab === 'requests'
                    ? 'Dito lang lalabas ang unang mensahe ng taong wala ka pang dating usapan.'
                    : 'Search a BUKLOD user to start a personal conversation.'}
                </Text>
              ) : null}
            </View>
          )}
          renderItem={({ item, index }: any) => {
            if (tab === 'community') {
              return (
                <>
                <BuklodFocusVisibleRow index={index}>
                  <ConnectCommunityRow
                    scopeId={item.scope_id}
                    scopeName={item.scope_name}
                    scopeType={item.scope_type}
                    preview={connectMessagePreview(item.last_message)}
                    timeLabel={formatInboxTime(item.last_message_at)}
                    unreadCount={item.unread_count}
                    iconName={iconFor(item.scope_type)}
                    onPressRow={() => openCommunityRoom(item.scope_id, item)}
                  />
                </BuklodFocusVisibleRow>
                {index === 3 && !isSearching ? (
                  <BuklodNativeSponsoredCard surface="connect" slotId="connect_community_inline_4" />
                ) : null}
                </>
              );
            }
            const isPerson = Boolean(item.user_id) && !item.thread_id;
            const unread = isPerson ? 0 : n(item.unread_count);
            return (
              <>
              <BuklodFocusVisibleRow index={index}>
                <ConnectInboxRow
                  userId={isPerson ? item.user_id : item.other_user_id}
                  name={isPerson ? item.full_name : item.other_user_name}
                  avatarUri={isPerson ? item.avatar_url : null}
                  preview={isPerson ? 'Start personal conversation' : connectMessagePreview(item.last_message)}
                  timeLabel={!isPerson ? formatInboxTime(item.last_message_at) : undefined}
                  unreadCount={unread}
                  isSearchResult={isPerson}
                  showSentIndicator={!isPerson && unread === 0 && !!item.last_message_at}
                  onPressRow={() => isPerson
                    ? openPerson(item.user_id, item.full_name)
                    : openPersonalThread(item.thread_id, item)}
                />
              </BuklodFocusVisibleRow>
              {index === 3 && !isSearching ? (
                <BuklodNativeSponsoredCard surface="connect" slotId="connect_personal_inline_4" />
              ) : null}
              </>
            );
          }}
        />
      </View>
    </ConnectThreadBackground>
  );
}
