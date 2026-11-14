import React, {
  useEffect,
  useRef,
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
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  placeholder?: string;
};

function Field({
  label,
  value,
  onChangeText,
  required = false,
  placeholder = '',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>

      <TextInput allowFontScaling
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A958F"
        style={styles.input}
      />
    </View>
  );
}

export default function
PersonalInformationScreen() {
  const {
    profile,
    refreshProfile,
  } = useAuth();

  const {
    refresh: refreshScopes,
  } = useBuklodScope();

  const [loading,setLoading] =
    useState(true);

  const [saving,setSaving] =
    useState(false);

  // The roster/localization triggers are expensive. Only write a section
  // when its actual form values differ from the last persisted values.
  const profileSnapshot = useRef<string | null>(null);
  const addressSnapshot = useRef<string | null>(null);
  const faithSnapshot = useRef<boolean | null>(null);

  const [firstName,setFirstName] =
    useState('');

  const [middleName,setMiddleName] =
    useState('');

  const [surname,setSurname] =
    useState('');

  const [suffix,setSuffix] =
    useState('');

  const [mobile,setMobile] =
    useState('');

  const [birthDate,setBirthDate] =
    useState('');

  const [sex,setSex] =
    useState('');

  const [addressLine,setAddressLine] =
    useState('');

  const [barangay,setBarangay] =
    useState('');

  const [cityMunicipality,setCityMunicipality] =
    useState('');

  const [province,setProvince] =
    useState('');

  const [country,setCountry] =
    useState('Philippines');

  const [postalCode,setPostalCode] =
    useState('');

  /* PATCH_178F_SHOW_FAITH_EDIT_INFO */
  const [
    showFaithContent,
    setShowFaithContent,
  ] =
    useState<boolean | null>(
      null
    );

  useEffect(
    () => {
      let alive =
        true;

      const loadFaithPreference =
        async () => {
          if (!profile?.id) {
            if (alive) {
              faithSnapshot.current = null;
              setShowFaithContent(
                null
              );
            }

            return;
          }

          const {
            data,
            error,
          } =
            await (supabase as any)
              .from(
                'buklod_user_preferences'
              )
              .select(
                'show_faith_content'
              )
              .eq(
                'user_id',
                profile.id
              )
              .maybeSingle();

          if (!alive) {
            return;
          }

          if (error) {
            console.warn(
              'Show Faith preference:',
              error.message
            );

            faithSnapshot.current = null;
            setShowFaithContent(
              null
            );

            return;
          }

          const preference = Boolean(data?.show_faith_content);
          faithSnapshot.current = preference;
          setShowFaithContent(preference);
        };

      void loadFaithPreference();

      return () => {
        alive =
          false;
      };
    },
    [
      profile?.id,
    ]
  );

  useEffect(() => {
    let alive = true;

    const load =
      async () => {
        if (!profile?.id) {
          if (alive) {
            setLoading(false);
          }
          return;
        }

        try {
          const [
            profileResult,
            addressResult,
          ] =
            await Promise.all([
              (supabase as any)
                .from('profiles')
                .select(
                  'first_name,middle_name,surname,suffix,mobile,birth_date,sex'
                )
                .eq(
                  'id',
                  profile.id
                )
                .maybeSingle(),

              (supabase as any)
                .from(
                  'buklod_user_addresses'
                )
                .select(
                  'address_line,barangay,city_municipality,province,country,postal_code,address_completed'
                )
                .eq(
                  'user_id',
                  profile.id
                )
                .maybeSingle(),
            ]);

          if (profileResult.error) {
            throw profileResult.error;
          }

          if (addressResult.error) {
            throw addressResult.error;
          }

          if (!alive) {
            return;
          }

          const p =
            profileResult.data ?? {};

          const a =
            addressResult.data ?? {};

          profileSnapshot.current = JSON.stringify([
            p.first_name, p.middle_name, p.surname, p.suffix,
            p.mobile, p.birth_date, p.sex,
          ].map(value => String(value ?? '').trim()));

          addressSnapshot.current = JSON.stringify([
            a.address_line, a.barangay, a.city_municipality,
            a.province, a.country ?? 'Philippines', a.postal_code,
          ].map(value => String(value ?? '').trim()).concat(
            String(a.address_completed === true)
          ));

          setFirstName(
            String(
              p.first_name ?? ''
            )
          );

          setMiddleName(
            String(
              p.middle_name ?? ''
            )
          );

          setSurname(
            String(
              p.surname ?? ''
            )
          );

          setSuffix(
            String(
              p.suffix ?? ''
            )
          );

          setMobile(
            String(
              p.mobile ?? ''
            )
          );

          setBirthDate(
            String(
              p.birth_date ?? ''
            )
          );

          setSex(
            String(
              p.sex ?? ''
            )
          );

          setAddressLine(
            String(
              a.address_line ?? ''
            )
          );

          setBarangay(
            String(
              a.barangay ?? ''
            )
          );

          setCityMunicipality(
            String(
              a.city_municipality ?? ''
            )
          );

          setProvince(
            String(
              a.province ?? ''
            )
          );

          setCountry(
            String(
              a.country ??
              'Philippines'
            )
          );

          setPostalCode(
            String(
              a.postal_code ?? ''
            )
          );
        }
        catch (error: any) {
          Alert.alert(
            'Personal Information',
            error?.message ??
              'Could not load your information.'
          );
        }
        finally {
          if (alive) {
            setLoading(false);
          }
        }
      };

    void load();

    return () => {
      alive = false;
    };
  }, [
    profile?.id,
  ]);

  const save =
    async () => {
      if (
        !profile?.id ||
        saving
      ) {
        return;
      }

      const first =
        firstName.trim();

      const last =
        surname.trim();

      const brgy =
        barangay.trim();

      const city =
        cityMunicipality.trim();

      const prov =
        province.trim();

      const nation =
        country.trim();

      if (
        !first ||
        !last
      ) {
        Alert.alert(
          'Required Information',
          'First Name and Surname are required.'
        );
        return;
      }

      if (
        !brgy ||
        !city ||
        !prov ||
        !nation
      ) {
        Alert.alert(
          'Important for Localization',
          'Barangay, Town / City, Province and Country are required so BUKLOD can determine your correct Local community.'
        );
        return;
      }

      const profileValues = JSON.stringify([
        first, middleName.trim(), last, suffix.trim(),
        mobile.trim(), birthDate.trim(), sex.trim(),
      ]);
      const addressValues = JSON.stringify([
        addressLine.trim(), brgy, city, prov, nation,
        postalCode.trim(), 'true',
      ]);
      const profileChanged = profileValues !== profileSnapshot.current;
      const addressChanged = addressValues !== addressSnapshot.current;
      const faithChanged = showFaithContent !== null &&
        showFaithContent !== faithSnapshot.current;

      if (!profileChanged && !addressChanged && !faithChanged) {
        Alert.alert('No Changes', 'Your information is already up to date.');
        return;
      }

      setSaving(true);
      const savedSections: string[] = [];

      try {
        if (profileChanged) {
          const fullName =
          [
            first,
            middleName.trim(),
            last,
            suffix.trim(),
          ]
            .filter(Boolean)
            .join(' ');

        const {
          error:
            profileError,
        } =
          await (supabase as any)
            .from('profiles')
            .update({
              first_name:
                first,

              middle_name:
                middleName.trim() ||
                null,

              surname:
                last,

              suffix:
                suffix.trim() ||
                null,

              full_name:
                fullName,

              mobile:
                mobile.trim() ||
                null,

              birth_date:
                birthDate.trim() ||
                null,

              sex:
                sex.trim() ||
                null,
            })
            .eq(
              'id',
              profile.id
            );

        if (profileError) {
          throw profileError;
        }

          profileSnapshot.current = profileValues;
          savedSections.push('personal information');
        }

        if (addressChanged) {
        const {
          error:
            addressError,
        } =
          await (supabase as any)
            .from(
              'buklod_user_addresses'
            )
            .upsert(
              {
                user_id:
                  profile.id,

                address_line:
                  addressLine.trim() ||
                  null,

                barangay:
                  brgy,

                city_municipality:
                  city,

                province:
                  prov,

                country:
                  nation,

                postal_code:
                  postalCode.trim() ||
                  null,

                address_completed:
                  true,
              },
              {
                onConflict:
                  'user_id',
              }
            );

        if (addressError) {
          throw addressError;
        }

          addressSnapshot.current = addressValues;
          savedSections.push('localization address');
        }

        /*
         * SHOW FAITH is an existing BUKLOD user preference.
         * Do not create a new profile column or migration.
         */
        if (faithChanged) {
          const {
            data:
              currentPreference,
            error:
              preferenceReadError,
          } =
            await (supabase as any)
              .from(
                'buklod_user_preferences'
              )
              .select(
                'faith_identity,onboarding_version,preferences_completed'
              )
              .eq(
                'user_id',
                profile.id
              )
              .maybeSingle();

          if (preferenceReadError) {
            throw preferenceReadError;
          }

          const {
            error:
              preferenceError,
          } =
            await (supabase as any)
              .from(
                'buklod_user_preferences'
              )
              .upsert(
                {
                  user_id:
                    profile.id,

                  faith_identity:
                    currentPreference
                      ?.faith_identity ??
                    'PREFER_NOT_TO_SAY',

                  show_faith_content:
                    showFaithContent,

                  onboarding_version:
                    currentPreference
                      ?.onboarding_version ??
                    1,

                  preferences_completed:
                    currentPreference
                      ?.preferences_completed ??
                    true,
                },
                {
                  onConflict:
                    'user_id',
                }
              );

          if (preferenceError) {
            throw preferenceError;
          }

          faithSnapshot.current = showFaithContent;
          savedSections.push('Show Faith preference');
        }

        const refreshes: Promise<unknown>[] = [];
        if (profileChanged) refreshes.push(Promise.resolve().then(refreshProfile));
        if (addressChanged || faithChanged) {
          refreshes.push(Promise.resolve().then(refreshScopes));
        }
        const refreshResults = await Promise.allSettled(refreshes);
        const refreshFailed = refreshResults.some(result =>
          result.status === 'rejected'
        );

        Alert.alert(
          'Saved',
          `Updated: ${savedSections.join(', ')}.` +
          (refreshFailed ? ' Reopen this page if the latest settings are not visible yet.' : '')
        );
      }
      catch (error: any) {
        console.warn('Personal information save failed:', error);
        const timeout = error?.code === '57014' ||
          /statement timeout|timed out/i.test(String(error?.message ?? ''));
        const partial = savedSections.length > 0
          ? `Saved: ${savedSections.join(', ')}. `
          : '';
        Alert.alert(
          'Could Not Save',
          partial + (timeout
            ? 'The server took too long. Your remaining edits are still here; please try saving again.'
            : 'Some changes could not be saved. Please try again. Your edits are still on this screen.')
        );
      }
      finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#275D45"
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() =>
            router.back()
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#275D45"
          />
        </Pressable>

        <View style={{flex:1}}>
          <Text style={styles.title}>
            Edit My Personal Information
          </Text>

          <Text style={styles.subtitle}>
            Keep your BUKLOD identity and localization information complete.
          </Text>
        </View>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons
          name="map-marker-radius-outline"
          size={26}
          color="#275D45"
        />

        <View style={{flex:1}}>
          <Text style={styles.noticeTitle}>
            Important for Localization
          </Text>

          <Text style={styles.noticeText}>
            Barangay, Town / City, Province and Country are used to determine your correct BUKLOD Local communities. Your exact residential address remains private.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Personal Information
        </Text>

        <Field
          label="First Name"
          required
          value={firstName}
          onChangeText={setFirstName}
        />

        <Field
          label="Middle Name"
          value={middleName}
          onChangeText={setMiddleName}
        />

        <Field
          label="Surname"
          required
          value={surname}
          onChangeText={setSurname}
        />

        <Field
          label="Suffix"
          value={suffix}
          onChangeText={setSuffix}
          placeholder="Jr., Sr., III"
        />

        <Field
          label="Mobile Number"
          value={mobile}
          onChangeText={setMobile}
        />

        <Field
          label="Birth Date"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="YYYY-MM-DD"
        />

        <Field
          label="Sex"
          value={sex}
          onChangeText={setSex}
          placeholder="male / female"
        />
      </View>

      <View
        style={[
          styles.card,
          {
            borderColor:
              'rgba(39,93,69,0.14)',

            backgroundColor:
              '#F8FCF9',
          },
        ]}
      >
        <View
          style={{
            flexDirection:
              'row',

            alignItems:
              'center',

            justifyContent:
              'space-between',
          }}
        >
          <View
            style={{
              flex:
                1,

              paddingRight:
                16,
            }}
          >
            <View
              style={{
                flexDirection:
                  'row',

                alignItems:
                  'center',

                marginBottom:
                  6,
              }}
            >
              <View
                style={{
                  width:
                    36,

                  height:
                    36,

                  borderRadius:
                    12,

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  marginRight:
                    10,

                  backgroundColor:
                    '#E4F3E9',
                }}
              >
                <MaterialCommunityIcons
                  name="heart-outline"
                  size={20}
                  color="#275D45"
                />
              </View>

              <View
                style={{
                  flex:
                    1,
                }}
              >
                <Text
                  style={{
                    color:
                      '#183B2B',

                    fontSize:
                      14,

                    fontWeight:
                      '900',
                  }}
                >
                  Show Faith
                </Text>

                <Text
                  style={{
                    marginTop:
                      2,

                    color:
                      '#68776F',

                    fontSize:
                      10,

                    lineHeight:
                      14,
                  }}
                >
                  Show BUKLOD faith content, Prayer and faith music on your app.
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{
              checked:
                Boolean(
                  showFaithContent
                ),

              disabled:
                showFaithContent ===
                null,
            }}
            accessibilityLabel="Show Faith"
            disabled={
              showFaithContent ===
              null
            }
            onPress={() => {
              setShowFaithContent(
                current =>
                  !Boolean(
                    current
                  )
              );
            }}
            style={({
              pressed,
            }) => ({
              width:
                54,

              height:
                31,

              borderRadius:
                999,

              padding:
                3,

              justifyContent:
                'center',

              backgroundColor:
                showFaithContent
                  ? '#2F7A4F'
                  : '#D7DEDA',

              opacity:
                showFaithContent ===
                null
                  ? 0.50
                  : pressed
                    ? 0.75
                    : 1,
            })}
          >
            <View
              style={{
                width:
                  25,

                height:
                  25,

                borderRadius:
                  13,

                backgroundColor:
                  '#FFFFFF',

                alignSelf:
                  showFaithContent
                    ? 'flex-end'
                    : 'flex-start',

                shadowColor:
                  '#000000',

                shadowOffset: {
                  width:
                    0,

                  height:
                    1,
                },

                shadowOpacity:
                  0.14,

                shadowRadius:
                  2,

                elevation:
                  2,
              }}
            />
          </Pressable>
        </View>

        {showFaithContent ===
        null ? (
          <Text
            style={{
              marginTop:
                10,

              color:
                '#8A6450',

              fontSize:
                10,

              lineHeight:
                14,
            }}
          >
            Show Faith preference is unavailable right now. Your existing setting will not be changed when you save.
          </Text>
        ) : (
          <View
            style={{
              marginTop:
                12,

              paddingHorizontal:
                11,

              paddingVertical:
                9,

              borderRadius:
                12,

              backgroundColor:
                showFaithContent
                  ? '#EAF6EE'
                  : '#F0F3F1',
            }}
          >
            <Text
              style={{
                color:
                  showFaithContent
                    ? '#275D45'
                    : '#68776F',

                fontSize:
                  10,

                lineHeight:
                  14,

                fontWeight:
                  '700',
              }}
            >
              {
                showFaithContent
                  ? 'ON · Faith features are enabled after saving.'
                  : 'OFF · Faith-specific Home content and music stay hidden after saving.'
              }
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Address & Localization
        </Text>

        <Text style={styles.sectionNote}>
          Required geographic information for automatic Local assignment.
        </Text>

        <Field
          label="House / Street / Address Line"
          value={addressLine}
          onChangeText={setAddressLine}
        />

        <Field
          label="Barangay"
          required
          value={barangay}
          onChangeText={setBarangay}
          placeholder="e.g. Sta. Ines"
        />

        <Field
          label="Town / City"
          required
          value={cityMunicipality}
          onChangeText={
            setCityMunicipality
          }
          placeholder="e.g. Tanay"
        />

        <Field
          label="Province"
          required
          value={province}
          onChangeText={setProvince}
          placeholder="e.g. Rizal"
        />

        <Field
          label="Country"
          required
          value={country}
          onChangeText={setCountry}
        />

        <Field
          label="Postal Code"
          value={postalCode}
          onChangeText={
            setPostalCode
          }
        />
      </View>

      <Pressable
        disabled={saving}
        onPress={() =>
          void save()
        }
        style={[
          styles.save,
          saving && {
            opacity: 0.55,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator
            color="#FFFFFF"
          />
        ) : (
          <Text style={styles.saveText}>
            SAVE PERSONAL INFORMATION
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F6F8F7',
    },

    content: {
      padding: 18,
      paddingBottom: 50,
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    header: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 15,
    },

    back: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    title: {
      fontSize: 22,
      fontWeight: '900',
      color: '#1E2A24',
    },

    subtitle: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: '#65726B',
    },

    notice: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 15,
      backgroundColor: '#EAF2EE',
      marginBottom: 15,
    },

    noticeTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: '#275D45',
    },

    noticeText: {
      marginTop: 4,
      fontSize: 11.5,
      lineHeight: 17,
      color: '#56645D',
    },

    card: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      marginBottom: 15,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: '#26332C',
    },

    sectionNote: {
      marginTop: 4,
      fontSize: 11,
      color: '#77837C',
    },

    field: {
      marginTop: 13,
    },

    label: {
      fontSize: 12,
      fontWeight: '900',
      color: '#46534B',
      marginBottom: 6,
    },

    input: {
      fontSize: 16,
      minHeight: 47,
      borderWidth: 1,
      borderColor: '#D7DEDA',
      borderRadius: 12,
      paddingHorizontal: 12,
      color: '#1F2B25',
    },

    save: {
      minHeight: 54,
      borderRadius: 15,
      backgroundColor: '#275D45',
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },
  });
