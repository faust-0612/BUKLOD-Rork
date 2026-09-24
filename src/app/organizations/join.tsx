/* PATCH_175B_ORGANIZATION_JOIN_APPROVAL */
import React, {
  useCallback,
  useEffect,
  useMemo,
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

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  enterScopedWorkspace,
} from '@/lib/buklodScopeRoute';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

type OrganizationRow = {
  scope_id: string;
  organization_name: string;
  parent_scope_id: string | null;
  parent_organization_name: string | null;
  is_suborganization: boolean;
  visibility: string;
  join_policy: string;
  membership_status: string | null;
  member_count: number | null;
};

function normalize(
  value: unknown,
) {
  return String(
    value ?? ''
  )
    .trim()
    .toUpperCase();
}

export default function
JoinOrganizationScreen() {
  /* PATCH_172L_R2_JOIN_ORGANIZATION_DISCOVERY */

  const {
    refresh:
      refreshBuklodScopes,
    selectScope,
  } =
    useBuklodScope();

  const { showFeedback } =
    useBuklodFeedback();

  const reportJoinFailure = useCallback(
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
          sourceRoute: '/organizations/join',
        },
      });
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: feedback.category,
        supportCode: feedback.supportCode,
        route: '/organizations/join',
        feature: 'Organization Join',
        outcome,
      });
    },
    [showFeedback],
  );

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    rows,
    setRows,
  ] =
    useState<
      OrganizationRow[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busyId,
    setBusyId,
  ] =
    useState<string | null>(
      null
    );

  const requestIdRef =
    useRef(0);

  const load =
    useCallback(
      async (
        rawQuery = '',
      ) => {
        const requestId =
          requestIdRef.current +
          1;

        requestIdRef.current =
          requestId;

        setLoading(true);

        const {
          data,
          error,
        } =
          await (supabase as any).rpc(
            'buklod_discover_organizations',
            {
              _query:
                rawQuery.trim() ||
                null,
            },
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setLoading(false);

        if (error) {
          setRows([]);

          reportJoinFailure(
            error,
            'Organizations unavailable',
            "BUKLOD couldn't load Organization choices right now.",
            'organization_discovery_failed',
          );

          return;
        }

        setRows(
          (
            data ?? []
          ) as
            OrganizationRow[]
        );
      },
      [],
    );

  useEffect(
    () => {
      const delay =
        query.trim()
          ? 180
          : 0;

      const timer =
        setTimeout(
          () => {
            void load(
              query
            );
          },
          delay,
        );

      return () =>
        clearTimeout(
          timer
        );
    },
    [
      load,
      query,
    ],
  );

  const openWorkspace =
    async (
      scopeId: string,
    ) => {
      try {
        await enterScopedWorkspace(
          selectScope,
          scopeId,
          { fromPortal: true }
        );
      }
      catch (error: any) {
        reportJoinFailure(
          error,
          'Workspace not opened',
          "BUKLOD couldn't open this Organization workspace right now.",
          'organization_workspace_failed',
        );
      }
    };

  const join =
    async (
      row: OrganizationRow,
    ) => {
      setBusyId(
        row.scope_id
      );

      try {
        const {
          data,
          error,
        } =
          await (supabase as any).rpc(
            'buklod_join_organization',
            {
              _scope_id:
                row.scope_id,
            },
          );

        if (error) {
          throw error;
        }

        const next =
          normalize(
            data
          );

        if (
          next === 'ACTIVE'
        ) {
          await refreshBuklodScopes();

          Alert.alert(
            'Organization joined',
            `You are now an active member of ${row.organization_name}.`,
            [
              {
                text: 'OPEN WORKSPACE',
                onPress: () =>
                  void openWorkspace(
                    row.scope_id,
                  ),
              },
              {
                text: 'OK',
              },
            ],
          );
        }
        else if (
          next === 'PENDING'
        ) {
          Alert.alert(
            'Request submitted',
            `Your request to join ${row.organization_name} is waiting for administrator approval.`,
          );
        }
        else if (
          next === 'INVITED'
        ) {
          Alert.alert(
            'Invitation available',
            `You already have an invitation from ${row.organization_name}.`,
          );
        }

        await load(
          query
        );
      }
      catch (error: any) {
        reportJoinFailure(
          error,
          'Organization request not completed',
          "BUKLOD couldn't complete this Organization request right now. No membership change was silently applied.",
          'organization_join_failed',
        );
      }
      finally {
        setBusyId(null);
      }
    };

  const acceptInvitation =
    async (
      row: OrganizationRow,
    ) => {
      setBusyId(
        row.scope_id
      );

      try {
        const {
          error,
        } =
          await (supabase as any).rpc(
            'buklod_respond_organization_invite',
            {
              _scope_id:
                row.scope_id,
              _accept:
                true,
            },
          );

        if (error) {
          throw error;
        }

        await refreshBuklodScopes();

        Alert.alert(
          'Invitation accepted',
          `You are now a member of ${row.organization_name}.`,
          [
            {
              text: 'OPEN WORKSPACE',
              onPress: () =>
                void openWorkspace(
                  row.scope_id,
                ),
            },
            {
              text: 'OK',
            },
          ],
        );

        await load(
          query
        );
      }
      catch (error: any) {
        reportJoinFailure(
          error,
          'Invitation not accepted',
          "BUKLOD couldn't accept this Organization invitation right now.",
          'organization_invitation_failed',
        );
      }
      finally {
        setBusyId(null);
      }
    };

  const listTitle =
    useMemo(
      () =>
        query.trim()
          ? 'SEARCH RESULTS'
          : 'PUBLIC ORGANIZATIONS',
      [query],
    );

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
        style={
          styles.back
        }
        onPress={() =>
          router.back()
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
          Organization
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
          ORGANIZATIONS
        </Text>

        <Text
          style={
            styles.title
          }
        >
          Join Organization
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Search public Organizations and Sub-organizations in BUKLOD.
        </Text>
      </View>

      <View
        style={
          styles.searchBox
        }
      >
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={
            colors.muted
          }
        />

        <TextInput
          value={query}
          onChangeText={
            setQuery
          }
          placeholder="Search Organization or Sub-organization"
          placeholderTextColor="#8B958F"
          autoCapitalize="none"
          autoCorrect={false}
          style={
            styles.input
          }
        />

        {!!query && (
          <Pressable
            onPress={() =>
              setQuery('')
            }
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={19}
              color={
                colors.muted
              }
            />
          </Pressable>
        )}
      </View>

      <Text
        style={
          styles.section
        }
      >
        {listTitle}
      </Text>

      {loading ? (
        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator
            color={
              colors.greenDark
            }
          />
        </View>
      ) : rows.length === 0 ? (
        <View
          style={
            styles.empty
          }
        >
          <MaterialCommunityIcons
            name="domain-off"
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
            No organizations found
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Try another Organization or Sub-organization name.
          </Text>
        </View>
      ) : (
        rows.map(
          row => {
            const membership =
              normalize(
                row.membership_status
              );

            const policy =
              normalize(
                row.join_policy
              );

            const visibility =
              normalize(
                row.visibility
              );

            const busy =
              busyId ===
                row.scope_id;

            const active =
              membership ===
                'ACTIVE';

            const pending =
              membership ===
                'PENDING';

            const invited =
              membership ===
                'INVITED';

            const unavailable =
              !invited &&
              (
                visibility !==
                  'PUBLIC' ||
                policy ===
                  'INVITE_ONLY'
              );

            let buttonText =
              policy === 'OPEN'
                ? 'JOIN'
                : 'REQUEST TO JOIN';

            if (active) {
              buttonText =
                'OPEN WORKSPACE';
            }
            else if (pending) {
              buttonText =
                'REQUEST PENDING';
            }
            else if (invited) {
              buttonText =
                'ACCEPT INVITATION';
            }
            else if (unavailable) {
              buttonText =
                'INVITATION REQUIRED';
            }

            return (
              <View
                key={
                  row.scope_id
                }
                style={
                  styles.card
                }
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <View
                    style={
                      styles.iconCircle
                    }
                  >
                    <MaterialCommunityIcons
                      name={
                        row.is_suborganization
                          ? 'source-branch'
                          : 'domain'
                      }
                      size={21}
                      color={
                        colors.greenDark
                      }
                    />
                  </View>

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
                      {
                        row.organization_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.kind
                      }
                    >
                      {
                        row.is_suborganization
                          ? 'SUB-ORGANIZATION'
                          : 'ORGANIZATION'
                      }
                    </Text>

                    {row.is_suborganization &&
                    !!row.parent_organization_name && (
                      <Text
                        style={
                          styles.parent
                        }
                      >
                        Under {
                          row.parent_organization_name
                        }
                      </Text>
                    )}
                  </View>
                </View>

                <View
                  style={
                    styles.metaRow
                  }
                >
                  <View
                    style={
                      styles.badge
                    }
                  >
                    <Text
                      style={
                        styles.badgeText
                      }
                    >
                      {visibility}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.badge
                    }
                  >
                    <Text
                      style={
                        styles.badgeText
                      }
                    >
                      {
                        policy === 'OPEN'
                          ? 'OPEN JOIN'
                          : policy ===
                              'INVITE_ONLY'
                            ? 'INVITE ONLY'
                            : 'APPROVAL REQUIRED'
                      }
                    </Text>
                  </View>
                </View>

                {!!membership && (
                  <Text
                    style={
                      styles.membership
                    }
                  >
                    STATUS: {
                      membership
                    }
                  </Text>
                )}

                <Pressable
                  disabled={
                    busy ||
                    pending ||
                    unavailable
                  }
                  onPress={() =>
                    active
                      ? void openWorkspace(
                          row.scope_id,
                        )
                      : invited
                      ? void acceptInvitation(
                          row
                        )
                      : void join(
                          row
                        )
                  }
                  style={[
                    styles.joinButton,
                    (
                      pending ||
                      unavailable
                    ) &&
                      styles.joinButtonDisabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.joinButtonText
                      }
                    >
                      {buttonText}
                    </Text>
                  )}
                </Pressable>
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

    back: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 12,
    },

    backText: {
      fontSize: 10,
      fontWeight: '900',
      color:
        colors.greenDark,
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

    searchBox: {
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#D8E1DB',
      backgroundColor: '#FFFFFF',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    input: {
      flex: 1,
      minHeight: 46,
      color:
        colors.text,
      fontSize: 11,
    },

    section: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 0.8,
      color:
        colors.muted,
    },

    center: {
      padding: 28,
      alignItems: 'center',
    },

    empty: {
      alignItems: 'center',
      padding: 28,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E1E8E3',
    },

    emptyTitle: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '900',
      color:
        colors.text,
    },

    emptyText: {
      marginTop: 4,
      textAlign: 'center',
      fontSize: 9.5,
      lineHeight: 14,
      color:
        colors.muted,
    },

    card: {
      marginBottom: 10,
      padding: 14,
      borderRadius: 17,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E1E8E3',
    },

    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#EEF5F0',
      alignItems: 'center',
      justifyContent: 'center',
    },

    name: {
      fontSize: 12.5,
      fontWeight: '900',
      color:
        colors.text,
    },

    kind: {
      marginTop: 2,
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 0.6,
      color:
        colors.greenDark,
    },

    parent: {
      marginTop: 3,
      fontSize: 9,
      color:
        colors.muted,
    },

    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 11,
    },

    badge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: '#F1F5F2',
    },

    badgeText: {
      fontSize: 7.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    membership: {
      marginTop: 9,
      fontSize: 8,
      fontWeight: '900',
      color: '#92400E',
    },

    joinButton: {
      marginTop: 11,
      minHeight: 39,
      paddingHorizontal: 14,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenDark,
    },

    joinButtonDisabled: {
      opacity: 0.52,
    },

    joinButtonText: {
      color: '#FFFFFF',
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
  });