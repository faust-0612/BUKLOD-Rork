import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  AdminGate,
} from '@/components/AdminGate';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';


type SponsorStatus =
  | 'pending'
  | 'approved'
  | 'rejected';


type Sponsor = {
  id: string;

  sponsor_name: string;
  headline: string;

  target_url: string | null;

  placement:
    | 'all'
    | 'home'
    | 'messages'
    | 'learn'
    | 'community'
    | 'prayer';

  status: SponsorStatus;

  policy_confirmed: boolean;

  is_active: boolean;

  starts_at: string;
  ends_at: string | null;

  approved_at: string | null;
  rejected_at: string | null;

  created_at: string;
};


const PLACEMENTS = [
  'all',
  'home',
  'messages',
  'learn',
  'community',
  'prayer',
] as const;


const PROHIBITED = [
  'Gambling, casino, betting or lottery promotions',
  'Nudity, sexual or sexually suggestive content',
  'Dating or adult-oriented services',
  'Alcohol products or drinking promotions',
  'Tobacco, cigarettes, vape or nicotine products',
  'Illegal drugs, illegal goods or unlawful services',
  'Scams, deceptive offers or predatory financial schemes',
  'Hateful, violent or otherwise inappropriate material',
];


export default function SponsorAdminScreen() {

  const [rows, setRows] =
    useState<Sponsor[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [busyId, setBusyId] =
    useState<string | null>(null);


  const [sponsorName, setSponsorName] =
    useState('');

  const [headline, setHeadline] =
    useState('');

  const [targetUrl, setTargetUrl] =
    useState('');

  const [placement, setPlacement] =
    useState<
      typeof PLACEMENTS[number]
    >('all');

  const [
    policyConfirmed,
    setPolicyConfirmed,
  ] = useState(false);


  const load =
    useCallback(async () => {

      setLoading(true);

      const {
        data,
        error,
      } = await supabase
        .from('app_sponsors')
        .select(`
          id,
          sponsor_name,
          headline,
          target_url,
          placement,
          status,
          policy_confirmed,
          is_active,
          starts_at,
          ends_at,
          approved_at,
          rejected_at,
          created_at
        `)
        .order(
          'created_at',
          {
            ascending: false,
          }
        );


      if (error) {

        Alert.alert(
          'Sponsor Management',
          error.message
        );

        setRows([]);
        setLoading(false);

        return;
      }


      setRows(
        (data ?? []) as Sponsor[]
      );

      setLoading(false);

    }, []);


  useEffect(() => {
    void load();
  }, [load]);


  const createSponsor =
    async () => {

      const name =
        sponsorName.trim();

      const title =
        headline.trim();

      if (!name || !title) {

        Alert.alert(
          'Required Information',
          'Enter the sponsor/business name and advertisement headline.'
        );

        return;
      }


      if (!policyConfirmed) {

        Alert.alert(
          'Advertising Policy',
          'You must review and confirm that the advertisement contains no prohibited BUKLOD advertising content.'
        );

        return;
      }


      const {
        error,
      } = await supabase
        .from('app_sponsors')
        .insert({
          sponsor_name: name,
          headline: title,

          target_url:
            targetUrl.trim() || null,

          placement,

          status: 'pending',

          policy_confirmed: true,

          policy_confirmed_at:
            new Date().toISOString(),

          is_active: false,
        });


      if (error) {

        Alert.alert(
          'Create Sponsor',
          error.message
        );

        return;
      }


      setSponsorName('');
      setHeadline('');
      setTargetUrl('');
      setPlacement('all');
      setPolicyConfirmed(false);

      Alert.alert(
        'Sponsor Saved',
        'The advertisement is Pending. It will not appear in BUKLOD until approved.'
      );

      await load();
    };


  const updateSponsor =
    async (
      id: string,
      values: Record<string, unknown>,
      successMessage: string
    ) => {

      setBusyId(id);

      const {
        error,
      } = await supabase
        .from('app_sponsors')
        .update(values)
        .eq('id', id);


      setBusyId(null);


      if (error) {

        Alert.alert(
          'Sponsor Management',
          error.message
        );

        return;
      }


      await load();

      Alert.alert(
        'Sponsor Management',
        successMessage
      );
    };


  const approve =
    async (
      item: Sponsor
    ) => {

      if (!item.policy_confirmed) {

        Alert.alert(
          'Policy Review Required',
          'Confirm the BUKLOD Advertising Policy before approving this advertisement.'
        );

        return;
      }


      await updateSponsor(
        item.id,
        {
          status: 'approved',
          is_active: true,
        },
        'Advertisement approved and activated.'
      );
    };


  const reject =
    async (
      item: Sponsor
    ) => {

      await updateSponsor(
        item.id,
        {
          status: 'rejected',
          is_active: false,
          rejection_reason:
            'Rejected by System Administrator after content review.',
        },
        'Advertisement rejected.'
      );
    };


  const toggleActive =
    async (
      item: Sponsor
    ) => {

      if (
        item.status !== 'approved'
      ) {

        Alert.alert(
          'Not Approved',
          'Only approved advertisements may be activated.'
        );

        return;
      }


      await updateSponsor(
        item.id,
        {
          is_active:
            !item.is_active,
        },
        item.is_active
          ? 'Advertisement paused.'
          : 'Advertisement activated.'
      );
    };


  const statusColor =
    (status: SponsorStatus) => {

      if (status === 'approved') {
        return '#277A4D';
      }

      if (status === 'rejected') {
        return '#A33A3A';
      }

      return '#9A6B17';
    };


  return (
    <AdminGate>

      <FlatList
        style={shared.screen}
        contentContainerStyle={
          styles.content
        }
        data={rows}
        keyExtractor={
          item => item.id
        }
        refreshing={loading}
        onRefresh={load}

        ListHeaderComponent={
          <View>

            <Text style={styles.eyebrow}>
              BUKLOD ADVERTISING
            </Text>

            <Text style={shared.h1}>
              Sponsors & Ads
            </Text>

            <Text style={styles.intro}>
              Local advertisements require manual review and System Admin approval before they can appear in BUKLOD.
            </Text>


            <SectionTitle>
              BUKLOD ADVERTISING POLICY
            </SectionTitle>


            <Card>

              <Text style={styles.policyTitle}>
                PROHIBITED ADVERTISEMENTS
              </Text>

              {PROHIBITED.map(
                item => (
                  <View
                    key={item}
                    style={
                      styles.policyRow
                    }
                  >
                    <MaterialCommunityIcons
                      name="close-circle-outline"
                      size={17}
                      color="#A33A3A"
                    />

                    <Text
                      style={
                        styles.policyText
                      }
                    >
                      {item}
                    </Text>
                  </View>
                )
              )}

              <Text
                style={
                  styles.policyNote
                }
              >
                BUKLOD reserves the right to reject any advertisement that conflicts with community safety, ministry values, applicable law, or platform policy.
              </Text>

            </Card>


            <SectionTitle>
              ADD LOCAL SPONSOR
            </SectionTitle>


            <Card>

              <Text style={styles.label}>
                BUSINESS / SPONSOR NAME
              </Text>

              <TextInput
                value={sponsorName}
                onChangeText={
                  setSponsorName
                }
                placeholder="Example: ABC Pharmacy"
                style={styles.input}
              />


              <Text style={styles.label}>
                AD HEADLINE
              </Text>

              <TextInput
                value={headline}
                onChangeText={
                  setHeadline
                }
                placeholder="Example: Medicines and health supplies"
                style={styles.input}
              />


              <Text style={styles.label}>
                LINK / CONTACT URL
              </Text>

              <TextInput
                value={targetUrl}
                onChangeText={
                  setTargetUrl
                }
                placeholder="https://... (optional)"
                autoCapitalize="none"
                style={styles.input}
              />


              <Text style={styles.label}>
                PLACEMENT
              </Text>


              <View style={styles.wrap}>

                {PLACEMENTS.map(
                  value => (

                    <Pressable
                      key={value}
                      onPress={() =>
                        setPlacement(
                          value
                        )
                      }
                      style={[
                        styles.chip,
                        placement ===
                          value &&
                          styles.chipOn,
                      ]}
                    >

                      <Text
                        style={[
                          styles.chipText,
                          placement ===
                            value &&
                            styles.chipTextOn,
                        ]}
                      >
                        {value.toUpperCase()}
                      </Text>

                    </Pressable>

                  )
                )}

              </View>


              <Pressable
                onPress={() =>
                  setPolicyConfirmed(
                    current =>
                      !current
                  )
                }
                style={
                  styles.confirmRow
                }
              >

                <MaterialCommunityIcons
                  name={
                    policyConfirmed
                      ? 'checkbox-marked-outline'
                      : 'checkbox-blank-outline'
                  }
                  size={23}
                  color={
                    policyConfirmed
                      ? colors.green
                      : colors.muted
                  }
                />

                <Text
                  style={
                    styles.confirmText
                  }
                >
                  I reviewed this advertisement and confirm that it contains no gambling, nude/sexual content, alcohol, tobacco/vape, illegal products, scams, or other prohibited material.
                </Text>

              </Pressable>


              <Button
                title="SAVE AS PENDING"
                onPress={
                  createSponsor
                }
              />

            </Card>


            <SectionTitle>
              SPONSOR REVIEW
            </SectionTitle>

          </View>
        }


        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={colors.green}
            />
          ) : (
            <Card>
              <Text style={shared.muted}>
                No sponsor advertisements yet.
              </Text>
            </Card>
          )
        }


        renderItem={({ item }) => (

          <Card>

            <View style={styles.topRow}>

              <View style={{ flex: 1 }}>

                <Text style={shared.h2}>
                  {item.sponsor_name}
                </Text>

                <Text
                  style={
                    styles.headline
                  }
                >
                  {item.headline}
                </Text>

              </View>


              <View
                style={[
                  styles.status,
                  {
                    borderColor:
                      statusColor(
                        item.status
                      ),
                  },
                ]}
              >

                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        statusColor(
                          item.status
                        ),
                    },
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>

              </View>

            </View>


            <Text style={styles.meta}>
              Placement: {item.placement.toUpperCase()}
            </Text>

            <Text style={styles.meta}>
              Policy reviewed:{' '}
              {item.policy_confirmed
                ? 'YES'
                : 'NO'}
            </Text>

            <Text style={styles.meta}>
              Display status:{' '}
              {item.is_active
                ? 'ACTIVE'
                : 'PAUSED'}
            </Text>


            {!!item.target_url && (
              <Text
                style={styles.link}
                numberOfLines={1}
              >
                {item.target_url}
              </Text>
            )}


            {busyId === item.id ? (
              <ActivityIndicator
                color={colors.green}
                style={{
                  marginTop: 12,
                }}
              />
            ) : (
              <View
                style={
                  styles.actionWrap
                }
              >

                {item.status !==
                  'approved' && (
                  <Pressable
                    onPress={() =>
                      void approve(
                        item
                      )
                    }
                    style={[
                      styles.action,
                      styles.approve,
                    ]}
                  >
                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      APPROVE
                    </Text>
                  </Pressable>
                )}


                {item.status !==
                  'rejected' && (
                  <Pressable
                    onPress={() =>
                      void reject(
                        item
                      )
                    }
                    style={[
                      styles.action,
                      styles.reject,
                    ]}
                  >
                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      REJECT
                    </Text>
                  </Pressable>
                )}


                {item.status ===
                  'approved' && (
                  <Pressable
                    onPress={() =>
                      void toggleActive(
                        item
                      )
                    }
                    style={[
                      styles.action,
                      styles.pause,
                    ]}
                  >
                    <Text
                      style={
                        styles.actionDarkText
                      }
                    >
                      {item.is_active
                        ? 'PAUSE'
                        : 'ACTIVATE'}
                    </Text>
                  </Pressable>
                )}

              </View>
            )}

          </Card>

        )}
      />

    </AdminGate>
  );
}


