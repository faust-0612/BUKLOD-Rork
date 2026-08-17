/* PATCH_175B_ORGANIZATION_JOIN_REQUESTS */
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
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

type JoinRequestRow = {
  scope_id: string;
  organization_name: string;
  is_suborganization: boolean;
  user_id: string;
  full_name: string;
  username: string | null;
  mobile: string | null;
  requested_at: string | null;
};

function requestedDate(value: string | null) {
  if (!value) {
    return 'Request date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function OrganizationJoinRequestsScreen() {
  const params =
    useLocalSearchParams<{
      organization?: string;
    }>();

  const scopeId =
    typeof params.organization === 'string'
      ? params.organization
      : '';

  const [
    rows,
    setRows,
  ] =
    useState<JoinRequestRow[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    busyId,
    setBusyId,
  ] =
    useState<string | null>(null);

  const load =
    useCallback(
      async (
        mode:
          | 'initial'
          | 'refresh' = 'initial',
      ) => {
        if (!scopeId) {
          setRows([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        if (mode === 'refresh') {
          setRefreshing(true);
        }
        else {
          setLoading(true);
        }

        const {
          data,
          error,
        } =
          await (supabase as any).rpc(
            'buklod_org_list_join_requests',
            {
              _scope_id:
                scopeId,
            },
          );

        setLoading(false);
        setRefreshing(false);

        if (error) {
          setRows([]);

          Alert.alert(
            'Join Requests',
            error.message,
          );

          return;
        }

        setRows(
          (data ?? []) as
            JoinRequestRow[]
        );
      },
      [scopeId],
    );

  useEffect(
    () => {
      void load();
    },
    [load],
  );

  const performReview =
    async (
      row: JoinRequestRow,
      approve: boolean,
    ) => {
      setBusyId(
        row.user_id
      );

      const {
        error,
      } =
        await (supabase as any).rpc(
          'buklod_org_review_join_request',
          {
            _scope_id:
              scopeId,
            _user_id:
              row.user_id,
            _approve:
              approve,
          },
        );

      setBusyId(null);

      if (error) {
        Alert.alert(
          'Join Requests',
          error.message,
        );
        return;
      }

      Alert.alert(
        approve
          ? 'Request approved'
          : 'Request rejected',
        approve
          ? `${row.full_name} is now an ACTIVE member of this exact Organization/Sub-organization.`
          : `${row.full_name}'s join request was rejected.`,
      );

      await load();
    };

  const review =
    (
      row: JoinRequestRow,
      approve: boolean,
    ) => {
      Alert.alert(
        approve
          ? 'Approve join request?'
          : 'Reject join request?',
        approve
          ? `Approve ${row.full_name} as a normal member of this exact scope?`
          : `Reject ${row.full_name}'s request to join this exact scope?`,
        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text:
              approve
                ? 'APPROVE'
                : 'REJECT',
            style:
              approve
                ? 'default'
                : 'destructive',
            onPress:
              () =>
                void performReview(
                  row,
                  approve,
                ),
          },
        ],
      );
    };

  if (!scopeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          No Organization selected
        </Text>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            GO BACK
          </Text>
        </Pressable>
      </View>
    );
  }

  const organizationName =
    rows[0]?.organization_name ??
    'Organization';

  const kind =
    rows[0]?.is_suborganization
      ? 'SUB-ORGANIZATION'
      : 'ORGANIZATION';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            void load('refresh')
          }
        />
      }
    >
      <Pressable
        onPress={() =>
          router.back()
        }
        style={styles.back}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={20}
          color={
            colors.greenDark
          }
        />

        <Text style={styles.backText}>
          Organization Members
        </Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          {kind} ADMIN
        </Text>

        <Text style={styles.title}>
          Join Requests
        </Text>

        <Text style={styles.subtitle}>
          Review users requesting to join {organizationName}. Approval creates normal ACTIVE membership only in this exact scope.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={
              colors.greenDark
            }
          />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="account-clock-outline"
            size={34}
            color={
              colors.muted
            }
          />

          <Text style={styles.emptyTitle}>
            No pending join requests
          </Text>

          <Text style={styles.emptyText}>
            New PUBLIC approval-required requests will appear here.
          </Text>
        </View>
      ) : (
        rows.map(
          row => {
            const busy =
              busyId ===
                row.user_id;

            return (
              <View
                key={
                  row.user_id
                }
                style={styles.card}
              >
                <View style={styles.identityRow}>
                  <View style={styles.avatar}>
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={24}
                      color={
                        colors.greenDark
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {row.full_name}
                    </Text>

                    {!!row.username && (
                      <Text style={styles.meta}>
                        @{row.username}
                      </Text>
                    )}

                    {!!row.mobile && (
                      <Text style={styles.meta}>
                        {row.mobile}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.requestMeta}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={15}
                    color={
                      colors.muted
                    }
                  />

                  <Text style={styles.requestMetaText}>
                    Requested {requestedDate(
                      row.requested_at
                    )}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      review(
                        row,
                        false,
                      )
                    }
                    style={[
                      styles.reject,
                      busy &&
                        styles.disabled,
                    ]}
                  >
                    <Text style={styles.rejectText}>
                      REJECT
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      review(
                        row,
                        true,
                      )
                    }
                    style={[
                      styles.approve,
                      busy &&
                        styles.disabled,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text style={styles.approveText}>
                        APPROVE
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }
        )
      )}
    </ScrollView>
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
      paddingBottom: 52,
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 24,
      backgroundColor:
        colors.background,
    },

    back: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 12,
    },

    backText: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
    },

    hero: {
      borderRadius: 20,
      padding: 18,
      backgroundColor:
        colors.greenDark,
      marginBottom: 14,
    },

    eyebrow: {
      color:
        'rgba(255,255,255,0.72)',
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 1,
    },

    title: {
      marginTop: 5,
      color: '#FFFFFF',
      fontSize: 23,
      fontWeight: '900',
    },

    subtitle: {
      marginTop: 7,
      color:
        'rgba(255,255,255,0.82)',
      fontSize: 10,
      lineHeight: 15,
    },

    loading: {
      padding: 30,
      alignItems: 'center',
    },

    empty: {
      alignItems: 'center',
      padding: 28,
      borderRadius: 16,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E8E3',
    },

    emptyTitle: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '900',
      color:
        colors.text,
      textAlign: 'center',
    },

    emptyText: {
      marginTop: 5,
      fontSize: 9.5,
      lineHeight: 14,
      color:
        colors.muted,
      textAlign: 'center',
    },

    card: {
      marginBottom: 10,
      padding: 14,
      borderRadius: 17,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E8E3',
    },

    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EEF5F0',
    },

    name: {
      fontSize: 12.5,
      fontWeight: '900',
      color:
        colors.text,
    },

    meta: {
      marginTop: 2,
      fontSize: 9,
      color:
        colors.muted,
    },

    requestMeta: {
      marginTop: 11,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        '#EDF1EE',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    requestMetaText: {
      flex: 1,
      fontSize: 8.5,
      color:
        colors.muted,
    },

    actions: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 8,
    },

    reject: {
      flex: 1,
      minHeight: 39,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        '#FCA5A5',
      backgroundColor:
        '#FFF1F2',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    rejectText: {
      color: '#991B1B',
      fontSize: 8.5,
      fontWeight: '900',
    },

    approve: {
      flex: 1,
      minHeight: 39,
      borderRadius: 11,
      backgroundColor:
        colors.greenDark,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    approveText: {
      color: '#FFFFFF',
      fontSize: 8.5,
      fontWeight: '900',
    },

    primary: {
      marginTop: 14,
      minHeight: 39,
      paddingHorizontal: 18,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    primaryText: {
      color: '#FFFFFF',
      fontSize: 8.5,
      fontWeight: '900',
    },

    disabled: {
      opacity: 0.55,
    },
  });
