import React, { useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { createChurch } from '@/lib/buklodChurches';

function msg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  return String(e || 'Unknown error');
}

export default function CreateChurchScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [denomination, setDenomination] = useState('');
  const [seniorPastor, setSeniorPastor] = useState('');

  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [website, setWebsite] = useState('');

  const [addressLine, setAddressLine] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] =
    useState('Philippines');

  const [authorityRole, setAuthorityRole] =
    useState('');

  const [proof, setProof] = useState('');
  const [note, setNote] = useState('');

  const [confirmed, setConfirmed] =
    useState(false);

  const [busy, setBusy] = useState(false);

  async function submit() {
    if (
      !name.trim() ||
      !city.trim() ||
      !province.trim() ||
      !country.trim() ||
      !authorityRole.trim()
    ) {
      Alert.alert(
        'Church registration',
        'Church name, city/municipality, province, country and your authority/role are required.'
      );
      return;
    }

    if (!email.trim() && !mobile.trim()) {
      Alert.alert(
        'Church registration',
        'Provide a Church contact email or mobile number.'
      );
      return;
    }

    if (!confirmed) {
      Alert.alert(
        'Authorization',
        'Confirm that you are authorized to register this Church.'
      );
      return;
    }

    setBusy(true);

    try {
      const id = await createChurch({
        name,
        description,
        denomination,
        seniorPastorName: seniorPastor,
        contactEmail: email,
        contactMobile: mobile,
        website,
        addressLine,
        barangay,
        cityMunicipality: city,
        province,
        country,
        authorityRole,
        authorityConfirmed: confirmed,
        proofReference: proof,
        submitNote: note,
      });

      router.replace({
        pathname: '/churches/[id]' as any,
        params: { id },
      } as any);
    } catch (e) {
      Alert.alert(
        'Church registration',
        msg(e)
      );
    } finally {
      setBusy(false);
    }
  }

  const Field = ({
    label,
    value,
    setValue,
    placeholder,
    multiline,
  }: {
    label: string;
    value: string;
    setValue: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
  }) => (
    <>
      <Text style={s.label}>{label}</Text>

      <TextInput
        style={[
          s.input,
          multiline && s.multiline,
        ]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        multiline={multiline}
        textAlignVertical={
          multiline ? 'top' : 'center'
        }
      />
    </>
  );

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.hero}>
        <Text style={s.eyebrow}>
          CHURCH VERIFICATION
        </Text>

        <Text style={s.title}>
          Register a Church
        </Text>

        <Text style={s.subtitle}>
          The creator becomes Provisional Church
          Admin. The Church becomes publicly verified
          only after BUKLOD System Admin review.
        </Text>
      </View>

      <View style={s.card}>
        <Field
          label="CHURCH NAME *"
          value={name}
          setValue={setName}
        />

        <Field
          label="DENOMINATION / AFFILIATION"
          value={denomination}
          setValue={setDenomination}
          placeholder="Optional"
        />

        <Field
          label="SENIOR / HEAD PASTOR"
          value={seniorPastor}
          setValue={setSeniorPastor}
          placeholder="Optional"
        />

        <Field
          label="DESCRIPTION"
          value={description}
          setValue={setDescription}
          multiline
        />
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>
          CHURCH CONTACT
        </Text>

        <Field
          label="EMAIL"
          value={email}
          setValue={setEmail}
        />

        <Field
          label="MOBILE"
          value={mobile}
          setValue={setMobile}
        />

        <Field
          label="WEBSITE / PAGE"
          value={website}
          setValue={setWebsite}
          placeholder="Optional"
        />
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>
          CHURCH LOCATION
        </Text>

        <Field
          label="ADDRESS / STREET"
          value={addressLine}
          setValue={setAddressLine}
          placeholder="Optional for Church"
        />

        <Field
          label="BARANGAY"
          value={barangay}
          setValue={setBarangay}
        />

        <Field
          label="CITY / MUNICIPALITY *"
          value={city}
          setValue={setCity}
        />

        <Field
          label="PROVINCE *"
          value={province}
          setValue={setProvince}
        />

        <Field
          label="COUNTRY *"
          value={country}
          setValue={setCountry}
        />
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>
          AUTHORITY TO REGISTER
        </Text>

        <Field
          label="YOUR ROLE / AUTHORITY *"
          value={authorityRole}
          setValue={setAuthorityRole}
          placeholder="Pastor, Church Officer, Authorized Representative..."
        />

        <Field
          label="PROOF / REFERENCE"
          value={proof}
          setValue={setProof}
          placeholder="Optional document/reference note"
        />

        <Field
          label="NOTE TO VERIFIER"
          value={note}
          setValue={setNote}
          multiline
        />

        <Pressable
          style={[
            s.confirm,
            confirmed && s.confirmOn,
          ]}
          onPress={() =>
            setConfirmed((v) => !v)
          }
        >
          <View
            style={[
              s.box,
              confirmed && s.boxOn,
            ]}
          />

          <Text style={s.confirmText}>
            I confirm that I am authorized by this
            Church to submit this registration and
            verification request.
          </Text>
        </Pressable>
      </View>

      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[
          s.submit,
          busy && s.disabled,
        ]}
      >
        <Text style={s.submitText}>
          {busy
            ? 'SUBMITTING...'
            : 'SUBMIT FOR VERIFICATION'}
        </Text>
      </Pressable>

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
    gap: 12,
  },
  hero: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 18,
    padding: 18,
  },
  eyebrow: {
    fontWeight: '900',
    color: '#2D6A4F',
    letterSpacing: 1.5,
    fontSize: 11,
  },
  title: {
    color: '#19362A',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: '#66756D',
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 16,
    padding: 14,
    gap: 7,
  },
  sectionTitle: {
    fontWeight: '900',
    color: '#365347',
    letterSpacing: 1,
    marginBottom: 3,
  },
  label: {
    color: '#496056',
    fontWeight: '900',
    fontSize: 11,
    marginTop: 5,
  },
  input: {
    minHeight: 46,
    backgroundColor: '#FAFBFA',
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 11,
    paddingHorizontal: 11,
  },
  multiline: {
    minHeight: 100,
    paddingTop: 10,
  },
  confirm: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D5DED9',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  confirmOn: {
    borderColor: '#2D6A4F',
    backgroundColor: '#F0F7F3',
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#9FAEA6',
    borderRadius: 5,
  },
  boxOn: {
    backgroundColor: '#2D6A4F',
    borderColor: '#2D6A4F',
  },
  confirmText: {
    flex: 1,
    color: '#495A51',
    lineHeight: 19,
  },
  submit: {
    minHeight: 52,
    backgroundColor: '#2D6A4F',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
});
