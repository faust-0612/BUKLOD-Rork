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
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

import {
  MzbEntitlement,
  MzbStatus,
  getMyMzb,
  getMyMzbEntitlements,
  leaveMzb,
  respondMzbInvite,
} from '@/lib/buklodMzb';

function messageOf(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
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

function Button({
  title,
  onPress,
  outline,
  danger,
  disabled,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        outline &&
          styles.buttonOutline,
        danger &&
          styles.buttonDanger,
        disabled &&
          styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          outline &&
            styles.buttonTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function roleLabel(
  role: string
) {
  switch (role) {
    case 'MEMBER':
      return 'Member';

    case 'ORG_ADMIN':
      return 'Organization Admin';

    case 'MZB_WORKER':
      return 'Worker';

    case 'MZB_MISSIONARY':
      return 'Missionary';

    case 'MZB_DEACON':
      return 'Deacon';

    case 'MZB_PASTOR':
      return 'Pastor';

    case 'MZB_LEADERSHIP':
      return 'Leadership';

    case 'MZB_OFFICE_STAFF':
      return 'Office Staff';

    default:
      return role;
  }
}

function featureLabel(
  key: string
) {
  switch (key) {
    case 'restricted.tithes':
      return 'Tithes';

    case 'restricted.bayanihan':
      return 'Bayanihan';

    case 'restricted.learn':
      return 'Learn';

    default:
      return key;
  }
}

/** MZB organization membership & settings — not the scoped workspace home. */
export default function MzbOrganizationScreen() {
  const [status, setStatus] =
    useState<MzbStatus | null>(
      null
    );

  const [
    entitlements,
    setEntitlements,
  ] = useState<
    MzbEntitlement[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [busy, setBusy] =
    useState(false);

  const load = useCallback(
    async (
      refresh = false
    ) => {
      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        const info =
          await getMyMzb();

        setStatus(info);

        if (
          info?.membership_status ===
            'ACTIVE' ||
          info?.is_admin
        ) {
          setEntitlements(
            await getMyMzbEntitlements()
          );
        } else {
          setEntitlements([]);
        }
      } catch (error) {
        Alert.alert(
          'MZB Ministry',
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
    work: () => Promise<void>
  ) {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await work();
      await load(true);
    } catch (error) {
      Alert.alert(
        'MZB Ministry',
        messageOf(error)
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.muted}>
          Loading MZB Ministry...
        </Text>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          MZB Ministry
        </Text>

        <Text style={styles.muted}>
          Organization scope is unavailable.
        </Text>
      </View>
    );
  }

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
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
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          ORGANIZATION
        </Text>

        <Text style={styles.title}>
          {status.organization_name}
        </Text>

        {!!status.description && (
          <Text
            style={
              styles.description
            }
          >
            {status.description}
          </Text>
        )}

        <View
          style={styles.chips}
        >
          <View style={styles.chip}>
            <Text
              style={
                styles.chipText
              }
            >
              {status.scope_status}
            </Text>
          </View>

          {!!status.membership_status && (
            <View style={styles.chip}>
              <Text
                style={
                  styles.chipText
                }
              >
                {
                  status.membership_status
                }
              </Text>
            </View>
          )}

          {status.is_admin && (
            <View
              style={
                styles.adminChip
              }
            >
              <Text
                style={
                  styles.adminChipText
                }
              >
                ORG ADMIN
              </Text>
            </View>
          )}
        </View>

        {status.faith_content_mandatory && (
          <Text style={styles.notice}>
            MZB Ministry is a Christian
            organization. Christian faith
            content is always enabled inside
            this organization scope.
          </Text>
        )}
      </View>


      {!status.membership_status && (
        <View style={styles.card}>
          <Text
            style={
              styles.cardTitle
            }
          >
            Controlled Membership
          </Text>

          <Text style={styles.muted}>
            MZB Ministry membership is
            managed by authorized MZB
            administrators. It is not a
            public self-join organization.
          </Text>
        </View>
      )}


      {status.membership_status ===
        'INVITED' && (
        <View style={styles.card}>
          <Text
            style={
              styles.cardTitle
            }
          >
            MZB Invitation
          </Text>

          <Text style={styles.muted}>
            You have been invited to join
            MZB Ministry Inc.
          </Text>

          <View
            style={
              styles.actions
            }
          >
            <Button
              title="ACCEPT"
              disabled={busy}
              onPress={() =>
                void run(
                  async () => {
                    await respondMzbInvite(
                      true
                    );
                  }
                )
              }
            />

            <Button
              title="DECLINE"
              outline
              disabled={busy}
              onPress={() =>
                void run(
                  async () => {
                    await respondMzbInvite(
                      false
                    );
                  }
                )
              }
            />
          </View>
        </View>
      )}


      {status.membership_status ===
        'ACTIVE' && (
        <>
          <Text
            style={
              styles.section
            }
          >
            MY MZB ROLES
          </Text>

          <View
            style={styles.card}
          >
            {status.role_keys.length ===
            0 ? (
              <Text
                style={
                  styles.muted
                }
              >
                Member
              </Text>
            ) : (
              <View
                style={
                  styles.chips
                }
              >
                {status.role_keys.map(
                  (role) => (
                    <View
                      key={role}
                      style={
                        styles.roleChip
                      }
                    >
                      <Text
                        style={
                          styles.roleText
                        }
                      >
                        {roleLabel(
                          role
                        )}
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}
          </View>


          <Text
            style={
              styles.section
            }
          >
            ORGANIZATION FEATURES
          </Text>

          <View
            style={styles.card}
          >
            {entitlements
              .filter(
                (item) =>
                  item.enabled
              )
              .map((item) => (
                <View
                  key={
                    item.feature_key
                  }
                  style={
                    styles.featureRow
                  }
                >
                  <Text
                    style={
                      styles.featureName
                    }
                  >
                    {featureLabel(
                      item.feature_key
                    )}
                  </Text>

                  <Text
                    style={
                      styles.enabled
                    }
                  >
                    ENABLED
                  </Text>
                </View>
              ))}

            <Text
              style={
                styles.helper
              }
            >
              Feature buttons will be
              connected to the active scope
              in the Unified Scope Engine
              phase.
            </Text>
          </View>


          {status.is_admin && (
            <>
              <Text
                style={
                  styles.section
                }
              >
                ADMINISTRATION
              </Text>

              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.cardTitle
                  }
                >
                  MZB Organization Admin
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  Manage MZB membership and
                  scoped ministry roles.
                </Text>

                <Button
                  title="OPEN MZB ADMIN"
                  onPress={() =>
                    router.push(
                      '/mzb/admin' as any
                    )
                  }
                />
              </View>
            </>
          )}


          {!status.is_admin && (
            <View
              style={[
                styles.card,
                {
                  marginTop: 16,
                },
              ]}
            >
              <Button
                title="LEAVE MZB ORGANIZATION"
                danger
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    'Leave MZB',
                    'Remove your MZB organization membership from BUKLOD?',
                    [
                      {
                        text:
                          'Cancel',
                        style:
                          'cancel',
                      },
                      {
                        text:
                          'Leave',
                        style:
                          'destructive',
                        onPress:
                          () =>
                            void run(
                              async () => {
                                await leaveMzb();
                              }
                            ),
                      },
                    ]
                  )
                }
              />
            </View>
          )}
        </>
      )}
    </BuklodPortalScrollView>
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

    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 12,
      padding: 24,
      backgroundColor:
        '#F5F7F6',
    },

    hero: {
      backgroundColor:
        '#FFFFFF',
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        '#E1E7E3',
      gap: 8,
    },

    eyebrow: {
      color: '#2D6A4F',
      fontWeight: '900',
      letterSpacing: 2,
      fontSize: 11,
    },

    title: {
      color: '#19362A',
      fontSize: 28,
      fontWeight: '900',
    },

    description: {
      color: '#58675F',
      lineHeight: 20,
    },

    notice: {
      marginTop: 5,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        '#F0F7F3',
      color: '#315B47',
      lineHeight: 19,
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
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        '#E1E7E3',
      padding: 14,
      gap: 9,
    },

    cardTitle: {
      color: '#243C31',
      fontWeight: '900',
      fontSize: 16,
    },

    muted: {
      color: '#748079',
      lineHeight: 19,
    },

    helper: {
      marginTop: 6,
      color: '#7A867F',
      fontSize: 11,
      lineHeight: 17,
    },

    chips: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    chip: {
      paddingHorizontal:
        9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor:
        '#EDF3EF',
    },

    chipText: {
      color: '#436052',
      fontWeight: '900',
      fontSize: 10,
    },

    adminChip: {
      paddingHorizontal:
        9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor:
        '#DFF2E7',
    },

    adminChipText: {
      color: '#236043',
      fontWeight: '900',
      fontSize: 10,
    },

    roleChip: {
      backgroundColor:
        '#EFF6F2',
      borderRadius: 999,
      paddingHorizontal:
        10,
      paddingVertical: 6,
    },

    roleText: {
      color: '#28533F',
      fontWeight: '800',
      fontSize: 11,
    },

    featureRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical: 5,
    },

    featureName: {
      flex: 1,
      color: '#334B40',
      fontWeight: '800',
    },

    enabled: {
      color: '#2D6A4F',
      fontWeight: '900',
      fontSize: 10,
    },

    actions: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    button: {
      minHeight: 41,
      paddingHorizontal:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 11,
      backgroundColor:
        '#2D6A4F',
    },

    buttonOutline: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#2D6A4F',
    },

    buttonDanger: {
      backgroundColor:
        '#9E2A2B',
    },

    buttonText: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 11,
    },

    buttonTextOutline: {
      color: '#2D6A4F',
    },

    disabled: {
      opacity: 0.45,
    },
  });
