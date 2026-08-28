/* PATCH_175A_COMPLETE_ORGANIZATION_CREATE */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import {
  enterScopedWorkspace,
} from '@/lib/buklodScopeRoute';
import { BUKLOD_ORGANIZATION_TYPE_CHURCH } from '@/lib/buklodCommercialCatalog';
import {
  formatBuklodAddressQuery,
  geocodeBuklodAddress,
} from '@/lib/buklodGeocode';

type OrganizationType =
  | 'CHURCH'
  | 'MINISTRY_FAITH'
  | 'NGO_FOUNDATION'
  | 'SCHOOL_EDUCATION'
  | 'BUSINESS_COMPANY'
  | 'ASSOCIATION_PROFESSIONAL'
  | 'COMMUNITY_CIVIC'
  | 'OTHER';

type FieldDefinition = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
};

const TYPES: Array<{
  key: OrganizationType;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { key: 'CHURCH', label: 'Church', description: 'A church registered as an Organization. Appears in Find a Church when address and location are saved.', icon: 'church-outline' },
  { key: 'MINISTRY_FAITH', label: 'Ministry / Faith Organization', description: 'Ministries, missions and faith-based institutions. Not listed as a Church unless registered as Church.', icon: 'hands-pray' },
  { key: 'NGO_FOUNDATION', label: 'NGO / Foundation', description: 'Foundations, NGOs, charities and nonprofit organizations.', icon: 'hand-heart-outline' },
  { key: 'SCHOOL_EDUCATION', label: 'School / Education', description: 'Schools, academies, training centers and learning organizations.', icon: 'school-outline' },
  { key: 'BUSINESS_COMPANY', label: 'Business / Company', description: 'Companies, businesses and private organizations.', icon: 'office-building-outline' },
  { key: 'ASSOCIATION_PROFESSIONAL', label: 'Association / Professional', description: 'Associations, cooperatives, clubs and professional groups.', icon: 'account-group-outline' },
  { key: 'COMMUNITY_CIVIC', label: 'Community / Civic', description: 'Community initiatives, civic groups and advocacy organizations.', icon: 'account-heart-outline' },
  { key: 'OTHER', label: 'Other Organization', description: 'Other organization types not listed above.', icon: 'domain' },
];

const COMMON_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'ORGANIZATION NAME', placeholder: 'Official organization name' },
  { key: 'description', label: 'ABOUT / DESCRIPTION', placeholder: 'Describe the organization', multiline: true },
  { key: 'mission', label: 'MISSION', placeholder: 'Organization mission', multiline: true },
  { key: 'vision', label: 'VISION', placeholder: 'Organization vision', multiline: true },
  { key: 'contact', label: 'CONTACT', placeholder: 'Email, phone or office contact' },
  { key: 'location', label: 'LOCATION', placeholder: 'City / Province / Country' },
];