const styles =
  StyleSheet.create({

    content: {
      padding: 16,
      gap: 10,
      paddingBottom: 80,
    },

    eyebrow: {
      color: colors.green,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    intro: {
      marginTop: 5,
      color: colors.muted,
      lineHeight: 19,
    },

    policyTitle: {
      color: '#A33A3A',
      fontWeight: '900',
      marginBottom: 9,
    },

    policyRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      marginBottom: 7,
    },

    policyText: {
      flex: 1,
      color: colors.text,
      lineHeight: 18,
      fontSize: 12,
    },

    policyNote: {
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      color: colors.muted,
      fontSize: 11,
      lineHeight: 17,
    },

    label: {
      marginTop: 10,
      marginBottom: 5,
      color: colors.green,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 11,
      paddingHorizontal: 11,
      color: colors.text,
      backgroundColor: '#FFFFFF',
    },

    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    chip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: '#FFFFFF',
    },

    chipOn: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },

    chipText: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.green,
    },

    chipTextOn: {
      color: '#FFFFFF',
    },

    confirmRow: {
      marginTop: 16,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      padding: 11,
      borderRadius: 12,
      backgroundColor: '#F4F8F5',
      borderWidth: 1,
      borderColor: colors.line,
    },

    confirmText: {
      flex: 1,
      color: colors.text,
      lineHeight: 18,
      fontSize: 11,
      fontWeight: '700',
    },

    topRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },

    headline: {
      marginTop: 3,
      color: colors.muted,
    },

    status: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },

    statusText: {
      fontSize: 8,
      fontWeight: '900',
    },

    meta: {
      marginTop: 6,
      color: colors.muted,
      fontSize: 10.5,
    },

    link: {
      marginTop: 7,
      color: colors.green,
      fontSize: 10,
    },

    actionWrap: {
      marginTop: 13,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    action: {
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 9,
    },

    approve: {
      backgroundColor: '#277A4D',
    },

    reject: {
      backgroundColor: '#A33A3A',
    },

    pause: {
      backgroundColor: '#EDF2EF',
      borderWidth: 1,
      borderColor: colors.line,
    },

    actionText: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 9,
    },

    actionDarkText: {
      color: colors.green,
      fontWeight: '900',
      fontSize: 9,
    },

  });