import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import BuklodActionFeedback, { type BuklodActionStatus } from '@/components/BuklodActionFeedback';
import { useAuth } from '@/providers/AuthProvider';


type ChurchRow = {
  church_id: string;
  church_name: string;
};


type GroupRow = {
  id: string;
  church_id: string;
  church_name: string;
  name: string;
  code: string | null;
  description: string | null;
  leader_id: string | null;
  leader_name: string | null;
  is_active: boolean;
  member_count: number;
  created_at: string;
};


type LeaderRow = {
  user_id: string;
  full_name: string | null;
  church_id: string;
};


export default function GroupsScreen() {
  const {
    hasAnyRole,
    hasRole,
  } = useAuth();

  const allowed = hasAnyRole([
    'pastor',
    'local_admin',
    'system_admin',
  ]);

  const systemAdmin =
    hasRole('system_admin');

  const db = supabase as any;

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [deploymentReady, setDeploymentReady] =
    useState(true);

  const [churches, setChurches] =
    useState<ChurchRow[]>([]);

  const [groups, setGroups] =
    useState<GroupRow[]>([]);

  const [leaders, setLeaders] =
    useState<LeaderRow[]>([]);

  const [churchId, setChurchId] =
    useState('');

  const [leaderId, setLeaderId] =
    useState('');

  const [name, setName] =
    useState('');

  const [code, setCode] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [busy, setBusy] =
    useState(false);
  const createInFlight = useRef(false);
  const [createFeedback, setCreateFeedback] = useState<{status: BuklodActionStatus; message: string}>({status:'idle',message:''});


  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        churchResult,
        groupResult,
      ] = await Promise.all([
        db.rpc(
          'get_my_manageable_churches'
        ),

        db.rpc(
          'get_manageable_buklod_groups'
        ),
      ]);


      if (churchResult.error) {
        throw churchResult.error;
      }


      if (groupResult.error) {
        const message =
          String(
            groupResult.error?.message ??
            ''
          );

        const missingRpc =
          message.includes(
            'get_manageable_buklod_groups'
          ) ||
          message
            .toLowerCase()
            .includes('schema cache');

        if (missingRpc) {
          setDeploymentReady(false);

          /*
           * Keep existing System Admin access
           * usable before PATCH 153B-5A is
           * deployed.
           */
          if (systemAdmin) {
            const [
              legacyChurchResult,
              legacyGroupResult,
            ] = await Promise.all([
              db
                .from('churches')
                .select('id,name')
                .eq('is_active', true)
                .order('name'),

              db
                .from('buklod_groups')
                .select(
                  'id,name,code,description,church_id,leader_id,is_active,created_at,church:church_id(name),leader:leader_id(full_name)'
                )
                .order('name'),
            ]);


            if (legacyChurchResult.error) {
              throw legacyChurchResult.error;
            }

            if (legacyGroupResult.error) {
              throw legacyGroupResult.error;
            }


            const fallbackChurches =
              (
                legacyChurchResult.data ??
                []
              ).map(
                (item: any) => ({
                  church_id: item.id,
                  church_name:
                    item.name ??
                    'Local Church',
                })
              );


            const fallbackGroups =
              (
                legacyGroupResult.data ??
                []
              ).map(
                (item: any) => ({
                  id: item.id,
                  church_id:
                    item.church_id,
                  church_name:
                    Array.isArray(
                      item.church
                    )
                      ? item.church[0]
                          ?.name ??
                        'Local Church'
                      : item.church?.name ??
                        'Local Church',
                  name: item.name,
                  code:
                    item.code ?? null,
                  description:
                    item.description ??
                    null,
                  leader_id:
                    item.leader_id ??
                    null,
                  leader_name:
                    Array.isArray(
                      item.leader
                    )
                      ? item.leader[0]
                          ?.full_name ??
                        null
                      : item.leader
                          ?.full_name ??
                        null,
                  is_active:
                    item.is_active !==
                    false,
                  member_count: 0,
                  created_at:
                    item.created_at,
                })
              );


            setChurches(
              fallbackChurches
            );

            setGroups(
              fallbackGroups
            );

            setChurchId(
              (current) =>
                current ||
                (
                  fallbackChurches
                    .length === 1
                    ? fallbackChurches[0]
                        .church_id
                    : ''
                )
            );

            setLoading(false);
            return;
          }


          setChurches(
            churchResult.data ?? []
          );

          setGroups([]);
          setLoading(false);
          return;
        }


        throw groupResult.error;
      }


      setDeploymentReady(true);

      const loadedChurches =
        (churchResult.data ??
          []) as ChurchRow[];

      setChurches(
        loadedChurches
      );

      setGroups(
        (groupResult.data ??
          []) as GroupRow[]
      );


      setChurchId(
        (current) => {
          if (
            current &&
            loadedChurches.some(
              (item) =>
                item.church_id ===
                current
            )
          ) {
            return current;
          }

          return loadedChurches
            .length === 1
            ? loadedChurches[0]
                .church_id
            : '';
        }
      );

    } catch (error: any) {
      Alert.alert(
        'BUKLOD Clusters',
        error?.message ||
          'Could not load BUKLOD Clusters.'
      );

    } finally {
      setLoading(false);
    }
  }, [
    allowed,
    db,
    systemAdmin,
  ]);


  useEffect(() => {
    void load();
  }, [load]);


  const loadLeaders =
    useCallback(
      async (
        targetChurchId: string
      ) => {
        setLeaders([]);
        setLeaderId('');

        if (
          !targetChurchId ||
          !deploymentReady
        ) {
          return;
        }

        const result =
          await db.rpc(
            'get_manageable_buklod_group_leaders',
            {
              p_church_id:
                targetChurchId,
            }
          );


        if (result.error) {
          Alert.alert(
            'Cluster Leaders',
            result.error.message
          );

          return;
        }


        setLeaders(
          (result.data ??
            []) as LeaderRow[]
        );
      },
      [
        db,
        deploymentReady,
      ]
    );


  useEffect(() => {
    void loadLeaders(churchId);
  }, [
    churchId,
    loadLeaders,
  ]);


  const selectedLeaders =
    useMemo(
      () =>
        leaders.filter(
          (item) =>
            item.church_id ===
            churchId
        ),
      [
        leaders,
        churchId,
      ]
    );


  const create = async () => {
    if (createInFlight.current) return;
    if (!deploymentReady) {
      setCreateFeedback({status:'error',message:'The secure cluster-management migration is not deployed yet.'});
      return;
    }
    if (!churchId || !name.trim()) {
      setCreateFeedback({status:'error',message:'Local Church and Cluster name are required.'});
      return;
    }
    createInFlight.current = true;
    setBusy(true);
    setCreateFeedback({status:'pending',message:'Creating Cluster. Please do not submit twice.'});
    try {
      const result = await db.rpc('manage_create_buklod_group', {
        p_church_id: churchId,
        p_name: name.trim(),
        p_code: code.trim() || null,
        p_description: description.trim() || null,
        p_leader_id: leaderId || null,
      });
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Server did not return a Cluster ID. Check the list before retrying.');
      setCreateFeedback({status:'success',message:`Cluster "${name.trim()}" created successfully.`});
      setName('');
      setCode('');
      setDescription('');
      setLeaderId('');
      // Refresh is secondary; it must never turn a committed create into a failure.
      try {
        await load();
        await loadLeaders(churchId);
      } catch (refreshError) {
        console.warn('Cluster created; admin list refresh pending:', refreshError);
      }
    } catch (error: any) {
      setCreateFeedback({status:'error',message:`Cluster creation could not be confirmed: ${error?.message || 'Check your Cluster list before retrying.'}`});
    } finally {
      createInFlight.current = false;
      setBusy(false);
    }
  };

  const refresh =
    useCallback(async () => {
      setRefreshing(true);

      await load();

      setRefreshing(false);
    }, [load]);


  if (!allowed) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <Card>
          <Text style={shared.h1}>
            BUKLOD Clusters
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
              },
            ]}
          >
            Pastor or Admin access is required.
          </Text>
        </Card>
      </View>
    );
  }


  return (
    <FlatList
      style={shared.screen}
      contentContainerStyle={
        styles.content
      }
      data={groups}
      keyExtractor={(item) =>
        item.id
      }
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.eyebrow}>
            LOCAL COMMUNITY MANAGEMENT
          </Text>

          <Text style={shared.h1}>
            BUKLOD Clusters
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 5,
                marginBottom: 14,
              },
            ]}
          >
            Create and manage BUKLOD Clusters only
            within the Local Churches assigned to
            you.
          </Text>


          {!deploymentReady && (
            <Card>
              <Text
                style={
                  styles.pendingTitle
                }
              >
                UPDATE PENDING DEPLOYMENT
              </Text>

              <Text
                style={
                  styles.pendingText
                }
              >
                The new secure Pastor cluster controls
                are already in the app source but
                are not active in the database yet.
                No database push has been performed.
              </Text>
            </Card>
          )}


          {loading ? (
            <Card>
              <ActivityIndicator
                color={colors.green}
              />
            </Card>
          ) : (
            <>
              <SectionTitle>
                CREATE CLUSTER
              </SectionTitle>

              <Card>
                {!churches.length ? (
                  <Text
                    style={
                      shared.muted
                    }
                  >
                    No manageable Local Church was
                    found.
                  </Text>
                ) : (
                  <>
                    <Text
                      style={
                        styles.fieldLabel
                      }
                    >
                      Local Church
                    </Text>

                    <View
                      style={
                        styles.wrap
                      }
                    >
                      {churches.map(
                        (church) => (
                          <Pressable
                            key={
                              church.church_id
                            }
                            onPress={() => {
                              setChurchId(
                                church.church_id
                              );

                              setLeaderId(
                                ''
                              );
                            }}
                            style={[
                              styles.chip,

                              churchId ===
                                church.church_id &&
                                styles.chipOn,
                            ]}
                          >
                            <Text
                              style={
                                churchId ===
                                church.church_id
                                  ? styles.chipTextOn
                                  : styles.chipText
                              }
                            >
                              {
                                church.church_name
                              }
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>


                    <TextInput
                      style={
                        styles.input
                      }
                      placeholder="BUKLOD cluster name"
                      value={name}
                      onChangeText={
                        setName
                      }
                    />


                    <TextInput
                      style={
                        styles.input
                      }
                      placeholder="Code (optional)"
                      value={code}
                      onChangeText={
                        setCode
                      }
                    />


                    <TextInput
                      style={[
                        styles.input,
                        styles.multiline,
                      ]}
                      placeholder="Description (optional)"
                      value={
                        description
                      }
                      onChangeText={
                        setDescription
                      }
                      multiline
                    />


                    {!!churchId &&
                      deploymentReady && (
                        <>
                          <Text
                            style={
                              styles.fieldLabel
                            }
                          >
                            Leader (optional)
                          </Text>

                          <View
                            style={
                              styles.wrap
                            }
                          >
                            <Pressable
                              onPress={() =>
                                setLeaderId(
                                  ''
                                )
                              }
                              style={[
                                styles.chip,

                                !leaderId &&
                                  styles.chipOn,
                              ]}
                            >
                              <Text>
                                Assign later
                              </Text>
                            </Pressable>


                            {selectedLeaders.map(
                              (
                                leader
                              ) => (
                                <Pressable
                                  key={
                                    leader.user_id
                                  }
                                  onPress={() =>
                                    setLeaderId(
                                      leader.user_id
                                    )
                                  }
                                  style={[
                                    styles.chip,

                                    leaderId ===
                                      leader.user_id &&
                                      styles.chipOn,
                                  ]}
                                >
                                  <Text>
                                    {leader.full_name ||
                                      'Leader'}
                                  </Text>
                                </Pressable>
                              )
                            )}
                          </View>


                          {!selectedLeaders.length && (
                            <Text
                              style={
                                styles.help
                              }
                            >
                              No active Leader-role
                              account is available in
                              this Local. You may
                              assign the leader later.
                            </Text>
                          )}
                        </>
                      )}


                    <BuklodActionFeedback status={createFeedback.status} message={createFeedback.message} />
                    <Button
                      title={busy ? 'CREATING...' : 'CREATE CLUSTER'}
                      onPress={() => { if (!busy) void create(); }}
                    />
                  </>
                )}
              </Card>


              <SectionTitle>
                MANAGEABLE GROUPS
              </SectionTitle>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <Card>
            <Text style={shared.muted}>
              No BUKLOD Clusters are available in your
              manageable Local Churches.
            </Text>
          </Card>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push(
              {
                pathname:
                  '/admin/group/[id]',

                params: {
                  id: item.id,
                },
              } as any
            )
          }
          style={({
            pressed,
          }) => ({
            opacity:
              pressed
                ? 0.72
                : 1,
          })}
        >
          <Card>
            <View
              style={
                styles.rowBetween
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    shared.h2
                  }
                >
                  {item.name}
                </Text>

                <Text
                  style={[
                    shared.muted,
                    {
                      marginTop: 4,
                    },
                  ]}
                >
                  {item.church_name ||
                    'Local Church'}
                  {'  |  '}
                  {item.code ||
                    'No code'}
                </Text>
              </View>


              <View
                style={[
                  styles.status,

                  item.is_active
                    ? styles.statusActive
                    : styles.statusInactive,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,

                    item.is_active
                      ? styles.statusTextActive
                      : styles.statusTextInactive,
                  ]}
                >
                  {item.is_active
                    ? 'ACTIVE'
                    : 'INACTIVE'}
                </Text>
              </View>
            </View>


            <Text
              style={[
                shared.body,
                {
                  marginTop: 8,
                },
              ]}
            >
              Leader:{' '}
              {item.leader_name ||
                'Not assigned'}
            </Text>


            {deploymentReady && (
              <Text
                style={
                  styles.memberCount
                }
              >
                {Number(
                  item.member_count ??
                    0
                )}{' '}
                active member
                {Number(
                  item.member_count ??
                    0
                ) === 1
                  ? ''
                  : 's'}
              </Text>
            )}


            {!!item.description && (
              <Text
                style={
                  styles.description
                }
              >
                {item.description}
              </Text>
            )}


            <Text
              style={
                styles.openGroup
              }
            >
              OPEN GROUP & MANAGE
            </Text>
          </Card>
        </Pressable>
      )}
      ListFooterComponent={
        <View
          style={{
            height: 100,
          }}
        />
      }
    />
  );
}


