import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, Card, SectionTitle } from '@/components/UI';
import { colors } from '@/lib/theme';

export type AttendanceEventMethod =
  | 'qr'
  | 'face'
  | 'device_biometric'
  | 'manual';

export const ATTENDANCE_EVENT_METHOD_OPTIONS: {
  key: AttendanceEventMethod;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { key: 'qr', label: 'QR', icon: 'qrcode-scan' },
  { key: 'face', label: 'Face', icon: 'face-recognition' },
  { key: 'device_biometric', label: 'Biometric', icon: 'fingerprint' },
  { key: 'manual', label: 'Manual', icon: 'account-check-outline' },
];

export type BuklodAttendanceEventFormValues = {
  title: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  lateTime: string;
  openNow: boolean;
  methods: AttendanceEventMethod[];
};

type Props = {
  values: BuklodAttendanceEventFormValues;
  saving?: boolean;
  submitTitle?: string;
  savingTitle?: string;
  contextNote?: string | null;
  onChange: <K extends keyof BuklodAttendanceEventFormValues>(
    key: K,
    value: BuklodAttendanceEventFormValues[K]
  ) => void;
  onSubmit: () => void;
};

export function BuklodAttendanceEventForm({
  values,
  saving = false,
  submitTitle = 'CREATE EVENT',
  savingTitle = 'CREATING...',
  contextNote = null,
  onChange,
  onSubmit,
}: Props) {
  const {
    title,
    location,
    date,
    startTime,
    endTime,
    lateTime,
    openNow,
    methods,
  } = values;

  return (
    <>
      <SectionTitle>EVENT DETAILS</SectionTitle>
      <Card>
        <Text style={styles.label}>Event name</Text>
        <TextInput
          style={styles.input}
          placeholder="Sunday worship, cluster meeting, etc."
          value={title}
          onChangeText={value => onChange('title', value)}
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional venue or area"
          value={location}
          onChangeText={value => onChange('location', value)}
        />

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={value => onChange('date', value)}
          autoCapitalize="none"
        />

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Start time</Text>
            <TextInput
              style={styles.input}
              placeholder="08:00"
              value={startTime}
              onChangeText={value => onChange('startTime', value)}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>End time</Text>
            <TextInput
              style={styles.input}
              placeholder="10:00"
              value={endTime}
              onChangeText={value => onChange('endTime', value)}
            />
          </View>
        </View>
      </Card>

      <SectionTitle>ATTENDANCE SETTINGS</SectionTitle>
      <Card>
        <Text style={styles.label}>Late after</Text>
        <TextInput
          style={styles.input}
          placeholder="08:15"
          value={lateTime}
          onChangeText={value => onChange('lateTime', value)}
        />

        <Text style={styles.label}>Allowed check-in methods</Text>
        <Text style={styles.help}>
          Choose how members can mark attendance for this event.
        </Text>
        <View style={styles.methodWrap}>
          {ATTENDANCE_EVENT_METHOD_OPTIONS.map(option => {
            const on = methods.includes(option.key);
            return (
              <Pressable
                key={option.key}
                onPress={() =>
                  onChange(
                    'methods',
                    on
                      ? methods.filter(item => item !== option.key)
                      : [...methods, option.key]
                  )
                }
                style={[styles.methodChip, on && styles.methodChipOn]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={18}
                  color={on ? colors.greenDark : colors.muted}
                />
                <Text style={[styles.methodText, on && styles.methodTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Open attendance now</Text>
            <Text style={styles.help}>
              When enabled, the event appears as open in the Attendance Checker
              right away.
            </Text>
          </View>
          <Switch
            value={openNow}
            onValueChange={value => onChange('openNow', value)}
          />
        </View>

        {!!contextNote && (
          <Text style={styles.help}>{contextNote}</Text>
        )}

        <Button
          title={saving ? savingTitle : submitTitle}
          onPress={saving ? () => undefined : onSubmit}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  help: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 10,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.white,
    color: colors.text,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  methodWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  methodChip: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  methodChipOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },
  methodTextOn: {
    color: colors.greenDark,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
});
