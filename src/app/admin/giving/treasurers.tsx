import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { AdminGate } from '@/components/AdminGate';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Church = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  full_name: string | null;
};

type TreasurerAssignment = {
  id: string;
  church_id: string;
  user_id: string;
  is_active: boolean;
  assigned_at: string;
  ended_at: string | null;
  full_name?: string | null;
};

export default function TreasurerAssignmentsScreen() {
  const { user } = useAuth();

  const [churches, setChurches] = useState<Church[]>([]);
  const [churchId, setChurchId] = useState('');

  const [members, setMembers] = useState<Member[]>([]);
  const [treasurers, setTreasurers] =
    useState<TreasurerAssignment[]>([]);

  const [selectedUserId, setSelectedUserId] =
    useState('');

  const [saving, setSaving] = useState(false);

  const selectedChurch = useMemo(
    () =>
      churches.find(
        (church) => church.id === churchId
      ) ?? null,
    [churches, churchId]
  );

  const activeTreasurerIds = useMemo(
    () =>
      new Set(
        treasurers
          .filter((item) => item.is_active)
          .map((item) => item.user_id)
      ),
    [treasurers]
  );

  const assignableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          !activeTreasurerIds.has(member.id)
      ),
    [members, activeTreasurerIds]
  );

  const loadChurches = useCallback(async () => {
    const { data, error } = await supabase
      .from('churches')
      .select('id,name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      Alert.alert(
        'Local Churches',
        error.message
      );
      return;
    }

    const rows = (data ?? []) as Church[];

    setChurches(rows);

    setChurchId((current) =>
      current || rows[0]?.id || ''
    );
  }, []);

  const loadMembers = useCallback(async () => {
    if (!churchId) {
      setMembers([]);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,full_name')
      .eq('church_id', churchId)
      .order('full_name');

    if (error) {
      Alert.alert(
        'Church Members',
        error.message
      );
      return;
    }

    setMembers((data ?? []) as Member[]);
  }, [churchId]);

  const loadTreasurers =
    useCallback(async () => {
      if (!churchId) {
        setTreasurers([]);
        return;
      }

      const { data, error } = await supabase
        .from('church_treasurers')
        .select(`
          id,
          church_id,
          user_id,
          is_active,
          assigned_at,
          ended_at
        `)
        .eq('church_id', churchId)
        .order('is_active', {
          ascending: false,
        })
        .order('assigned_at', {
          ascending: false,
        });

      if (error) {
        Alert.alert(
          'Treasurers',
          error.message
        );
        return;
      }

      const assignments =
        (data ?? []) as TreasurerAssignment[];

      if (!assignments.length) {
        setTreasurers([]);
        return;
      }

      const userIds = Array.from(
        new Set(
          assignments.map(
            (item) => item.user_id
          )
        )
      );

      const { data: profileRows } =
        await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', userIds);

      const nameMap = new Map(
        (profileRows ?? []).map(
          (profile: any) => [
            profile.id,
            profile.full_name,
          ]
        )
      );

      setTreasurers(
        assignments.map((item) => ({
          ...item,
          full_name:
            nameMap.get(item.user_id) ??
            'BUKLOD Member',
        }))
      );
    }, [churchId]);

  useEffect(() => {
    loadChurches();
  }, [loadChurches]);

  useEffect(() => {
    setSelectedUserId('');
    loadMembers();
    loadTreasurers();
  }, [
    churchId,
    loadMembers,
    loadTreasurers,
  ]);

  const assignTreasurer = async () => {
    if (!user) return;

    if (!churchId) {
      Alert.alert(
        'Local Church',
        'Please select a Local Church.'
      );
      return;
    }

    if (!selectedUserId) {
      Alert.alert(
        'Treasurer',
        'Please select a member to assign as Treasurer.'
      );
      return;
    }

    try {
      setSaving(true);

      const now =
        new Date().toISOString();

      const { error } = await supabase
        .from('church_treasurers')
        .upsert(
          {
            church_id: churchId,
            user_id: selectedUserId,
            is_active: true,
            assigned_by: user.id,
            assigned_at: now,
            ended_at: null,
          },
          {
            onConflict:
              'church_id,user_id',
          }
        );

      if (error) throw error;

      setSelectedUserId('');

      await loadTreasurers();

      Alert.alert(
        'Treasurer Assigned',
        'The member can now verify giving submissions for this Local Church.'
      );
    } catch (error: any) {
      Alert.alert(
        'Could Not Assign',
        error?.message ||
          'Could not assign the Treasurer.'
      );
    } finally {
      setSaving(false);
    }
  };

  const endAssignment = (
    assignment: TreasurerAssignment
  ) => {
    Alert.alert(
      'End Treasurer Assignment',
      `Remove ${
        assignment.full_name ||
        'this member'
      } as Treasurer of ${
        selectedChurch?.name ||
        'this Local Church'
      }?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } =
              await supabase
                .from(
                  'church_treasurers'
                )
                .update({
                  is_active: false,
                  ended_at:
                    new Date().toISOString(),
                })
                .eq(
                  'id',
                  assignment.id
                );

            if (error) {
              Alert.alert(
                'Treasurer',
                error.message
              );
              return;
            }

            await loadTreasurers();
          },
        },
      ]
    );
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={
          shared.content
        }
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>
            ‹ BACK TO TITHES & GIVING
          </Text>
        </Pressable>

        <Text style={shared.h1}>
          Treasurer Assignments
        </Text>

        <Text style={shared.muted}>
          Assign authorized Treasurers
          for each Local Church. Treasurer
          authority applies only to the
          assigned church.
        </Text>

        <SectionTitle>
          LOCAL CHURCH
        </SectionTitle>

        <View style={styles.wrap}>
          {churches.map((church) => {
            const selected =
              church.id === churchId;

            return (
              <Pressable
                key={church.id}
                onPress={() =>
                  setChurchId(church.id)
                }
                style={[
                  styles.chip,
                  selected &&
                    styles.chipOn,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected &&
                      styles.chipTextOn,
                  ]}
                >
                  {church.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>
          ACTIVE TREASURERS
        </SectionTitle>

        {treasurers.filter(
          (item) => item.is_active
        ).length === 0 ? (
          <Card>
            <Text style={shared.muted}>
              No active Treasurer assigned
              to{' '}
              {selectedChurch?.name ||
                'this Local Church'}.
            </Text>
          </Card>
        ) : (
          treasurers
            .filter(
              (item) => item.is_active
            )
            .map((item) => (
              <Card key={item.id}>
                <Text style={styles.name}>
                  {item.full_name ||
                    'BUKLOD Member'}
                </Text>

                <Text style={shared.muted}>
                  Active Local Church
                  Treasurer
                </Text>

                <Pressable
                  onPress={() =>
                    endAssignment(item)
                  }
                  style={
                    styles.removeButton
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    REMOVE TREASURER
                  </Text>
                </Pressable>
              </Card>
            ))
        )}

        <SectionTitle>
          ASSIGN TREASURER
        </SectionTitle>

        <Card>
          <Text style={styles.label}>
            SELECT MEMBER
          </Text>

          {assignableMembers.length ===
          0 ? (
            <Text style={shared.muted}>
              No additional members
              available for assignment.
            </Text>
          ) : (
            <View style={styles.wrap}>
              {assignableMembers.map(
                (member) => {
                  const selected =
                    member.id ===
                    selectedUserId;

                  return (
                    <Pressable
                      key={member.id}
                      onPress={() =>
                        setSelectedUserId(
                          member.id
                        )
                      }
                      style={[
                        styles.memberChip,
                        selected &&
                          styles.memberChipOn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.memberText,
                          selected &&
                            styles.memberTextOn,
                        ]}
                      >
                        {member.full_name ||
                          'BUKLOD Member'}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}

          <View
            style={{ marginTop: 15 }}
          >
            <Button
              title={
                saving
                  ? 'ASSIGNING...'
                  : 'ASSIGN AS TREASURER'
              }
              onPress={
                assignTreasurer
              }
            />
          </View>
        </Card>

        <SectionTitle>
          PREVIOUS ASSIGNMENTS
        </SectionTitle>

        {treasurers.filter(
          (item) => !item.is_active
        ).length === 0 ? (
          <Card>
            <Text style={shared.muted}>
              No previous Treasurer
              assignments.
            </Text>
          </Card>
        ) : (
          treasurers
            .filter(
              (item) => !item.is_active
            )
            .map((item) => (
              <Card key={item.id}>
                <Text style={styles.name}>
                  {item.full_name ||
                    'BUKLOD Member'}
                </Text>

                <Text style={shared.muted}>
                  Previous Treasurer
                </Text>
              </Card>
            ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  backText: {
    color: colors.green,
    fontWeight: '900',
    fontSize: 11,
  },

  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8E3DC',
    backgroundColor: '#FFFFFF',
  },

  chipOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },

  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.green,
  },

  chipTextOn: {
    color: '#FFFFFF',
  },

  name: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1D2B23',
  },

  label: {
    marginBottom: 10,
    fontSize: 10,
    fontWeight: '900',
    color: colors.green,
    letterSpacing: 0.8,
  },

  memberChip: {
    borderWidth: 1,
    borderColor: '#D8E3DC',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  memberChipOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },

  memberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#26342C',
  },

  memberTextOn: {
    color: '#FFFFFF',
  },

  removeButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#A73A3A',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  removeText: {
    color: '#A73A3A',
    fontSize: 9,
    fontWeight: '900',
  },
});