const TYPE_FIELDS: Record<OrganizationType, FieldDefinition[]> = {
  CHURCH: [
    { key: 'address_line', label: 'STREET / BUILDING', placeholder: 'Worship address or building name' },
    { key: 'barangay', label: 'BARANGAY', placeholder: 'Barangay' },
    { key: 'city_municipality', label: 'CITY / MUNICIPALITY', placeholder: 'City or municipality' },
    { key: 'province', label: 'PROVINCE', placeholder: 'Province' },
    { key: 'affiliation', label: 'DENOMINATION / AFFILIATION', placeholder: 'Affiliation or network' },
    { key: 'leader', label: 'PASTOR / LEADER', placeholder: 'Lead pastor or church leader' },
  ],
  MINISTRY_FAITH: [
    { key: 'affiliation', label: 'DENOMINATION / AFFILIATION', placeholder: 'Affiliation or network' },
    { key: 'leader', label: 'LEADER / DIRECTOR', placeholder: 'Lead pastor, director or president' },
    { key: 'year_established', label: 'YEAR ESTABLISHED', placeholder: 'Year established' },
    { key: 'ministries', label: 'MINISTRIES / PROGRAMS', placeholder: 'List key ministries or programs', multiline: true },
  ],
  NGO_FOUNDATION: [
    { key: 'registration_number', label: 'REGISTRATION NUMBER', placeholder: 'SEC / registration number if applicable' },
    { key: 'advocacy', label: 'CAUSE / ADVOCACY', placeholder: 'Primary advocacy or cause' },
    { key: 'beneficiaries', label: 'TARGET BENEFICIARIES', placeholder: 'Who does the organization serve?', multiline: true },
    { key: 'programs', label: 'PROGRAMS / PROJECTS', placeholder: 'Main programs and projects', multiline: true },
  ],
  SCHOOL_EDUCATION: [
    { key: 'institution_level', label: 'INSTITUTION LEVEL', placeholder: 'School, college, training center, academy, etc.' },
    { key: 'school_head', label: 'SCHOOL HEAD / DIRECTOR', placeholder: 'Head of institution' },
    { key: 'programs', label: 'COURSES / PROGRAMS', placeholder: 'Programs or courses offered', multiline: true },
  ],
  BUSINESS_COMPANY: [
    { key: 'industry', label: 'INDUSTRY', placeholder: 'Industry or business sector' },
    { key: 'registration_number', label: 'BUSINESS REGISTRATION', placeholder: 'SEC / DTI / registration details' },
    { key: 'services', label: 'PRODUCTS / SERVICES', placeholder: 'Main products or services', multiline: true },
  ],
  ASSOCIATION_PROFESSIONAL: [
    { key: 'association_type', label: 'ASSOCIATION / PROFESSION TYPE', placeholder: 'Professional, cooperative, alumni, trade, etc.' },
    { key: 'officers', label: 'OFFICERS / LEADERSHIP', placeholder: 'Leadership structure', multiline: true },
    { key: 'membership_rules', label: 'MEMBERSHIP RULES', placeholder: 'Membership qualifications and rules', multiline: true },
  ],
  COMMUNITY_CIVIC: [
    { key: 'advocacy', label: 'ADVOCACY / PURPOSE', placeholder: 'Primary civic or community purpose' },
    { key: 'coverage', label: 'AREA / COMMUNITY COVERAGE', placeholder: 'Community or geographic coverage' },
    { key: 'programs', label: 'ACTIVITIES / PROGRAMS', placeholder: 'Main activities and programs', multiline: true },
  ],
  OTHER: [
    { key: 'custom_type', label: 'ORGANIZATION TYPE', placeholder: 'Describe the organization type' },
    { key: 'structure', label: 'STRUCTURE / LEADERSHIP', placeholder: 'Describe leadership and structure', multiline: true },
  ],
};

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceOn,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function CreateOrganizationScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const presetType = String(params.type ?? '').trim().toUpperCase();
  const { selectScope, refresh } = useBuklodScope();
  const [selectedType, setSelectedType] = useState<OrganizationType | null>(
    presetType === BUKLOD_ORGANIZATION_TYPE_CHURCH ? 'CHURCH' : null,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [joinPolicy, setJoinPolicy] = useState<'OPEN' | 'APPROVAL_REQUIRED' | 'INVITE_ONLY'>('APPROVAL_REQUIRED');
  const [busy, setBusy] = useState(false);

  const selectedOption = useMemo(
    () => TYPES.find(item => item.key === selectedType) ?? null,
    [selectedType],
  );

  const fields = selectedType
    ? [...COMMON_FIELDS, ...TYPE_FIELDS[selectedType]]
    : [];

  const setValue = (key: string, value: string) =>
    setValues(current => ({ ...current, [key]: value }));

  const changeVisibility = (next: 'PUBLIC' | 'PRIVATE') => {
    setVisibility(next);
    if (next === 'PRIVATE') {
      setJoinPolicy('INVITE_ONLY');
    } else if (joinPolicy === 'INVITE_ONLY') {
      setJoinPolicy('APPROVAL_REQUIRED');
    }
  };

  const createOrganization = async () => {
    if (!selectedType) {
      Alert.alert('Organization', 'Choose an organization type first.');
      return;
    }
    if (!values.name?.trim()) {
      Alert.alert('Organization', 'Organization name is required.');
      return;
    }
    if (selectedType === 'CHURCH') {
      if (!values.city_municipality?.trim() && !values.address_line?.trim()) {
        Alert.alert(
          'Church address',
          'Add a usable church address so Find a Church can store coordinates.',
        );
        return;
      }
    }
    if (busy) return;

    setBusy(true);
    try {
      const profile = Object.fromEntries(
        Object.entries(values)
          .filter(([key]) => key !== 'name')
          .map(([key, value]) => [key, value.trim()]),
      ) as Record<string, string>;

      if (selectedType === 'CHURCH') {
        const query = formatBuklodAddressQuery({
          addressLine: profile.address_line,
          barangay: profile.barangay,
          cityMunicipality: profile.city_municipality,
          province: profile.province,
          country: 'Philippines',
        });
        const coords = await geocodeBuklodAddress(query);
        if (coords) {
          profile.latitude = String(coords.latitude);
          profile.longitude = String(coords.longitude);
        }
        profile.safe_location_label = [
          profile.barangay,
          profile.city_municipality,
          profile.province,
        ]
          .filter(Boolean)
          .join(', ');
      }

      const { data, error } = await (supabase as any).rpc(
        'buklod_create_organization_v3',
        {
          _name: values.name.trim(),
          _organization_type: selectedType,
          _profile: profile,
          _visibility: visibility,
          _join_policy: visibility === 'PRIVATE' ? 'INVITE_ONLY' : joinPolicy,
        },
      );

      if (error) throw error;
      const scopeId = String(data ?? '');
      if (!scopeId) throw new Error('Organization was not created.');

      await refresh();
      await selectScope(scopeId);

      Alert.alert(
        'Organization Created',
        'The organization is active. You are its Organization Admin.',
        [
          {
            text: 'OPEN WORKSPACE',
            onPress: () =>
              void enterScopedWorkspace(
                selectScope,
                scopeId,
                { fromPortal: true }
              ),
          },
          {
            text: 'MANAGE',
            onPress: () =>
              router.replace({
                pathname: '/organizations/manage',
                params: { organization: scopeId },
              } as any),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Could Not Create Organization',
        String(error?.message ?? error ?? 'Please try again.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.greenDark} />
        <Text style={styles.backText}>Organization Center</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CREATE</Text>
        <Text style={styles.title}>
          {selectedType === 'CHURCH' ? 'Register a Church' : 'Create Organization'}
        </Text>
        <Text style={styles.subtitle}>
          {selectedType === 'CHURCH'
            ? 'A Church is an Organization type. Registration is free. After saving a usable address, it can appear in Find a Church.'
            : 'Create a complete Organization environment. The creator becomes an active member and Organization Admin. Registration is free.'}
        </Text>
      </View>

      {!selectedType ? (
        <>
          <Text style={styles.section}>1. CHOOSE ORGANIZATION TYPE</Text>
          <View style={styles.typeList}>
            {TYPES.map(item => (
              <Pressable
                key={item.key}
                onPress={() => setSelectedType(item.key)}
                style={({ pressed }) => [
                  styles.typeCard,
                  pressed && { opacity: 0.72 },
                ]}
              >
                <View style={styles.typeIcon}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={23}
                    color={colors.greenDark}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeTitle}>{item.label}</Text>
                  <Text style={styles.typeText}>{item.description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => setSelectedType(null)}
            style={styles.selectedType}
          >
            <MaterialCommunityIcons
              name={selectedOption?.icon ?? 'domain'}
              size={21}
              color={colors.greenDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedLabel}>ORGANIZATION TYPE</Text>
              <Text style={styles.selectedName}>{selectedOption?.label}</Text>
            </View>
            <Text style={styles.change}>CHANGE</Text>
          </Pressable>

          <Text style={styles.section}>2. ORGANIZATION PROFILE</Text>
          <View style={styles.card}>
            {fields.map(field => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  value={values[field.key] ?? ''}
                  onChangeText={value => setValue(field.key, value)}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.muted}
                  multiline={field.multiline}
                  style={[styles.input, field.multiline && styles.multiline]}
                />
              </View>
            ))}
          </View>

          <Text style={styles.section}>3. VISIBILITY & JOINING</Text>
          <View style={styles.card}>
            <Text style={styles.label}>VISIBILITY</Text>
            <View style={styles.choiceRow}>
              <Choice label="PUBLIC" selected={visibility === 'PUBLIC'} onPress={() => changeVisibility('PUBLIC')} />
              <Choice label="PRIVATE" selected={visibility === 'PRIVATE'} onPress={() => changeVisibility('PRIVATE')} />
            </View>
            <Text style={styles.help}>
              Public Organizations can appear in Join Organization discovery. Private Organizations are invitation-only.
            </Text>

            <Text style={[styles.label, { marginTop: 14 }]}>JOIN POLICY</Text>
            <View style={styles.choiceWrap}>
              <Choice
                label="OPEN JOIN"
                selected={joinPolicy === 'OPEN'}
                onPress={() => visibility === 'PUBLIC' && setJoinPolicy('OPEN')}
              />
              <Choice
                label="REQUEST TO JOIN"
                selected={joinPolicy === 'APPROVAL_REQUIRED'}
                onPress={() => visibility === 'PUBLIC' && setJoinPolicy('APPROVAL_REQUIRED')}
              />
              <Choice
                label="INVITE ONLY"
                selected={joinPolicy === 'INVITE_ONLY'}
                onPress={() => setJoinPolicy('INVITE_ONLY')}
              />
            </View>
          </View>

          <Pressable
            disabled={busy}
            onPress={() => void createOrganization()}
            style={({ pressed }) => [
              styles.primary,
              busy && { opacity: 0.55 },
              pressed && !busy && { opacity: 0.8 },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.primaryText}>
              {busy ? 'CREATING...' : 'CREATE ORGANIZATION'}
            </Text>
          </Pressable>
        </>
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 10.5, fontWeight: '800', color: colors.greenDark },
  hero: { borderRadius: 22, padding: 18, backgroundColor: colors.greenDark, marginBottom: 16 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: 'rgba(255,255,255,0.72)' },
  title: { marginTop: 4, fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { marginTop: 7, fontSize: 10.5, lineHeight: 15.5, color: 'rgba(255,255,255,0.82)' },
  section: { marginBottom: 7, marginTop: 2, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75, color: colors.greenDark },
  typeList: { gap: 8 },
  typeCard: { minHeight: 72, borderWidth: 1, borderColor: colors.line, borderRadius: 17, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.white },
  typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  typeTitle: { fontSize: 12, fontWeight: '900', color: colors.text },
  typeText: { marginTop: 3, fontSize: 9.5, lineHeight: 13, color: colors.muted },
  selectedType: { minHeight: 68, borderWidth: 1, borderColor: colors.green, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.greenSoft, marginBottom: 14 },
  selectedLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6, color: colors.greenDark },
  selectedName: { marginTop: 2, fontSize: 12, fontWeight: '900', color: colors.text },
  change: { fontSize: 8.5, fontWeight: '900', color: colors.greenDark },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, backgroundColor: colors.white, marginBottom: 14 },
  field: { marginBottom: 13 },
  label: { marginBottom: 5, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5, color: colors.greenDark },
  input: { minHeight: 45, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9, color: colors.text, backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 36, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  choiceOn: { borderColor: colors.greenDark, backgroundColor: colors.greenSoft },
  choiceText: { fontSize: 8.5, fontWeight: '900', color: colors.muted },
  choiceTextOn: { color: colors.greenDark },
  help: { marginTop: 8, fontSize: 9, lineHeight: 13, color: colors.muted },
  primary: { minHeight: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenDark },
  primaryText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.55, color: '#FFFFFF' },
});
