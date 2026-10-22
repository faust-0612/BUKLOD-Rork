import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  readOrganizationScopeId,
} from '@/lib/buklodOrganization';
import {
  fetchScopeMembers,
} from '@/lib/buklodScopeMembers';
import {
  orgMembersCacheKey,
  readOfflineCache,
  writeOfflineCache,
} from '@/lib/buklodOfflineSync';

type Action =
  | 'invite'
  | 'pending'
  | 'active'
  | 'status'
  | 'remove';

type SearchRow = {
  user_id: string;
  full_name: string;
  username: string | null;
  mobile: string | null;
  membership_status:
    | string
    | null;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  username: string | null;
  mobile: string | null;
  membership_status: string;
  roles: string[];
  joined_at: string | null;
  updated_at: string | null;
};

function normalizeAction(
  value: unknown,
): Action {
  const key =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (
    key === 'invite' ||
    key === 'pending' ||
    key === 'active' ||
    key === 'status' ||
    key === 'remove'
  ) {
    return key;
  }

  return 'active';
}

function titleFor(
  action: Action,
) {
  if (action === 'invite') {
    return 'Invite Member';
  }

  if (action === 'pending') {
    return 'Pending Invitations';
  }

  if (action === 'active') {
    return 'Active Members';
  }

  if (action === 'status') {
    return 'Membership Status';
  }

  return 'Remove or Suspend Member';
}

function statusColor(
  value: string | null,
) {
  const status =
    String(value ?? '')
      .toUpperCase();

  if (status === 'ACTIVE') {
    return '#166534';
  }

  if (
    status === 'INVITED' ||
    status === 'PENDING'
  ) {
    return '#92400E';
  }

  if (status === 'SUSPENDED') {
    return '#9A3412';
  }

  if (
    status === 'REMOVED' ||
    status === 'LEFT'
  ) {
    return '#991B1B';
  }

  return colors.muted;
}