const styles =
  StyleSheet.create({
    content: {
      ...shared.content,
      paddingBottom: 140,
    },

    center: {
      justifyContent: 'center',
      padding: 20,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.greenDark,
      marginBottom: 5,
    },

    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginVertical: 8,
    },

    chip: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.white,
    },

    chipOn: {
      backgroundColor:
        colors.greenSoft,
      borderColor:
        colors.green,
    },

    chipText: {
      color: colors.text,
    },

    chipTextOn: {
      color: colors.greenDark,
      fontWeight: '800',
    },

    fieldLabel: {
      marginTop: 8,
      fontSize: 11,
      fontWeight: '900',
      color: colors.text,
    },

    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.white,
      marginBottom: 8,
    },

    multiline: {
      minHeight: 78,
      textAlignVertical: 'top',
    },

    help: {
      marginTop: 2,
      marginBottom: 12,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
    },

    rowBetween: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent:
        'space-between',
      gap: 10,
    },

    status: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
    },

    statusActive: {
      backgroundColor:
        colors.greenSoft,
    },

    statusInactive: {
      backgroundColor:
        '#F1F1F1',
    },

    statusText: {
      fontSize: 8.5,
      fontWeight: '900',
    },

    statusTextActive: {
      color: colors.greenDark,
    },

    statusTextInactive: {
      color: colors.muted,
    },

    memberCount: {
      marginTop: 6,
      fontSize: 10.5,
      fontWeight: '800',
      color: colors.greenDark,
    },

    description: {
      marginTop: 8,
      fontSize: 11,
      lineHeight: 17,
      color: colors.muted,
    },

    openGroup: {
      marginTop: 12,
      fontSize: 10,
      fontWeight: '900',
      color: colors.greenDark,
      letterSpacing: 0.4,
    },

    pendingTitle: {
      fontSize: 10,
      fontWeight: '900',
      color: '#986219',
    },

    pendingText: {
      marginTop: 6,
      fontSize: 11,
      lineHeight: 17,
      color: '#765B35',
    },
  });