import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import type { BuklodLanguagePreference } from '@/i18n/catalog';

export default function BuklodLanguagePreferences() {
  const { preference, languageName, ready, availableLanguages, allLanguageMetadata, setPreference } = useBuklodI18n();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const options: { code: BuklodLanguagePreference; title: string; detail: string }[] = [
    { code: 'device', title: 'Use device language', detail: 'Uses your phone setting when an approved translation exists; otherwise English.' },
    ...availableLanguages.map(item => ({ code: item.code, title: item.nativeName, detail: item.englishName })),
  ];
  const select = async (code: BuklodLanguagePreference) => {
    if (saving || code === preference) return;
    setSaving(true);
    setFeedback('');
    try {
      await setPreference(code);
      setFeedback('Language preference saved on this device.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not save language preference.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Language' }} />
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#224b3b" />
        <Text style={styles.backText}>Back to Profile</Text>
      </Pressable>
      <Text style={styles.title}>App language</Text>
      <Text style={styles.sub}>Change the language for screens that have a reviewed translation. The app will not pretend unfinished language packs are complete.</Text>
      <Text style={styles.current}>Currently displayed: {languageName}</Text>
      {!ready && <ActivityIndicator color="#285a46" />}
      {options.map(item => (
        <Pressable key={item.code} accessibilityRole="radio"
          accessibilityState={{ selected: preference === item.code, disabled: saving || !ready }}
          disabled={saving || !ready}
          onPress={() => void select(item.code)} style={[styles.option, preference === item.code && styles.selected]}>
          <MaterialCommunityIcons name={preference === item.code ? 'radiobox-marked' : 'radiobox-blank'} size={23} color="#285a46" />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{item.title}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
        </Pressable>
      ))}
      {!!feedback && <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text>}
      <Text style={styles.section}>Coming later — not selectable yet</Text>
      {allLanguageMetadata.filter(item => !item.productionReady || !item.approved).map(item =>
        <Text key={item.code} style={styles.pending}>{item.nativeName} · translation under review</Text>
      )}
      <Text style={styles.detail}>Only approved language packs appear as active choices. Your preferred setting is stored locally and synchronized to your BUKLOD profile when available.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f8f5' },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  backText: { fontSize: 15, color: '#224b3b', fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '900', color: '#183b2d' },
  sub: { color: '#64766a', fontSize: 14, lineHeight: 21 },
  current: { color: '#285a46', fontWeight: '800', marginBottom: 5 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 13, backgroundColor: 'white', borderWidth: 1, borderColor: '#d9e5dd' },
  selected: { borderColor: '#285a46', backgroundColor: '#ecf6f0' },
  optionTitle: { color: '#183b2d', fontSize: 16, fontWeight: '800' },
  detail: { color: '#687c70', fontSize: 12, lineHeight: 19 },
  feedback: { padding: 10, color: '#285a46', fontWeight: '700' },
  section: { color: '#183b2d', fontSize: 15, fontWeight: '800', marginTop: 12 },
  pending: { color: '#8d9d93', fontSize: 13, paddingLeft: 12 },
});
