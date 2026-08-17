/* PATCH_174B_R2_DELETE_MANAGED_SCOPE_SCREEN */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
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
} from 'expo-router';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

type DeletePreview = {
  allowed?: boolean;
  reason?: string;
  scope_id?: string;
  scope_name?: string;
  scope_type?: string;
  parent_scope_id?: string | null;
  is_suborganization?: boolean;
  is_mzb?: boolean;
  child_scope_count?: number;
};

function kindLabel(
  preview: DeletePreview | null
) {
  if (
    preview
      ?.is_suborganization
  ) {
    return 'SUB-ORGANIZATION';
  }

  if (
    preview?.scope_type ===
      'CLUSTER'
  ) {
    return 'CLUSTER';
  }

  return 'ORGANIZATION';
}

export default function DeleteManagedScopeScreen() {
  const {
    activeScope,
    scopes,
    refresh,
    selectScope,
  } =
    useBuklodScope();

  const [preview, setPreview] =
    useState<DeletePreview | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [confirmName, setConfirmName] =
    useState('');

  const loadPreview =
    useCallback(
      async () => {
        if (
          !activeScope?.scope_id
        ) {
          setLoading(false);
          setPreview(null);
          return;
        }

        setLoading(true);

        try {
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'buklod_scope_delete_preview_v1',
              {
                _scope_id:
                  activeScope.scope_id,
              }
            );

          if (error) {
            throw error;
          }

          setPreview(
            (data ??
              null) as
              DeletePreview | null
          );
        }
        catch (error: any) {
          Alert.alert(
            'Delete Scope',
            String(
              error?.message ??
                error ??
                'Unable to verify delete access.'
            )
          );

          setPreview(
            null
          );
        }
        finally {
          setLoading(false);
        }
      },
      [
        activeScope?.scope_id,
      ]
    );

  useEffect(
    () => {
      void loadPreview();
    },
    [
      loadPreview,
    ]
  );

  const expectedName =
    String(
      preview?.scope_name ??
        activeScope?.name ??
        ''
    );

  const exactMatch =
    confirmName ===
    expectedName;

  const canDelete =
    preview?.allowed ===
      true;

  const childCount =
    Number(
      preview
        ?.child_scope_count ??
        0
    );

  const publicScopeId =
    useMemo(
      () =>
        scopes.find(
          scope =>
            scope.scope_type ===
            'PUBLIC'
        )?.scope_id ??
        null,
      [
        scopes,
      ]
    );

  const performDelete =
    async () => {
      if (
        !activeScope?.scope_id ||
        !canDelete ||
        !exactMatch ||
        busy
      ) {
        return;
      }

      setBusy(
        true
      );

      try {
        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_delete_managed_scope_v1',
            {
              _scope_id:
                activeScope.scope_id,

              _confirm_name:
                confirmName,
            }
          );

        if (error) {
          throw error;
        }

        if (
          publicScopeId
        ) {
          await selectScope(
            publicScopeId
          );
        }

        router.replace(
          '/(tabs)/home' as any
        );

        void refresh();

        Alert.alert(
          'Scope Deleted',
          `${
            expectedName
          } was deleted successfully.${
            Number(
              data
                ?.deleted_scope_count ??
                1
            ) > 1
              ? ` ${
                  Number(
                    data
                      ?.deleted_scope_count ??
                      1
                  ) - 1
                } Sub-organization(s) were deleted with it.`
              : ''
          }`
        );
      }
      catch (error: any) {
        Alert.alert(
          'Could Not Delete',
          String(
            error?.message ??
              error ??
              'Please try again.'
          )
        );
      }
      finally {
        setBusy(
          false
        );
      }
    };

  const requestDelete =
    () => {
      if (
        !canDelete ||
        !exactMatch ||
        busy
      ) {
        return;
      }

      const kind =
        kindLabel(
          preview
        );

      const childWarning =
        childCount > 0
          ? ` This will also delete ${childCount} Sub-organization(s).`
          : '';

      Alert.alert(
        `Delete ${kind}?`,
        `This removes the scope from BUKLOD and closes its active memberships, roles, Community posts, and Connect messages.${childWarning}`,
        [
          {
            text:
              'CANCEL',
            style:
              'cancel',
          },
          {
            text:
              'DELETE',
            style:
              'destructive',
            onPress:
              () =>
                void performDelete(),
          },
        ]
      );
    };

  if (
    !activeScope
  ) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text
          style={
            styles.muted
          }
        >
          No active managed scope.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() =>
            router.back()
          }
          hitSlop={10}
          style={
            styles.back
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={21}
            color={
              colors.greenDark
            }
          />
        </Pressable>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            SCOPE ADMIN
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Delete Scope
          </Text>
        </View>
      </View>

      {loading ? (
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

          <Text
            style={
              styles.muted
            }
          >
            Checking admin access...
          </Text>
        </View>
      ) : (
        <>
          <View
            style={
              styles.dangerCard
            }
          >
            <View
              style={
                styles.dangerIcon
              }
            >
              <MaterialCommunityIcons
                name="alert-octagon-outline"
                size={25}
                color="#B42318"
              />
            </View>

            <Text
              style={
                styles.kind
              }
            >
              {
                kindLabel(
                  preview
                )
              }
            </Text>

            <Text
              style={
                styles.scopeName
              }
            >
              {
                expectedName
              }
            </Text>

            <Text
              style={
                styles.reason
              }
            >
              {
                preview
                  ?.reason ||
                'Delete access could not be verified.'
              }
            </Text>

            {childCount > 0 && (
              <View
                style={
                  styles.childWarning
                }
              >
                <MaterialCommunityIcons
                  name="source-branch"
                  size={17}
                  color="#92400E"
                />

                <Text
                  style={
                    styles.childWarningText
                  }
                >
                  This Organization has {
                    childCount
                  } Sub-organization(s). They will be deleted together.
                </Text>
              </View>
            )}

            {preview?.is_mzb && (
              <View
                style={
                  styles.mzbWarning
                }
              >
                <Text
                  style={
                    styles.mzbWarningText
                  }
                >
                  MZB Ministry deletion is restricted to System Admin.
                </Text>
              </View>
            )}
          </View>

          {canDelete ? (
            <>
              <Text
                style={
                  styles.label
                }
              >
                TYPE THE EXACT NAME
              </Text>

              <Text
                selectable
                style={
                  styles.expected
                }
              >
                {
                  expectedName
                }
              </Text>

              <TextInput
                value={
                  confirmName
                }
                onChangeText={
                  setConfirmName
                }
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Exact scope name"
                placeholderTextColor="#929C96"
                style={[
                  styles.input,
                  exactMatch &&
                    styles.inputReady,
                ]}
              />

              <Text
                style={
                  styles.help
                }
              >
                This action is destructive. The exact name is checked again by the database before deletion.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Permanently delete managed scope"
                disabled={
                  !exactMatch ||
                  busy
                }
                onPress={
                  requestDelete
                }
                style={({ pressed }) => [
                  styles.deleteButton,
                  (
                    !exactMatch ||
                    busy
                  ) &&
                    styles.disabled,
                  pressed &&
                    exactMatch &&
                    !busy && {
                      opacity:
                        0.76,
                    },
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    styles.deleteText
                  }
                >
                  {
                    busy
                      ? 'DELETING...'
                      : `DELETE ${
                          kindLabel(
                            preview
                          )
                        }`
                  }
                </Text>
              </Pressable>
            </>
          ) : (
            <View
              style={
                styles.blocked
              }
            >
              <MaterialCommunityIcons
                name="shield-lock-outline"
                size={20}
                color="#92400E"
              />

              <Text
                style={
                  styles.blockedText
                }
              >
                {
                  preview
                    ?.reason ||
                  'You do not have delete permission for this scope.'
                }
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex:
        1,
      backgroundColor:
        '#F7F9F7',
    },

    content: {
      padding:
        17,
      paddingBottom:
        44,
    },

    header: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        11,
      marginBottom:
        16,
    },

    back: {
      width:
        40,
      height:
        40,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EAF3ED',
    },

    eyebrow: {
      fontSize:
        8.5,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
      color:
        '#B42318',
    },

    title: {
      marginTop:
        2,
      fontSize:
        22,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    center: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding:
        20,
      backgroundColor:
        '#F7F9F7',
    },

    loading: {
      minHeight:
        180,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        10,
    },

    muted: {
      fontSize:
        11,
      color:
        colors.muted,
    },

    dangerCard: {
      padding:
        17,
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        '#F0B8B2',
      backgroundColor:
        '#FFF6F5',
      marginBottom:
        18,
    },

    dangerIcon: {
      width:
        45,
      height:
        45,
      borderRadius:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FDE7E5',
      marginBottom:
        11,
    },

    kind: {
      fontSize:
        9,
      fontWeight:
        '900',
      letterSpacing:
        0.8,
      color:
        '#B42318',
    },

    scopeName: {
      marginTop:
        4,
      fontSize:
        18,
      lineHeight:
        23,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    reason: {
      marginTop:
        8,
      fontSize:
        10.5,
      lineHeight:
        15,
      color:
        '#6F4A46',
    },

    childWarning: {
      marginTop:
        13,
      padding:
        11,
      borderRadius:
        12,
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap:
        8,
      backgroundColor:
        '#FFF1D8',
    },

    childWarningText: {
      flex:
        1,
      fontSize:
        10,
      lineHeight:
        14,
      fontWeight:
        '800',
      color:
        '#7A4D0B',
    },

    mzbWarning: {
      marginTop:
        10,
      padding:
        10,
      borderRadius:
        11,
      backgroundColor:
        '#FDE7E5',
    },

    mzbWarningText: {
      fontSize:
        9.5,
      lineHeight:
        14,
      fontWeight:
        '900',
      color:
        '#B42318',
    },

    label: {
      marginBottom:
        6,
      fontSize:
        9,
      fontWeight:
        '900',
      letterSpacing:
        0.7,
      color:
        colors.greenDark,
    },

    expected: {
      marginBottom:
        9,
      padding:
        10,
      borderRadius:
        11,
      backgroundColor:
        '#EEF5F0',
      fontSize:
        12,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    input: {
      minHeight:
        48,
      paddingHorizontal:
        13,
      borderRadius:
        13,
      borderWidth:
        1,
      borderColor:
        '#D8DEDA',
      backgroundColor:
        '#FFFFFF',
      color:
        colors.text,
      fontSize:
        13,
      fontWeight:
        '800',
    },

    inputReady: {
      borderColor:
        '#B42318',
      borderWidth:
        2,
    },

    help: {
      marginTop:
        8,
      fontSize:
        9.5,
      lineHeight:
        14,
      color:
        colors.muted,
    },

    deleteButton: {
      marginTop:
        18,
      minHeight:
        50,
      borderRadius:
        14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        8,
      backgroundColor:
        '#B42318',
    },

    deleteText: {
      fontSize:
        10.5,
      fontWeight:
        '900',
      letterSpacing:
        0.45,
      color:
        '#FFFFFF',
    },

    disabled: {
      opacity:
        0.42,
    },

    blocked: {
      padding:
        14,
      borderRadius:
        14,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        9,
      backgroundColor:
        '#FFF1D8',
    },

    blockedText: {
      flex:
        1,
      fontSize:
        10,
      lineHeight:
        14,
      fontWeight:
        '800',
      color:
        '#7A4D0B',
    },
  });