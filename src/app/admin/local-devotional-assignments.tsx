import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
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

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Church = {
  church_id: string;
  church_name: string;
  church_code: string | null;
};

type Series = {
  series_id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};

export default function LocalDevotionalAssignmentsScreen() {
  const { hasAnyRole } = useAuth();

  const allowed = hasAnyRole([
    'pastor',
    'local_admin',
    'system_admin',
  ]);

  const db = supabase as any;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [churches, setChurches] =
    useState<Church[]>([]);

  const [series, setSeries] =
    useState<Series[]>([]);

  const [churchId, setChurchId] =
    useState('');

  const [seriesId, setSeriesId] =
    useState('');

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        churchResult,
        seriesResult,
      ] = await Promise.all([
        db.rpc(
          'get_my_manageable_churches'
        ),

        db.rpc(
          'get_manageable_devotional_series'
        ),
      ]);

      if (churchResult.error) {
        throw churchResult.error;
      }

      if (seriesResult.error) {
        throw seriesResult.error;
      }

      const loadedChurches =
        churchResult.data ?? [];

      setChurches(loadedChurches);
      setSeries(seriesResult.data ?? []);

      if (
        !churchId &&
        loadedChurches.length === 1
      ) {
        setChurchId(
          loadedChurches[0].church_id
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Devotional Assignment',
        error?.message ||
          'Could not load assignment options.'
      );
    } finally {
      setLoading(false);
    }
  }, [allowed, churchId, db]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedChurch =
    churches.find(
      (item) =>
        item.church_id === churchId
    ) ?? null;

  const selectedSeries =
    series.find(
      (item) =>
        item.series_id === seriesId
    ) ?? null;

  const assign = () => {
    if (!churchId) {
      return Alert.alert(
        'Local Church',
        'Select a Local Church.'
      );
    }

    if (!seriesId) {
      return Alert.alert(
        'Devotional Series',
        'Select a Devotional Series.'
      );
    }

    Alert.alert(
      'Assign to Whole Local?',
      `${selectedSeries?.title || 'This series'} will become the active devotional series of all active members of ${selectedChurch?.church_name || 'the selected Local'}. Existing active series assignments will be replaced.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Assign to Local',
          onPress: async () => {
            setBusy(true);

            try {
              const {
                data,
                error,
              } = await db.rpc(
                'manage_assign_devotional_series_to_church',
                {
                  p_church_id:
                    churchId,

                  p_series_id:
                    seriesId,

                  p_starts_on:
                    new Date()
                      .toISOString()
                      .slice(0, 10),

                  p_note:
                    'Whole-Local assignment from BUKLOD management',
                }
              );

              if (error) throw error;

              Alert.alert(
                'Assignment Complete',
                `${Number(data ?? 0)} active members were assigned to ${selectedSeries?.title || 'the selected devotional series'}.`
              );
            } catch (error: any) {
              Alert.alert(
                'Assignment Failed',
                error?.message ||
                  'Could not assign the series.'
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

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
            Local Devotional Assignment
          </Text>

          <Text
            style={[
              shared.muted,
              { marginTop: 6 },
            ]}
          >
            Pastor or Admin access is required.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.eyebrow}>
        FORMATION MANAGEMENT
      </Text>

      <Text style={shared.h1}>
        Local Devotional Assignment
      </Text>

      <Text
        style={[
          shared.muted,
          { marginTop: 5 },
        ]}
      >
        Assign one published Devotional Series
        to all active members of an authorized
        Local Church.
      </Text>

      <SectionTitle>
        STEP 1 — LOCAL CHURCH
      </SectionTitle>

      <Card>
        {loading && (
          <ActivityIndicator
            color={colors.green}
          />
        )}

        {!loading &&
          churches.length === 0 && (
            <Text style={shared.muted}>
              No manageable Local Church
              assignments were found.
            </Text>
          )}

        <View style={styles.choices}>
          {churches.map(
            (church) => {
              const selected =
                churchId ===
                church.church_id;

              return (
                <Pressable
                  key={
                    church.church_id
                  }
                  onPress={() =>
                    setChurchId(
                      church.church_id
                    )
                  }
                  style={[
                    styles.choice,
                    selected &&
                      styles.choiceOn,
                  ]}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.choiceTitle
                      }
                    >
                      {
                        church.church_name
                      }
                    </Text>

                    {!!church.church_code && (
                      <Text
                        style={
                          shared.muted
                        }
                      >
                        {
                          church.church_code
                        }
                      </Text>
                    )}
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
          )}
        </View>
      </Card>

      <SectionTitle>
        STEP 2 — DEVOTIONAL SERIES
      </SectionTitle>

      <Card>
        {series.length === 0 &&
          !loading && (
            <Text style={shared.muted}>
              No published Devotional
              Series are currently
              available.
            </Text>
          )}

        <View style={styles.choices}>
          {series.map(
            (item) => {
              const selected =
                seriesId ===
                item.series_id;

              return (
                <Pressable
                  key={
                    item.series_id
                  }
                  onPress={() =>
                    setSeriesId(
                      item.series_id
                    )
                  }
                  style={[
                    styles.choice,
                    selected &&
                      styles.choiceOn,
                  ]}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.choiceTitle
                      }
                    >
                      {item.title}
                    </Text>

                    {!!item.description && (
                      <Text
                        style={[
                          shared.muted,
                          {
                            marginTop: 3,
                          },
                        ]}
                        numberOfLines={3}
                      >
                        {
                          item.description
                        }
                      </Text>
                    )}
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
          )}
        </View>
      </Card>

      <SectionTitle>
        CONFIRM ASSIGNMENT
      </SectionTitle>

      <Card>
        <Field
          label="LOCAL"
          value={
            selectedChurch
              ?.church_name ||
            'Not selected'
          }
        />

        <View style={styles.line} />

        <Field
          label="DEVOTIONAL SERIES"
          value={
            selectedSeries?.title ||
            'Not selected'
          }
        />

        <View
          style={{
            marginTop: 16,
          }}
        >
          <Button
            title={
              busy
                ? 'ASSIGNING...'
                : 'ASSIGN SERIES TO WHOLE LOCAL'
            }
            onPress={assign}
          />
        </View>
      </Card>

      <View
        style={{
          marginTop: 15,
        }}
      >
        <Button
          title="VIEW LOCAL MEMBERS"
          outline
          onPress={() =>
            router.push(
              '/admin/local-members' as any
            )
          }
        />
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={shared.h2}>
        {value}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding: 18,
      paddingBottom: 50,
    },

    center: {
      justifyContent: 'center',
      padding: 20,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color: colors.greenDark,
      marginBottom: 4,
    },

    choices: {
      gap: 8,
    },

    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 13,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor:
        colors.white,
    },

    choiceOn: {
      borderColor: colors.green,
      backgroundColor:
        colors.greenSoft,
    },

    choiceTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },

    selected: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.greenDark,
    },

    label: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.muted,
      marginBottom: 4,
    },

    line: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: 13,
    },
  });