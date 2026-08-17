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
  PendingChurchVerification,
  pendingChurchVerifications,
  reviewChurchVerification,
} from '@/lib/buklodChurches';

function msg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  return String(e || 'Unknown error');
}

export default function ChurchVerificationAdminScreen() {
  const [rows, setRows] =
    useState<PendingChurchVerification[]>([]);

  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(
    async (refresh = false) => {
      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        setRows(
          await pendingChurchVerifications()
        );
      } catch (e) {
        Alert.alert(
          'Church Verification',
          msg(e)
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

  async function review(
    row: PendingChurchVerification,
    approve: boolean
  ) {
    try {
      await reviewChurchVerification(
        row.request_id,
        approve,
        notes[row.request_id] || ''
      );

      await load(true);
    } catch (e) {
      Alert.alert(
        'Church Verification',
        msg(e)
      );
    }
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
        />
      }
    >
      <View style={s.hero}>
        <Text style={s.eyebrow}>
          SYSTEM ADMIN
        </Text>

        <Text style={s.title}>
          Church Verification
        </Text>

        <Text style={s.meta}>
          Review pending Church registrations
          before they become verified BUKLOD Churches.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : rows.length === 0 ? (
        <View style={s.card}>
          <Text style={s.meta}>
            No pending Church verification.
          </Text>
        </View>
      ) : (
        rows.map((row) => {
          const location = [
            row.address_line,
            row.barangay,
            row.city_municipality,
            row.province,
            row.country,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <View
              key={row.request_id}
              style={s.card}
            >
              <Text style={s.name}>
                {row.church_name}
              </Text>

              <Text style={s.meta}>
                Submitted by: {row.submitter_name}
              </Text>

              <Text style={s.meta}>
                Authority: {row.authority_role}
              </Text>

              {!!row.denomination && (
                <Text style={s.meta}>
                  Denomination: {row.denomination}
                </Text>
              )}

              {!!row.senior_pastor_name && (
                <Text style={s.meta}>
                  Pastor: {row.senior_pastor_name}
                </Text>
              )}

              {!!location && (
                <Text style={s.meta}>
                  Location: {location}
                </Text>
              )}

              <Text style={s.meta}>
                Contact:{' '}
                {row.contact_email ||
                  row.contact_mobile ||
                  '-'}
              </Text>

              {!!row.website && (
                <Text style={s.meta}>
                  Website/Page: {row.website}
                </Text>
              )}

              {!!row.proof_reference && (
                <Text style={s.meta}>
                  Proof/reference:{' '}
                  {row.proof_reference}
                </Text>
              )}

              {!!row.submit_note && (
                <Text style={s.note}>
                  Applicant note: {row.submit_note}
                </Text>
              )}

              <TextInput
                style={s.input}
                placeholder="Review note / reason..."
                value={
                  notes[row.request_id] || ''
                }
                onChangeText={(value) =>
                  setNotes((current) => ({
                    ...current,
                    [row.request_id]: value,
                  }))
                }
                multiline
              />

              <View style={s.actions}>
                <Pressable
                  style={s.approve}
                  onPress={() =>
                    Alert.alert(
                      'Approve Church',
                      `Verify ${row.church_name}?`,
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                        },
                        {
                          text: 'Approve',
                          onPress: () =>
                            void review(
                              row,
                              true
                            ),
                        },
                      ]
                    )
                  }
                >
                  <Text style={s.actionText}>
                    APPROVE
                  </Text>
                </Pressable>

                <Pressable
                  style={s.reject}
                  onPress={() =>
                    Alert.alert(
                      'Reject Church',
                      `Reject ${row.church_name}?`,
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                        },
                        {
                          text: 'Reject',
                          style: 'destructive',
                          onPress: () =>
                            void review(
                              row,
                              false
                            ),
                        },
                      ]
                    )
                  }
                >
                  <Text style={s.actionText}>
                    REJECT
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  hero: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E7E3',
  },
  eyebrow: {
    color: '#2D6A4F',
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    color: '#19362A',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 3,
  },
  meta: {
    color: '#66756D',
    lineHeight: 19,
    fontSize: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 5,
  },
  name: {
    color: '#243C31',
    fontWeight: '900',
    fontSize: 18,
  },
  note: {
    marginTop: 6,
    backgroundColor: '#F6F7F6',
    padding: 9,
    borderRadius: 9,
    color: '#4E5F56',
  },
  input: {
    marginTop: 8,
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  approve: {
    minHeight: 42,
    flex: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  reject: {
    minHeight: 42,
    flex: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9E2A2B',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
