import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type IgpatQuickEditState = {
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  speed: number;
  textOverlay: string;
  captionsEnabled: boolean;
  audioLabel: string;
  coverSeconds: number;
};

export const DEFAULT_IGPAT_QUICK_EDIT: IgpatQuickEditState = {
  trimStartSeconds: 0,
  trimEndSeconds: null,
  speed: 1,
  textOverlay: '',
  captionsEnabled: false,
  audioLabel: '',
  coverSeconds: 0,
};

export default function IgpatQuickEditPanel({
  value,
  durationSeconds,
  disabled,
  onChange,
}: {
  value: IgpatQuickEditState;
  durationSeconds: number;
  disabled?: boolean;
  onChange: (next: IgpatQuickEditState) => void;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(durationSeconds, Number.isFinite(n) ? n : 0));
  const effectiveEnd = value.trimEndSeconds == null ? durationSeconds : value.trimEndSeconds;

  const set = <K extends keyof IgpatQuickEditState>(key: K, nextValue: IgpatQuickEditState[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>QUICK EDIT</Text>
          <Text style={styles.title}>Fast, lightweight preparation</Text>
        </View>
        <MaterialCommunityIcons name="magic-staff" size={20} color="#A7E6BB" />
      </View>

      <Text style={styles.label}>TRIM</Text>
      <View style={styles.row}>
        <Pressable disabled={disabled} style={styles.step} onPress={() => set('trimStartSeconds', clamp(value.trimStartSeconds - 1))}>
          <Text style={styles.stepText}>− START</Text>
        </Pressable>
        <Text style={styles.value}>{value.trimStartSeconds.toFixed(0)}s → {effectiveEnd.toFixed(0)}s</Text>
        <Pressable disabled={disabled} style={styles.step} onPress={() => set('trimStartSeconds', Math.min(effectiveEnd - 1, clamp(value.trimStartSeconds + 1)))}>
          <Text style={styles.stepText}>START +</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable disabled={disabled} style={styles.step} onPress={() => set('trimEndSeconds', Math.max(value.trimStartSeconds + 1, clamp(effectiveEnd - 1)))}>
          <Text style={styles.stepText}>− END</Text>
        </Pressable>
        <Pressable disabled={disabled} style={styles.step} onPress={() => set('trimEndSeconds', Math.min(durationSeconds, clamp(effectiveEnd + 1)))}>
          <Text style={styles.stepText}>END +</Text>
        </Pressable>
        <Pressable disabled={disabled} style={styles.step} onPress={() => onChange({ ...value, trimStartSeconds: 0, trimEndSeconds: null })}>
          <Text style={styles.stepText}>RESET</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>SPEED</Text>
      <View style={styles.row}>
        {[0.5, 1, 1.5, 2].map(speed => (
          <Pressable key={speed} disabled={disabled} onPress={() => set('speed', speed)} style={[styles.chip, value.speed === speed && styles.chipOn]}>
            <Text style={[styles.chipText, value.speed === speed && styles.chipTextOn]}>{speed}×</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>COVER FRAME</Text>
      <View style={styles.row}>
        {[0, 0.25, 0.5, 0.75].map(fraction => {
          const second = Math.round(durationSeconds * fraction);
          const selected = Math.abs(value.coverSeconds - second) < 1;
          return (
            <Pressable key={fraction} disabled={disabled} onPress={() => set('coverSeconds', second)} style={[styles.chip, selected && styles.chipOn]}>
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{second}s</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>TEXT OVERLAY</Text>
      <TextInput
        editable={!disabled}
        value={value.textOverlay}
        onChangeText={text => set('textOverlay', text.slice(0, 120))}
        placeholder="Optional short text"
        placeholderTextColor="#69736C"
        style={styles.input}
        maxLength={120}
      />

      <Text style={styles.label}>AUDIO LABEL</Text>
      <TextInput
        editable={!disabled}
        value={value.audioLabel}
        onChangeText={text => set('audioLabel', text.slice(0, 80))}
        placeholder="Original audio / music title"
        placeholderTextColor="#69736C"
        style={styles.input}
        maxLength={80}
      />

      <Pressable disabled={disabled} onPress={() => set('captionsEnabled', !value.captionsEnabled)} style={[styles.toggle, value.captionsEnabled && styles.toggleOn]}>
        <MaterialCommunityIcons name="closed-caption-outline" size={19} color={value.captionsEnabled ? '#07140D' : '#D6DED8'} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleTitle, value.captionsEnabled && styles.toggleTitleOn]}>CAPTIONS</Text>
          <Text style={[styles.toggleCopy, value.captionsEnabled && styles.toggleCopyOn]}>Store caption preference now; automatic speech captions can be generated by the processing backend when enabled.</Text>
        </View>
      </Pressable>

      <Text style={styles.note}>Quick Edit is intentionally lightweight. The original media remains untouched until publish; edit metadata is stored with the IGPAT workflow so heavy rendering never blocks basic creation.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#2A342D', backgroundColor: '#0D120F' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#A7E6BB', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { marginTop: 3, color: '#fff', fontSize: 15, fontWeight: '900' },
  label: { marginTop: 15, marginBottom: 7, color: '#8E9991', fontSize: 8.5, fontWeight: '900', letterSpacing: .9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  step: { minHeight: 34, paddingHorizontal: 9, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#333D36' },
  stepText: { color: '#D8E0DA', fontSize: 9, fontWeight: '900' },
  value: { color: '#fff', fontSize: 10, fontWeight: '900', minWidth: 75, textAlign: 'center' },
  chip: { minWidth: 48, minHeight: 34, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#333D36', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#D8F4E1', borderColor: '#D8F4E1' },
  chipText: { color: '#D4DDD7', fontSize: 10, fontWeight: '900' },
  chipTextOn: { color: '#07140D' },
  input: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#333D36', paddingHorizontal: 11, color: '#fff', backgroundColor: '#080B09' },
  toggle: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: '#333D36' },
  toggleOn: { backgroundColor: '#D8F4E1', borderColor: '#D8F4E1' },
  toggleTitle: { color: '#fff', fontSize: 10, fontWeight: '900' },
  toggleTitleOn: { color: '#07140D' },
  toggleCopy: { marginTop: 2, color: '#8E9991', fontSize: 9, lineHeight: 13 },
  toggleCopyOn: { color: '#455249' },
  note: { marginTop: 13, color: '#7E8981', fontSize: 9, lineHeight: 14 },
});
