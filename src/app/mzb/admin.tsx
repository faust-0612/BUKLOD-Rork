import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MzbCandidate,
  MzbMember,
  MzbRole,
  getMzbMembers,
  getMzbRoleCatalog,
  inviteMzbMember,
  removeMzbMember,
  searchMzbCandidates,
  setMzbRole,
} from '@/lib/buklodMzb';

function messageOf(
  error: unknown
) {
  if (
    error &&
    typeof error ===
      'object' &&
    'message' in error
  ) {
    return String(
      (error as {
        message?: unknown;
      }).message ||
        'Unknown error'
    );
  }

  return String(
    error ||
      'Unknown error'
  );
}

function SmallButton({
  title,
  onPress,
  active,
  danger,
  disabled,
}: {
  title: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.smallButton,
        active &&
          styles.smallActive,
        danger &&
          styles.smallDanger,
        disabled &&
          styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.smallText,
          active &&
            styles.smallActiveText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function MzbAdminScreen() {
  const [members, setMembers] =
    useState<MzbMember[]>(
      []
    );

  const [roles, setRoles] =
    useState<MzbRole[]>([]);

  const [
    candidates,
    setCandidates,
  ] = useState<
    MzbCandidate[]
  >([]);

  const [query, setQuery] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [busyKey, setBusyKey] =
    useState<string | null>(
      null
    );

  const load = useCallback(
    async (
      refresh = false
    ) => {
      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        const [
          memberRows,
          roleRows,
        ] = await Promise.all([
          getMzbMembers(),
          getMzbRoleCatalog(),
        ]);

        setMembers(
          memberRows
        );

        setRoles(
          roleRows
        );
      } catch (error) {
        Alert.alert(
          'MZB Admin',
          messageOf(error)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function run(
    key: string,
    work: () => Promise<void>
  ) {
    if (busyKey) {
      return;
    }

    setBusyKey(key);

    try {
      await work();
      await load(true);
    } catch (error) {
      Alert.alert(
        'MZB Admin',
        messageOf(error)
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function searchPeople() {
    try {
      setCandidates(
        await searchMzbCandidates(
          query
        )
      );
    } catch (error) {
      Alert.alert(
        'MZB Member Search',
        messageOf(error)
      );
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void load(true)
          }
        />
      }
    >
      <View
        style={styles.hero}
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          MZB ORGANIZATION
        </Text>

        <Text
          style={styles.title}
        >
          MZB Admin
        </Text>

        <Text
          style={styles.muted}
        >
          Manage official MZB
          Organization membership and
          ministry roles without changing
          the user's other BUKLOD scopes.
        </Text>
      </View>


      {loading ? (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            size="large"
          />
        </View>
      ) : (
        <>
          <Text
            style={
              styles.section
            }
          >
            INVITE MEMBER
          </Text>

          <View
            style={styles.card}
          >
            <View
              style={
                styles.searchRow
              }
            >
              <TextInput
                style={
                  styles.search
                }
                value={query}
                onChangeText={
                  setQuery
                }
                placeholder="Search BUKLOD member..."
                returnKeyType="search"
                onSubmitEditing={() =>
                  void searchPeople()
                }
              />

              <SmallButton
                title="SEARCH"
                onPress={() =>
                  void searchPeople()
                }
              />
            </View>

            {candidates.map(
              (candidate) => (
                <View
                  key={
                    candidate.user_id
                  }
                  style={
                    styles.person
                  }
                >
                  <Text
                    style={[
                      styles.personName,
                      {
                        flex: 1,
                      },
                    ]}
                  >
                    {
                      candidate.full_name
                    }
                  </Text>

                  <SmallButton
                    title="INVITE"
                    disabled={
                      busyKey != null
                    }
                    onPress={() =>
                      void run(
                        `invite:${candidate.user_id}`,
                        async () => {
                          await inviteMzbMember(
                            candidate.user_id
                          );

                          setCandidates(
                            (
                              current
                            ) =>
                              current.filter(
                                (
                                  item
                                ) =>
                                  item.user_id !==
                                  candidate.user_id
                              )
                          );
                        }
                      )
                    }
                  />
                </View>
              )
            )}
          </View>


          <Text
            style={
              styles.section
            }
          >
            MEMBERS & ROLES
          </Text>

          {members.map(
            (member) => (
              <View
                key={
                  member.user_id
                }
                style={
                  styles.memberCard
                }
              >
                <View
                  style={
                    styles.memberHeader
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.personName
                      }
                    >
                      {
                        member.full_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.mutedSmall
                      }
                    >
                      {
                        member.membership_status
                      }
                    </Text>
                  </View>

                  {member.membership_status ===
                    'ACTIVE' && (
                    <SmallButton
                      title="REMOVE"
                      danger
                      disabled={
                        busyKey !=
                        null
                      }
                      onPress={() =>
                        Alert.alert(
                          'Remove MZB Member',
                          `Remove ${member.full_name} from MZB Ministry?`,
                          [
                            {
                              text:
                                'Cancel',
                              style:
                                'cancel',
                            },
                            {
                              text:
                                'Remove',
                              style:
                                'destructive',
                              onPress:
                                () =>
                                  void run(
                                    `remove:${member.user_id}`,
                                    async () => {
                                      await removeMzbMember(
                                        member.user_id
                                      );
                                    }
                                  ),
                            },
                          ]
                        )
                      }
                    />
                  )}
                </View>


                {member.membership_status ===
                  'ACTIVE' && (
                  <>
                    <Text
                      style={
                        styles.roleHeading
                      }
                    >
                      SCOPED MZB ROLES
                    </Text>

                    <View
                      style={
                        styles.roleGrid
                      }
                    >
                      {roles.map(
                        (role) => {
                          const active =
                            member.role_keys.includes(
                              role.role_key
                            );

                          return (
                            <SmallButton
                              key={
                                role.role_key
                              }
                              title={
                                role.display_name
                              }
                              active={
                                active
                              }
                              disabled={
                                busyKey !=
                                null
                              }
                              onPress={() =>
                                void run(
                                  `role:${member.user_id}:${role.role_key}`,
                                  async () => {
                                    await setMzbRole(
                                      member.user_id,
                                      role.role_key,
                                      !active
                                    );
                                  }
                                )
                              }
                            />
                          );
                        }
                      )}
                    </View>

                    <Text
                      style={
                        styles.helper
                      }
                    >
                      Green = active role.
                      Tap a role to add or
                      revoke it.
                    </Text>
                  </>
                )}
              </View>
            )
          )}
        </>
      )}

      <View
        style={{
          height: 50,
        }}
      />
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F5F7F6',
    },

    content: {
      padding: 16,
      gap: 10,
    },

    hero: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E7E3',
      borderRadius: 18,
      padding: 18,
    },

    eyebrow: {
      color: '#2D6A4F',
      fontWeight: '900',
      letterSpacing: 1.5,
      fontSize: 11,
    },

    title: {
      fontWeight: '900',
      color: '#19362A',
      fontSize: 28,
      marginTop: 4,
    },

    section: {
      marginTop: 14,
      color: '#365347',
      fontWeight: '900',
      letterSpacing: 1,
      fontSize: 13,
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E7E3',
      borderRadius: 15,
      padding: 14,
      gap: 8,
    },

    memberCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E7E3',
      borderRadius: 15,
      padding: 14,
      gap: 10,
    },

    memberHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    searchRow: {
      flexDirection:
        'row',
      gap: 7,
    },

    search: {
      flex: 1,
      minHeight: 43,
      borderWidth: 1,
      borderColor:
        '#D8E1DC',
      borderRadius: 10,
      paddingHorizontal:
        11,
    },

    person: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      paddingVertical: 5,
    },

    personName: {
      color: '#243C31',
      fontWeight: '900',
    },

    muted: {
      color: '#69776F',
      marginTop: 6,
      lineHeight: 19,
    },

    mutedSmall: {
      color: '#7B877F',
      fontSize: 11,
      marginTop: 2,
    },

    roleHeading: {
      color: '#52665C',
      fontWeight: '900',
      letterSpacing: 0.8,
      fontSize: 10,
    },

    roleGrid: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    helper: {
      color: '#818C86',
      fontSize: 10,
      lineHeight: 15,
    },

    smallButton: {
      minHeight: 36,
      justifyContent:
        'center',
      alignItems:
        'center',
      paddingHorizontal:
        10,
      borderRadius: 9,
      borderWidth: 1,
      borderColor:
        '#BFCAC4',
      backgroundColor:
        '#FFFFFF',
    },

    smallActive: {
      backgroundColor:
        '#E3F3E9',
      borderColor:
        '#2D6A4F',
    },

    smallDanger: {
      backgroundColor:
        '#9E2A2B',
      borderColor:
        '#9E2A2B',
    },

    smallText: {
      color: '#41554B',
      fontWeight: '900',
      fontSize: 10,
    },

    smallActiveText: {
      color: '#24583F',
    },

    disabled: {
      opacity: 0.45,
    },

    loading: {
      padding: 45,
    },
  });
