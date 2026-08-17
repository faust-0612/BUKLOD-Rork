import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useStreamVideoClient,
} from '@/lib/streamVideoSdk';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { formatConnectTimestamp } from '@/lib/buklodConnect';

type PersonalThread = {
  thread_id: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};
type Person = { user_id: string; full_name: string; avatar_url: string | null };
type CommunityRoom = {
  scope_id: string;
  scope_type: 'LOCAL' | 'CLUSTER' | 'CHURCH' | 'ORGANIZATION';
  scope_name: string;
  geo_level: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

const n = (value: any) => Math.max(0, Number(value ?? 0) || 0);

/* PATCH_169C_REUSABLE_CONNECT */

type ConnectScreenProps = {
  forcedScopeId?: string;
  threadBase?:
    | '/connect'
    | '/mzb/connect';
};


/* PATCH_172A_RECENT_CONTACTS */

/* PATCH_180A_R6_MESSAGES_MOJIBAKE */
function repairBuklodPreviewText(
  value: string | null | undefined
) {
  const input =
    String(value ?? '');

  if (
    !/[\u00C2\u00C3\u00E2\u00F0\u00EF]/.test(
      input
    )
  ) {
    return input;
  }

  const cp1252:
    Record<number, number> = {
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

  const suspectCount =
    (text: string) =>
      (
        text.match(
          /[\u00C2\u00C3\u00E2\u00F0\u00EF]/g
        ) || []
      ).length;

  return input.replace(
    /[\x00-\xFF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]+/g,
    run => {
      if (
        !/[\u00C2\u00C3\u00E2\u00F0\u00EF]/.test(
          run
        )
      ) {
        return run;
      }

      const bytes: number[] = [];

      for (const char of run) {
        const code =
          char.codePointAt(0) ?? 0;

        if (code <= 0xFF) {
          bytes.push(code);
          continue;
        }

        const mapped =
          cp1252[code];

        if (
          typeof mapped !==
          'number'
        ) {
          return run;
        }

        bytes.push(mapped);
      }

      try {
        const encoded =
          bytes
            .map(
              byte =>
                '%' +
                byte
                  .toString(16)
                  .padStart(2, '0')
            )
            .join('');

        const decoded =
          decodeURIComponent(
            encoded
          );

        return (
          suspectCount(decoded) <
          suspectCount(run)
        )
          ? decoded
          : run;
      }
      catch {
        return run;
      }
    }
  );
}

function connectMessagePreview(
  value: string | null | undefined
) {
  const text =
    repairBuklodPreviewText(
      value
    );

  if (
    /^\[\[BUKLOD_AVATAR_REACTION:[a-z_]+\]\]$/
      .test(text.trim())
  ) {
    return 'Avatar reaction';
  }

  return text || 'No messages yet';
}
export default function ConnectScreen({
  forcedScopeId,
  threadBase = '/connect',
}: ConnectScreenProps = {}) {
  const { profile } = useAuth();
  const profileId = (profile as any)?.id as string | undefined;
  const [tab, setTab] = useState<'personal' | 'community'>('personal');
  const [personal, setPersonal] = useState<PersonalThread[]>([]);
  const [rooms, setRooms] = useState<CommunityRoom[]>([]);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;

    const [p, r] = await Promise.all([
      (supabase as any).rpc('buklod_connect_personal_threads'),
      (supabase as any).rpc('buklod_connect_community_rooms'),
    ]);

    if (!p.error) {
      setPersonal((p.data ?? []).map((x: any) => ({ ...x, unread_count: n(x.unread_count) })));
    }
    if (!r.error) {
      setRooms((r.data ?? []).map((x: any) => ({ ...x, unread_count: n(x.unread_count) })));
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void load();
    if (!profileId) return;
    const channelTopic =
      `connect-hub-messages-${profileId}-${forcedScopeId ?? 'public'}-${
        threadBase === '/mzb/connect' ? 'mzb' : 'public'
      }-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'buklod_connect_direct_messages' },
        () => void load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'buklod_connect_scope_messages' },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, profileId, forcedScopeId, threadBase]);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await (supabase as any).rpc('buklod_connect_people_search', {
        _query: clean,
        _limit: 20,
      });
      if (!cancelled && !result.error) setPeople(result.data ?? []);
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

  /* PATCH_171J_SEARCH_MEMBER_CALL */
  const videoClient =
    useStreamVideoClient();

  const [
    callingUserId,
    setCallingUserId,
  ] =
    useState<string | null>(null);

  const callPerson =
    async (
      userId: string
    ) => {
      if (
        !profileId ||
        callingUserId
      ) {
        return;
      }

      if (!videoClient) {
        Alert.alert(
          'Call',
          'Call service is still connecting. Please try again.'
        );
        return;
      }

      setCallingUserId(userId);

      try {
        const callId =
          `buklod-search-audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

        const call =
          videoClient.call(
            'default',
            callId
          );

        await call.getOrCreate({
          ring: true,
          video: false,

          data: {
            members: [
              {
                user_id:
                  profileId,
              },
              {
                user_id:
                  userId,
              },
            ],

            custom: {
              buklod_call_scope:
                'PERSONAL',

              buklod_call_mode:
                'audio',

              buklod_call_source:
                'SEARCH',
            },
          },
        });
      }
      catch (error: any) {
        console.warn(
          'BUKLOD search audio call:',
          error
        );

        Alert.alert(
          'Call unavailable',
          'The call could not be started. This person may be unavailable or there may be a connection problem.'
        );
      }
      finally {
        setCallingUserId(null);
      }
    };

  /* PATCH_171K_PERSONAL_ROW_CALL */
  const callPersonalRow =
    async (item: any) => {
      try {
        let targetUserId =
          String(
            item?.user_id ??
            item?.other_user_id ??
            ''
          ).trim();

        if (
          !targetUserId &&
          item?.thread_id
        ) {
          const details =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_direct_thread_details',
              {
                _thread_id:
                  item.thread_id,
              }
            );

          if (details.error) {
            throw details.error;
          }

          const d =
            Array.isArray(
              details.data
            )
              ? details.data[0]
              : details.data;

          targetUserId =
            String(
              d?.other_user_id ??
              ''
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
          targetUserId
        );
      }
      catch (error: any) {
        console.warn(
          'BUKLOD personal row:',
          error
        );

        Alert.alert(
          'Call unavailable',
          'Could not start the call.'
        );
      }
    };

  const openPerson = async (userId: string) => {
    const result = await (supabase as any).rpc(
      'buklod_connect_get_or_create_direct_thread',
      { _target_user_id: userId }
    );
    if (result.error) return;
    const raw = Array.isArray(result.data) ? result.data[0] : result.data;
    const threadId = typeof raw === 'string' ? raw : raw?.thread_id ?? raw?.id;
    if (!threadId) return;
    setQuery('');
    setPeople([]);
    router.push({
      pathname:
                            (
                              threadBase ===
                              '/mzb/connect'
                                ? '/mzb/connect/personal/[threadId]'
                                : '/connect/personal/[threadId]'
                            ) as any,
      params: { threadId },
    } as any);
  };

  const iconFor = (type: CommunityRoom['scope_type']) =>
    type === 'LOCAL'
      ? 'map-marker-radius-outline'
      : type === 'CHURCH'
      ? 'church'
      : type === 'ORGANIZATION'
      ? 'domain'
      : 'account-group-outline';
  /* PATCH_169C_VISIBLE_ROOMS */
  const visibleRooms =
    forcedScopeId
      ? rooms.filter(
          room =>
            room.scope_id ===
            forcedScopeId
        )
      : rooms;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, {
          /* UI_002_R4_R6_MESSAGES_EDGE */
          paddingHorizontal: 0,
          marginHorizontal: 0,
        }]}>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('personal')}
          style={[styles.tab, tab === 'personal' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'personal' && styles.tabTextOn]}>
            PERSONAL
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('community')}
          style={[styles.tab, tab === 'community' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'community' && styles.tabTextOn]}>
            COMMUNITY
          </Text>
        </Pressable>
      </View>

      {tab === 'personal' ? (
        <>
          {/* PATCH_172A_RECENT_CONTACTS */}
          {personal.length > 0 && (
            <View
              style={
                styles.quickContactsWrap
              }
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={
                  styles.quickContacts
                }
              >
                {personal
                  .slice(0, 12)
                  .map(contact => (
                    <Pressable
                      key={
                        contact.thread_id
                      }
                      onPress={() =>
                        router.push({
                          pathname:
                            (
                              typeof threadBase === 'string' &&
                              threadBase === '/mzb/connect'
                                ? '/mzb/connect/personal/[threadId]'
                                : '/connect/personal/[threadId]'
                            ) as any,
                          params: {
                            threadId:
                              contact.thread_id,
                          },
                        } as any)
                      }
                      style={
                        styles.quickContact
                      }
                    >
                      <ProfileAvatar
                        userId={
                          contact.other_user_id
                        }
                        name={
                          contact.other_user_name
                        }
                        size={48}
                      />

                      <Text
                        numberOfLines={1}
                        style={
                          styles.quickContactName
                        }
                      >
                        {
                          String(
                            contact.other_user_name ||
                            'Member'
                          )
                            .trim()
                            .split(/\s+/)[0]
                        }
                      </Text>

                      {Number(
                        contact.unread_count ||
                        0
                      ) > 0 && (
                        <View
                          style={
                            styles.quickContactUnread
                          }
                        >
                          <Text
                            style={
                              styles.quickContactUnreadText
                            }
                          >
                            {
                              Number(
                                contact.unread_count
                              ) > 9
                                ? '9+'
                                : Number(
                                    contact.unread_count
                                  )
                            }
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          )}
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="account-search-outline" size={21} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search BUKLOD users..."
              style={styles.search}
            />
          </View>
          <FlatList
            data={(query.trim().length >= 2 ? people : personal) as any[]}
            keyExtractor={(item: any) => item.thread_id ?? item.user_id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
            contentContainerStyle={[styles.list, {
          /* UI_002_R4_R6_MESSAGES_EDGE */
          paddingHorizontal: 0,
          marginHorizontal: 0,
        }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {query.trim().length >= 2 ? 'No user found' : 'No personal conversations yet'}
                </Text>
                <Text style={styles.emptyText}>
                  Search a BUKLOD user to start a personal conversation.
                </Text>
              </View>
            }
            renderItem={({ item }: any) => {
              const isPerson = Boolean(item.user_id) && !item.thread_id;
              const unread = isPerson ? 0 : n(item.unread_count);
              return (
                <Pressable
                  onPress={() =>
                    isPerson
                      ? void openPerson(item.user_id)
                      : router.push({
                          pathname:
                            (
                              threadBase ===
                              '/mzb/connect'
                                ? '/mzb/connect/personal/[threadId]'
                                : '/connect/personal/[threadId]'
                            ) as any,
                          params: { threadId: item.thread_id },
                        } as any)
                  }
                  style={styles.row}
                >
                  {/* PATCH_186D_R3_SINGLE_PERSONAL_ROW_AVATAR */}
                  {/* PATCH_185A_R5_SINGLE_PERSONAL_ROW_AVATAR */}
                  {isPerson ? (
                    <ProfileAvatar
                      userId={(item as Person).user_id}
                      name={(item as Person).full_name}
                      uri={(item as Person).avatar_url}
                      size={50}
                    />
                  ) : (
                    <ProfileAvatar
                      userId={(item as PersonalThread).other_user_id}
                      name={(item as PersonalThread).other_user_name}
                      size={50}
                    />
                  )}
<View style={styles.copy}>

                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {isPerson ? item.full_name : item.other_user_name}
                    </Text>
                    <Text numberOfLines={1} style={styles.rowSub}>
                      {isPerson ? 'Start personal conversation' : connectMessagePreview(item.last_message)}
                    </Text>
                    {!isPerson && item.last_message_at && (
                      <Text style={styles.time}>{formatConnectTimestamp(item.last_message_at)}</Text>
                    )}
                  </View>
                  {unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  )}

                  {/* PATCH_171K_ALL_PERSONAL_ACTIONS */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Pressable
                      accessibilityLabel="Open personal message"
                      hitSlop={6}
                      onPress={(event) => {
                        event.stopPropagation();

                        if (isPerson) {
                          void openPerson(
                            item.user_id
                          );
                          return;
                        }

                        router.push({
                          pathname:
                            (
                              threadBase ===
                              '/mzb/connect'
                                ? '/mzb/connect/personal/[threadId]'
                                : '/connect/personal/[threadId]'
                            ) as any,
                          params: {
                            threadId:
                              item.thread_id,
                          },
                        } as any);
                      }}
                      style={{
                        width: 35,
                        height: 35,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          colors.greenSoft,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="message-text-outline"
                        size={19}
                        color={colors.greenDark}
                      />
                    </Pressable>

                    <Pressable
                      accessibilityLabel="Audio call"
                      disabled={
                        callingUserId !==
                        null
                      }
                      hitSlop={6}
                      onPress={(event) => {
                        event.stopPropagation();

                        void callPersonalRow(
                          item
                        );
                      }}
                      style={{
                        width: 35,
                        height: 35,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          colors.greenSoft,
                        opacity:
                          callingUserId !==
                          null
                            ? 0.5
                            : 1,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={19}
                        color={colors.greenDark}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        </>
      ) : (
        <FlatList
          data={visibleRooms}
          keyExtractor={item => item.scope_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={[styles.list, {
          /* UI_002_R4_R6_MESSAGES_EDGE */
          paddingHorizontal: 0,
          marginHorizontal: 0,
        }]}
          ListHeaderComponent={
            <></>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No community rooms yet</Text>
              <></>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname:
                    (
                      threadBase ===
                      '/mzb/connect'
                        ? '/mzb/connect/community/[scopeId]'
                        : '/connect/community/[scopeId]'
                    ) as any,
                  params: { scopeId: item.scope_id },
                } as any)
              }
              style={styles.row}
            >
              <View style={styles.communityIcon}>
                <MaterialCommunityIcons
                  name={iconFor(item.scope_type) as any}
                  size={21}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{item.scope_name}</Text>
                <Text style={styles.roomType}>
                  {item.scope_type === 'LOCAL' ? 'BARANGAY' : item.scope_type}
                </Text>
                <Text numberOfLines={1} style={styles.rowSub}>
                  {connectMessagePreview(item.last_message)}
                </Text>
                {!!item.last_message_at && (
                  <Text style={styles.time}>{formatConnectTimestamp(item.last_message_at)}</Text>
                )}
              </View>
              {item.unread_count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unread_count > 99 ? '99+' : item.unread_count}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 6,
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#EAF1ED',
  },
  tab: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabOn: { backgroundColor: '#FFFFFF' },
  tabText: { color: colors.muted, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  tabTextOn: { color: colors.greenDark },
  quickContactsWrap: {
    minHeight: 72,
    marginBottom: 5,
  },
  quickContacts: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    gap: 6,
  },
  quickContact: {
    width: 58,
    alignItems: 'center',
    position: 'relative',
  },
  quickContactName: {
    width: 58,
    marginTop: 4,
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickContactUnread: {
    position: 'absolute',
    top: 1,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D92D20',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  quickContactUnreadText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  searchWrap: {
    minHeight: 47,
    marginHorizontal: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  search: { flex: 1, color: colors.text, fontSize: 13 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 43, height: 43, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft,
  },
  communityIcon: {
    width: 43, height: 43, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenDark,
  },
  copy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  rowSub: { marginTop: 3, color: colors.muted, fontSize: 10 },
  roomType: { marginTop: 2, color: colors.green, fontSize: 8, fontWeight: '900' },
  time: { marginTop: 3, color: colors.muted, fontSize: 8 },
  badge: {
    minWidth: 23, height: 23, paddingHorizontal: 6, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  help: {
    marginBottom: 9, padding: 10, borderRadius: 12,
    backgroundColor: '#EEF6F1', color: colors.greenDark, fontSize: 9, lineHeight: 14,
  },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 28 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: colors.muted, fontSize: 10, textAlign: 'center' },
});

