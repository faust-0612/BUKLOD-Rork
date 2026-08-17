import {
  useCallback,
  useEffect,
  useMemo,
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

import { AdminGate } from '@/components/AdminGate';
import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type ClusterRow = {
  track_id: string;
  track_title: string;
  track_slug: string;
  lesson_count: number;
  min_reward: number;
  max_reward: number;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  church_name: string;
  group_name: string;
  current_balance: number;
};

type LeaderRow = {
  rank_position: number;
  user_id: string;
  full_name: string;
  church_name: string;
  group_name: string;
  total_earned: number;
  total_used: number;
  current_balance: number;
};

function money(value: any) {
  return Number(value || 0).toFixed(2);
}

export default function AdminBayanihanScreen() {
  const [clusters, setClusters] =
    useState<ClusterRow[]>([]);

  const [members, setMembers] =
    useState<MemberRow[]>([]);

  const [leaders, setLeaders] =
    useState<LeaderRow[]>([]);

  const [monthlyLeaders, setMonthlyLeaders] =
    useState<LeaderRow[]>([]);

  const [editingClusterId, setEditingClusterId] =
    useState('');

  const [savedClusterId, setSavedClusterId] =
    useState('');

  const [memberSearchApplied, setMemberSearchApplied] =
    useState('');

  const [clusterAmounts, setClusterAmounts] =
    useState<Record<string, string>>({});

  const [memberSearch, setMemberSearch] =
    useState('');

  const [selectedMemberId, setSelectedMemberId] =
    useState('');

  const [rewardAmount, setRewardAmount] =
    useState('');

  const [rewardNote, setRewardNote] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [busyKey, setBusyKey] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [
      {
        data: clusterData,
        error: clusterError,
      },
      {
        data: memberData,
        error: memberError,
      },
      {
        data: leaderData,
        error: leaderError,
      },
    ] = await Promise.all([
      (supabase as any).rpc(
        'admin_get_bayanihan_clusters_v2'
      ),

      (supabase as any).rpc(
        'admin_bayanihan_member_directory_v2'
      ),

      (supabase as any).rpc(
        'admin_bayanihan_leaderboard_v3',
        {
          p_period: 'overall',
          p_limit: 5,
        }
      ),
    ]);

    const {
      data: monthlyLeaderData,
      error: monthlyLeaderError,
    } =
      await (supabase as any).rpc(
        'admin_bayanihan_leaderboard_v3',
        {
          p_period: 'month',
          p_limit: 5,
        }
      );

    if (clusterError) {
      Alert.alert(
        'Bayanihan Cluster Settings',
        clusterError.message
      );
    }

    if (memberError) {
      Alert.alert(
        'Reward Member',
        memberError.message
      );
    }

    if (leaderError) {
      Alert.alert(
        'Bayanihan Leaderboard',
        leaderError.message
      );
    }

    if (monthlyLeaderError) {
      Alert.alert(
        'Monthly Bayanihan Leaderboard',
        monthlyLeaderError.message
      );
    }

    const nextClusters =
      (clusterData ?? []) as ClusterRow[];

    setClusters(nextClusters);
    setMembers(
      (memberData ?? []) as MemberRow[]
    );
    setLeaders(
      (leaderData ?? []) as LeaderRow[]
    );

    setMonthlyLeaders(
      (monthlyLeaderData ?? []) as LeaderRow[]
    );

    setClusterAmounts((current) => {
      const next = {
        ...current,
      };

      nextClusters.forEach((row) => {
        if (
          next[row.track_id] ===
          undefined
        ) {
          next[row.track_id] =
            Number(row.min_reward) ===
            Number(row.max_reward)
              ? String(
                  Number(
                    row.min_reward || 0
                  )
                )
              : '';
        }
      });

      return next;
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMembers =
    useMemo(() => {
      const query =
        memberSearchApplied
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return members
        .filter((row) =>
          [
            row.full_name,
            row.church_name,
            row.group_name,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        )
        .slice(0, 20);
    }, [
      members,
      memberSearchApplied,
    ]);

  const selectedMember =
    members.find(
      (row) =>
        row.user_id ===
        selectedMemberId
    ) ?? null;

  const saveClusterReward =
    (row: ClusterRow) => {
      const amount = Number(
        clusterAmounts[
          row.track_id
        ] ?? ''
      );

      if (
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        return Alert.alert(
          'Reward Amount',
          'Enter a valid amount of 0 or higher.'
        );
      }

      Alert.alert(
        'Update Cluster Reward?',
        `Set ${row.track_title} to ${money(amount)} BUKLOD Bayanihan for EACH approved lesson in this cluster? Previously earned rewards are not changed.`,
        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'SAVE',
            onPress: async () => {
              setBusyKey(
                `cluster:${row.track_id}`
              );

              const { error } =
                await (supabase as any).rpc(
                  'admin_set_track_bayanihan_reward_v2',
                  {
                    p_track_id:
                      row.track_id,
                    p_amount:
                      amount,
                  }
                );

              setBusyKey(null);

              if (error) {
                return Alert.alert(
                  'Could not save reward',
                  error.message
                );
              }

              Alert.alert(
                'Saved',
                'The reward amount now applies to future approved lesson completions in this cluster.'
              );

              setSavedClusterId(
                row.track_id
              );

              setEditingClusterId(
                ''
              );

              await load();
            },
          },
        ]
      );
    };

  const rewardMember = () => {
    const amount =
      Number(rewardAmount);

    if (!selectedMember) {
      return Alert.alert(
        'Reward Member',
        'Select a member first.'
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return Alert.alert(
        'Reward Member',
        'Enter a reward amount greater than 0.'
      );
    }

    Alert.alert(
      'Confirm Member Reward',
      `Add ${money(amount)} BUKLOD Bayanihan to ${selectedMember.full_name}?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'REWARD MEMBER',
          onPress: async () => {
            setBusyKey(
              `member:${selectedMember.user_id}`
            );

            const { error } =
              await (supabase as any).rpc(
                'admin_reward_member_bayanihan_v2',
                {
                  p_user_id:
                    selectedMember.user_id,
                  p_amount:
                    amount,
                  p_note:
                    rewardNote.trim() ||
                    null,
                }
              );

            setBusyKey(null);

            if (error) {
              return Alert.alert(
                'Reward failed',
                error.message
              );
            }

            setRewardAmount('');
            setRewardNote('');

            Alert.alert(
              'Member Rewarded',
              `${money(amount)} BUKLOD Bayanihan was added to ${selectedMember.full_name}.`
            );

            await load();
          },
        },
      ]
    );
  };

  const renderLeaderboard =
    (
      rows: LeaderRow[],
      title: string,
      subtitle: string
    ) => (
      <Card>
        <Text style={styles.infoTitle}>
          {title}
        </Text>

        <Text style={styles.infoText}>
          {subtitle}
        </Text>

        {rows.length === 0 ? (
          <Text
            style={[
              shared.muted,
              {
                marginTop: 10,
              },
            ]}
          >
            No earned Bayanihan yet.
          </Text>
        ) : (
          rows
            .slice(0, 5)
            .map((row, index) => (
              <View
                key={row.user_id}
                style={styles.compactLeader}
              >
                <Text
                  style={styles.rankText}
                >
                  {index + 1}
                </Text>

                <Text
                  style={styles.compactLeaderName}
                  numberOfLines={1}
                >
                  {row.full_name ||
                    'BUKLOD Member'}
                </Text>

                <Text
                  style={styles.compactLeaderAmount}
                >
                  {money(
                    row.total_earned
                  )}
                </Text>
              </View>
            ))
        )}
      </Card>
    );


  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
          />
        }
      >
        <Text style={styles.eyebrow}>
          SYSTEM ADMIN
        </Text>

        <Text style={shared.h1}>
          BUKLOD Bayanihan
        </Text>

        <Text style={shared.muted}>
          Manage learning rewards, reward any verified member, and review the Bayanihan leaderboard.
        </Text>

        <SectionTitle>
          LESSON CLUSTER REWARDS
        </SectionTitle>

        <Card>
          <Text style={styles.infoTitle}>
            Reward per approved lesson
          </Text>

          <Text style={styles.infoText}>
            A cluster is a Learning Track. The amount you set here is applied to EACH lesson inside that cluster when the member receives final approval. Past rewards are not recalculated.
          </Text>
        </Card>

        {loading && (
          <ActivityIndicator
            color={colors.green}
          />
        )}

        {clusters.map((row) => {
          const mixed =
            Number(row.min_reward) !==
            Number(row.max_reward);

          const editing =
            editingClusterId ===
            row.track_id;

          const saved =
            savedClusterId ===
            row.track_id;

          return (
            <Card key={row.track_id}>
              <View
                style={styles.clusterLine}
              >
                <Text
                  style={
                    styles.clusterOneLine
                  }
                  numberOfLines={1}
                >
                  {row.track_title}
                  {'  |  '}
                  {row.lesson_count}{' '}
                  lesson
                  {Number(
                    row.lesson_count
                  ) === 1
                    ? ''
                    : 's'}
                  {'  |  '}
                  {mixed
                    ? 'Mixed rewards'
                    : `${money(
                        row.min_reward
                      )} / lesson`}
                </Text>

                <Pressable
                  onPress={() => {
                    if (editing) {
                      setEditingClusterId(
                        ''
                      );
                    }
                    else {
                      setEditingClusterId(
                        row.track_id
                      );

                      setSavedClusterId(
                        ''
                      );
                    }
                  }}
                  style={
                    styles.smallAction
                  }
                >
                  <Text
                    style={
                      styles.smallActionText
                    }
                  >
                    {editing
                      ? 'CANCEL'
                      : saved
                        ? 'SAVED'
                        : 'EDIT REWARD'}
                  </Text>
                </Pressable>
              </View>

              {editing && (
                <View
                  style={
                    styles.rewardEditRow
                  }
                >
                  <TextInput
                    style={[
                      styles.input,
                      styles.rewardEditInput,
                    ]}
                    value={
                      clusterAmounts[
                        row.track_id
                      ] ?? ''
                    }
                    onChangeText={(
                      value
                    ) =>
                      setClusterAmounts(
                        current => ({
                          ...current,
                          [row.track_id]:
                            value,
                        })
                      )
                    }
                    placeholder="Reward"
                    keyboardType="decimal-pad"
                    editable={
                      busyKey !==
                      `cluster:${row.track_id}`
                    }
                  />

                  <Pressable
                    disabled={
                      busyKey ===
                      `cluster:${row.track_id}`
                    }
                    onPress={() =>
                      saveClusterReward(
                        row
                      )
                    }
                    style={
                      styles.smallAction
                    }
                  >
                    <Text
                      style={
                        styles.smallActionText
                      }
                    >
                      {busyKey ===
                      `cluster:${row.track_id}`
                        ? 'SAVING...'
                        : 'SAVE'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })}

        <SectionTitle>
          REWARD MEMBER
        </SectionTitle>

        <Card>
          <Text style={styles.infoTitle}>
            All verified members are qualified
          </Text>

          <Text style={styles.infoText}>
            Search for a verified member to issue a Bayanihan reward.
          </Text>

          <View
            style={styles.searchLine}
          >
            <TextInput
              style={[
                styles.input,
                styles.searchInput,
              ]}
              placeholder="Search member, Local, or Group..."
              value={memberSearch}
              returnKeyType="search"
              onChangeText={(value) => {
                setMemberSearch(
                  value
                );

                if (!value.trim()) {
                  setMemberSearchApplied(
                    ''
                  );
                }
              }}
              onSubmitEditing={() =>
                setMemberSearchApplied(
                  memberSearch.trim()
                )
              }
            />

            <Pressable
              onPress={() =>
                setMemberSearchApplied(
                  memberSearch.trim()
                )
              }
              style={
                styles.smallAction
              }
            >
              <Text
                style={
                  styles.smallActionText
                }
              >
                SEARCH
              </Text>
            </Pressable>
          </View>

          {!!memberSearchApplied && (
            <View
              style={styles.memberList}
            >
              {filteredMembers.length ===
              0 ? (
                <Text
                  style={shared.muted}
                >
                  No verified member found.
                </Text>
              ) : (
                filteredMembers.map(
                  row => {
                    const selected =
                      row.user_id ===
                      selectedMemberId;

                    return (
                      <Pressable
                        key={row.user_id}
                        onPress={() =>
                          setSelectedMemberId(
                            row.user_id
                          )
                        }
                        style={[
                          styles.memberRow,
                          selected &&
                            styles.memberRowOn,
                        ]}
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.memberName
                            }
                            numberOfLines={1}
                          >
                            {row.full_name}
                          </Text>

                          <Text
                            style={
                              styles.memberMeta
                            }
                            numberOfLines={1}
                          >
                            {row.church_name ||
                              'No Local'}
                            {' | '}
                            {row.group_name ||
                              'No Cluster'}
                          </Text>
                        </View>

                        {selected && (
                          <Text
                            style={
                              styles.selected
                            }
                          >
                            SELECTED
                          </Text>
                        )}
                      </Pressable>
                    );
                  }
                )
              )}
            </View>
          )}
        </Card>

        {!!selectedMember && (
          <Card>
            <Text
              style={
                styles.clusterTitle
              }
            >
              Reward{' '}
              {
                selectedMember.full_name
              }
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Reward amount"
              value={rewardAmount}
              onChangeText={
                setRewardAmount
              }
              keyboardType="decimal-pad"
            />

            <TextInput
              style={[
                styles.input,
                styles.noteInput,
              ]}
              placeholder="Reason / note (optional)"
              value={rewardNote}
              onChangeText={
                setRewardNote
              }
              multiline
            />

            <Button
              title={
                busyKey ===
                `member:${selectedMember.user_id}`
                  ? 'REWARDING...'
                  : 'REWARD MEMBER'
              }
              onPress={rewardMember}
            />
          </Card>
        )}

        <SectionTitle>
          BAYANIHAN LEADERBOARD
        </SectionTitle>

        {renderLeaderboard(
          monthlyLeaders,
          'Top 5 This Month',
          'Based on Bayanihan earned during the current month.'
        )}

        {renderLeaderboard(
          leaders,
          'Top 5 Overall',
          'Based on total Bayanihan earned all time.'
        )}

      </ScrollView>
    </AdminGate>
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding: 18,
      paddingBottom: 50,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.greenDark,
      marginBottom: 4,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },
    infoText: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    clusterTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.text,
    },
    meta: {
      marginTop: 5,
      fontSize: 11,
      lineHeight: 17,
      color: colors.muted,
    },
    input: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
      backgroundColor:
        colors.white,
    },
    noteInput: {
      minHeight: 72,
      textAlignVertical: 'top',
      marginBottom: 8,
    },
    memberList: {
      gap: 7,
      marginTop: 10,
      maxHeight: 440,
    },
    memberRow: {
      padding: 11,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      backgroundColor:
        colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    memberRowOn: {
      borderColor: colors.green,
      backgroundColor:
        colors.greenSoft,
    },
    memberName: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },
    memberMeta: {
      marginTop: 3,
      fontSize: 10.5,
      color: colors.muted,
    },
    balance: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '900',
      color: colors.greenDark,
    },
    selected: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.greenDark,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    rankCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },
    rankText: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.greenDark,
    },
    leaderStats: {
      marginTop: 5,
      fontSize: 11,
      fontWeight: '800',
      color: colors.greenDark,
    },
    clusterLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    clusterOneLine: {
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },

    smallAction: {
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    smallActionText: {
      fontSize: 9.5,
      fontWeight: '900',
      color: colors.greenDark,
    },

    rewardEditRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    rewardEditInput: {
      flex: 1,
      marginTop: 0,
      paddingVertical: 8,
    },

    searchLine: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    searchInput: {
      flex: 1,
      marginTop: 0,
    },

    compactLeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 9,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.line,
    },

    compactLeaderName: {
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },

    compactLeaderAmount: {
      fontSize: 11,
      fontWeight: '900',
      color: colors.greenDark,
    },

  });