export default function
OrganizationMembersScreen() {
  const params =
    useLocalSearchParams<{
      organization?:
        string | string[];
      action?:
        string | string[];
    }>();

  const scopeId = readOrganizationScopeId(
    params as Record<string, unknown>,
  );

  const rawAction =
    Array.isArray(
      params.action
    )
      ? params.action[0]
      : params.action;

  const action =
    normalizeAction(
      rawAction
    );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    busyId,
    setBusyId,
  ] = useState<
    string | null
  >(null);

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    searches,
    setSearches,
  ] = useState<SearchRow[]>(
    []
  );

  const [
    members,
    setMembers,
  ] = useState<MemberRow[]>(
    []
  );

  const loadMembers =
    useCallback(
      async () => {
        if (
          !scopeId ||
          action === 'invite'
        ) {
          return;
        }

        setLoading(true);

        const cacheKey =
          scopeId
            ? orgMembersCacheKey(
                scopeId,
                action,
              )
            : null;

        if (cacheKey) {
          const cached =
            await readOfflineCache<MemberRow[]>(
              cacheKey,
            );

          if (cached?.length) {
            setMembers(cached);
            setLoading(false);
          }
        }

        let status:
          | string
          | null = null;

        if (
          action ===
          'pending'
        ) {
          status =
            'INVITED';
        }

        if (
          action ===
          'active'
        ) {
          status =
            'ACTIVE';
        }

        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_org_list_members',
            {
              _scope_id:
                scopeId,
              _status:
                status,
            },
          );

        if (error) {
          const fallbackRows = await fetchScopeMembers({
            scopeId,
            status: status ?? 'ACTIVE',
            limit: 200,
            offset: 0,
          });

          let rows = fallbackRows.map(row => ({
            user_id: row.user_id,
            full_name: row.full_name,
            username: row.username,
            mobile: null,
            membership_status: row.membership_status,
            roles: row.is_admin ? ['ORG_ADMIN'] : [],
            joined_at: row.joined_at,
            updated_at: null,
          })) as MemberRow[];

          if (action === 'remove') {
            rows = rows.filter(row =>
              ['ACTIVE', 'SUSPENDED'].includes(
                String(row.membership_status).toUpperCase()
              )
            );
          }

          setMembers(rows);
          if (cacheKey) {
            void writeOfflineCache(cacheKey, rows, 'network');
          }
          setLoading(false);
          return;
        }

        let rows =
          (data ?? []) as
            MemberRow[];

        if (
          action ===
          'remove'
        ) {
          rows =
            rows.filter(
              row =>
                [
                  'ACTIVE',
                  'SUSPENDED',
                ].includes(
                  String(
                    row
                      .membership_status
                  ).toUpperCase()
                )
            );
        }

        setMembers(
          rows
        );
        if (cacheKey) {
          void writeOfflineCache(cacheKey, rows, 'network');
        }
        setLoading(false);
      },
      [
        action,
        scopeId,
      ],
    );

  useEffect(
    () => {
      void loadMembers();
    },
    [loadMembers],
  );

  /* PATCH_172J_R7_CURRENT_LIVE_SEARCH */
  const searchRequestIdRef =
    useRef(0);

  const searchUsers =
    async (
      rawValue?: string,
      silent = false,
    ) => {
      const value =
        (
          rawValue ??
          query
        ).trim();

      if (
        !scopeId ||
        action !== 'invite'
      ) {
        return;
      }

      if (value.length < 1) {
        searchRequestIdRef.current +=
          1;
        setSearches([]);
        setLoading(false);
        return;
      }

      const requestId =
        searchRequestIdRef.current +
        1;

      searchRequestIdRef.current =
        requestId;

      setLoading(true);

      const {
        data,
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'buklod_org_search_users',
          {
            _scope_id:
              scopeId,
            _query:
              value,
          },
        );

      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return;
      }

      setLoading(false);

      if (error) {
        setSearches([]);

        if (!silent) {
          Alert.alert(
            'Invite Member',
            error.message,
          );
        }

        return;
      }

      setSearches(
        (data ?? []) as
          SearchRow[]
      );
    };

  useEffect(
    () => {
      if (action !== 'invite') {
        return;
      }

      const value =
        query.trim();

      if (value.length < 1) {
        searchRequestIdRef.current +=
          1;
        setSearches([]);
        setLoading(false);
        return;
      }

      const timer =
        setTimeout(
          () => {
            void searchUsers(
              value,
              true,
            );
          },
          180,
        );

      return () =>
        clearTimeout(timer);
    },
    [
      action,
      query,
      scopeId,
    ],
  );
  const invite =
    async (
      row: SearchRow,
    ) => {
      setBusyId(
        row.user_id
      );

      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'buklod_org_invite_member',
          {
            _scope_id:
              scopeId,
            _user_id:
              row.user_id,
          },
        );

      setBusyId(null);

      if (error) {
        Alert.alert(
          'Invite Member',
          error.message,
        );

        return;
      }

      Alert.alert(
        'Invitation created',
        `${row.full_name} is now under Pending Invitations.`,
      );

      await searchUsers(query, true);
    };

  const applyStatus =
    async (
      row: MemberRow,
      status:
        | 'ACTIVE'
        | 'SUSPENDED'
        | 'REMOVED',
    ) => {
      setBusyId(
        row.user_id
      );

      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'buklod_org_set_membership_status',
          {
            _scope_id:
              scopeId,
            _user_id:
              row.user_id,
            _status:
              status,
          },
        );

      setBusyId(null);

      if (error) {
        Alert.alert(
          'Organization Membership',
          error.message,
        );

        return;
      }

      await loadMembers();
    };

  const confirmStatus =
    (
      row: MemberRow,
      status:
        | 'ACTIVE'
        | 'SUSPENDED'
        | 'REMOVED',
    ) => {
      const verb =
        status === 'ACTIVE'
          ? 'activate'
          : status ===
              'SUSPENDED'
          ? 'suspend'
          : 'remove';

      Alert.alert(
        'Organization Membership',
        `Do you want to ${verb} ${row.full_name}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text:
              status,
            style:
              status ===
              'REMOVED'
                ? 'destructive'
                : 'default',
            onPress:
              () =>
                void applyStatus(
                  row,
                  status,
                ),
          },
        ],
      );
    };

  const meta =
    (
      username:
        | string
        | null,
      mobile:
        | string
        | null,
    ) => {
      const parts =
        [
          username
            ? `@${username}`
            : null,
          mobile,
        ].filter(Boolean);

      return parts.length
        ? parts.join(' | ')
        : 'BUKLOD account';
    };

  if (!scopeId) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text
          style={
            styles.emptyTitle
          }
        >
          Organization not selected
        </Text>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.primary
          }
        >
          <Text
            style={
              styles.primaryText
            }
          >
            GO BACK
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <BuklodPortalScrollView
      style={
        styles.screen
      }
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() =>
          router.back()
        }
        style={
          styles.back
        }
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={20}
          color={
            colors.greenDark
          }
        />

        <Text
          style={
            styles.backText
          }
        >
          Organization Membership
        </Text>
      </Pressable>

      <View
        style={
          styles.hero
        }
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          ORGANIZATION ADMIN
        </Text>

        <Text
          style={
            styles.title
          }
        >
          {titleFor(action)}
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Manage membership for this organization.
        </Text>
      </View>

      {action ===
      'invite' ? (
        <>
          <View
            style={
              styles.searchRow
            }
          >
            <TextInput
              value={query}
              onChangeText={
                setQuery
              }
              onSubmitEditing={() =>
                void searchUsers(query)
              }
              placeholder="Name, username, mobile or email"
              placeholderTextColor="#8A948E"
              autoCapitalize="none"
              style={
                styles.input
              }
            />

            <Pressable
              onPress={() =>
                void searchUsers(query)
              }
              disabled={
                loading
              }
              style={
                styles.searchButton
              }
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <MaterialCommunityIcons
                  name="magnify"
                  size={22}
                  color="#FFFFFF"
                />
              )}
            </Pressable>
          </View>

          {searches.map(
            row => {
              const status =
                String(
                  row
                    .membership_status ??
                    ''
                ).toUpperCase();

              const blocked =
                [
                  'ACTIVE',
                  'INVITED',
                ].includes(
                  status
                );

              return (
                <View
                  key={
                    row.user_id
                  }
                  style={
                    styles.card
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.name
                      }
                    >
                      {row.full_name}
                    </Text>

                    <Text
                      style={
                        styles.meta
                      }
                    >
                      {meta(
                        row.username,
                        row.mobile,
                      )}
                    </Text>

                    {!!status && (
                      <Text
                        style={[
                          styles.status,
                          {
                            color:
                              statusColor(
                                status
                              ),
                          },
                        ]}
                      >
                        {status}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    disabled={
                      blocked ||
                      busyId ===
                        row.user_id
                    }
                    onPress={() =>
                      void invite(
                        row
                      )
                    }
                    style={[
                      styles.primarySmall,
                      blocked &&
                        styles.disabled,
                    ]}
                  >
                    {busyId ===
                    row.user_id ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={
                          styles.primarySmallText
                        }
                      >
                        {blocked
                          ? status
                          : 'INVITE'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            }
          )}
        </>
      ) : loading ? (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            color={
              colors.greenDark
            }
          />
        </View>
      ) : members.length ===
        0 ? (
        <View
          style={
            styles.empty
          }
        >
          <MaterialCommunityIcons
            name="account-search-outline"
            size={30}
            color={
              colors.muted
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            Nothing to show
          </Text>
        </View>
      ) : (
        members.map(
          row => {
            const status =
              String(
                row
                  .membership_status
              ).toUpperCase();

            const admin =
              (
                row.roles ??
                []
              ).includes(
                'ORG_ADMIN'
              );

            return (
              <View
                key={
                  row.user_id
                }
                style={
                  styles.card
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.name
                    }
                  >
                    {row.full_name}
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {meta(
                      row.username,
                      row.mobile,
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.status,
                      {
                        color:
                          statusColor(
                            status
                          ),
                      },
                    ]}
                  >
                    {status}
                    {admin
                      ? ' | ORG ADMIN'
                      : ''}
                  </Text>
                </View>

                {busyId ===
                row.user_id ? (
                  <ActivityIndicator
                    color={
                      colors.greenDark
                    }
                  />
                ) : action ===
                  'pending' ? (
                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      onPress={() =>
                        confirmStatus(
                          row,
                          'ACTIVE',
                        )
                      }
                      style={
                        styles.good
                      }
                    >
                      <Text
                        style={
                          styles.goodText
                        }
                      >
                        ACTIVATE
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        confirmStatus(
                          row,
                          'REMOVED',
                        )
                      }
                      style={
                        styles.danger
                      }
                    >
                      <Text
                        style={
                          styles.dangerText
                        }
                      >
                        CANCEL
                      </Text>
                    </Pressable>
                  </View>
                ) : action ===
                  'status' &&
                  !admin ? (
                  <View
                    style={
                      styles.actions
                    }
                  >
                    {status !==
                      'ACTIVE' && (
                      <Pressable
                        onPress={() =>
                          confirmStatus(
                            row,
                            'ACTIVE',
                          )
                        }
                        style={
                          styles.good
                        }
                      >
                        <Text
                          style={
                            styles.goodText
                          }
                        >
                          ACTIVE
                        </Text>
                      </Pressable>
                    )}

                    {status !==
                      'SUSPENDED' && (
                      <Pressable
                        onPress={() =>
                          confirmStatus(
                            row,
                            'SUSPENDED',
                          )
                        }
                        style={
                          styles.neutral
                        }
                      >
                        <Text
                          style={
                            styles.neutralText
                          }
                        >
                          SUSPEND
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : action ===
                  'remove' &&
                  !admin ? (
                  <View
                    style={
                      styles.actions
                    }
                  >
                    {status ===
                    'SUSPENDED' ? (
                      <Pressable
                        onPress={() =>
                          confirmStatus(
                            row,
                            'ACTIVE',
                          )
                        }
                        style={
                          styles.good
                        }
                      >
                        <Text
                          style={
                            styles.goodText
                          }
                        >
                          RESTORE
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() =>
                          confirmStatus(
                            row,
                            'SUSPENDED',
                          )
                        }
                        style={
                          styles.neutral
                        }
                      >
                        <Text
                          style={
                            styles.neutralText
                          }
                        >
                          SUSPEND
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() =>
                        confirmStatus(
                          row,
                          'REMOVED',
                        )
                      }
                      style={
                        styles.danger
                      }
                    >
                      <Text
                        style={
                          styles.dangerText
                        }
                      >
                        REMOVE
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }
        )
      )}
    </BuklodPortalScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    content: {
      padding: 16,
      paddingBottom: 16,
    },

    center: {
      flex: 1,
      justifyContent:
        'center',
      alignItems:
        'center',
      padding: 20,
      backgroundColor:
        colors.background,
    },

    back: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      marginBottom: 12,
    },

    backText: {
      fontSize: 11,
      fontWeight:
        '900',
      color:
        colors.greenDark,
    },

    hero: {
      padding: 17,
      borderRadius: 20,
      marginBottom: 14,
      backgroundColor:
        colors.greenDark,
    },

    eyebrow: {
      fontSize: 8.5,
      fontWeight:
        '900',
      letterSpacing: 0.8,
      color:
        'rgba(255,255,255,0.72)',
    },

    title: {
      marginTop: 5,
      fontSize: 22,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    subtitle: {
      marginTop: 6,
      fontSize: 10.5,
      color:
        'rgba(255,255,255,0.84)',
    },

    searchRow: {
      flexDirection:
        'row',
      gap: 8,
      marginBottom: 12,
    },

    input: {
      flex: 1,
      minHeight: 46,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 13,
      paddingHorizontal: 12,
      backgroundColor:
        '#FFFFFF',
      color:
        colors.text,
    },

    searchButton: {
      width: 46,
      height: 46,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    loading: {
      minHeight: 180,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    empty: {
      minHeight: 150,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 16,
      backgroundColor:
        '#FFFFFF',
    },

    emptyTitle: {
      marginTop: 7,
      fontSize: 12,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    card: {
      minHeight: 78,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 16,
      backgroundColor:
        '#FFFFFF',
    },

    name: {
      fontSize: 13,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    meta: {
      marginTop: 3,
      fontSize: 9.5,
      color:
        colors.muted,
    },

    status: {
      marginTop: 5,
      fontSize: 8.5,
      fontWeight:
        '900',
    },

    actions: {
      gap: 5,
    },

    primary: {
      marginTop: 14,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 11,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    primaryText: {
      color:
        '#FFFFFF',
      fontSize: 9,
      fontWeight:
        '900',
    },

    primarySmall: {
      minWidth: 74,
      minHeight: 34,
      paddingHorizontal: 9,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    primarySmallText: {
      fontSize: 8,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    good: {
      minWidth: 76,
      minHeight: 31,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#166534',
    },

    goodText: {
      fontSize: 8,
      fontWeight:
        '900',
      color:
        '#FFFFFF',
    },

    neutral: {
      minWidth: 76,
      minHeight: 31,
      borderWidth: 1,
      borderColor:
        '#D1D5DB',
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F3F4F6',
    },

    neutralText: {
      fontSize: 8,
      fontWeight:
        '900',
      color:
        '#374151',
    },

    danger: {
      minWidth: 76,
      minHeight: 31,
      borderWidth: 1,
      borderColor:
        '#FCA5A5',
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FEE2E2',
    },

    dangerText: {
      fontSize: 8,
      fontWeight:
        '900',
      color:
        '#991B1B',
    },

    disabled: {
      opacity: 0.45,
    },
  });