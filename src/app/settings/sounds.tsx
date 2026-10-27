import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  DEFAULT_BUKLOD_SOUND_SETTINGS,
  getBuklodSoundSettings,
  playBuklodCue,
  saveBuklodSoundSettings,
  type BuklodSoundCategory,
  type BuklodSoundCue,
  type BuklodSoundSettings,
} from '@/lib/buklodSounds';

const choices: Array<{
  category: BuklodSoundCategory;
  title: string;
  details: string;
  preview?: BuklodSoundCue;
}> = [
  { category: 'messages', title: 'Messages', details: 'Incoming messages and confirmed sends', preview: 'message' },
  { category: 'calls', title: 'Outgoing calls', details: 'Ringback while your call is ringing; phone settings control incoming call alerts' },
  { category: 'submissions', title: 'Submissions & approvals', details: 'Submitted, approved and failed actions', preview: 'submission' },
  { category: 'community', title: 'Cluster & organization', details: 'Community updates and mentions', preview: 'community' },
  { category: 'achievements', title: 'Points & achievements', details: 'Rewards and milestones', preview: 'achievement' },
  { category: 'buttons', title: 'Button feedback', details: 'Optional subtle taps', preview: 'button' },
];

export default function BuklodSoundSettingsScreen() {
  const [settings, setSettings] = useState<BuklodSoundSettings>(DEFAULT_BUKLOD_SOUND_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getBuklodSoundSettings().then(value => {
      if (mounted) setSettings(value);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const update = async (key: keyof BuklodSoundSettings, value: boolean) => {
    if (saving) return;
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    try {
      await saveBuklodSoundSettings(next);
    } catch {
      setSettings(previous);
      Alert.alert('Could not save', 'Sound settings were not changed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>BUKLOD Sounds</Text>
      <Text style={styles.help}>Soft Modern tones. Sounds play only when needed, with automatic grouping for rapid alerts.</Text>
      {choices.map(item => (
        <View style={styles.row} key={item.category}>
          <View style={styles.description}>
            <Text style={styles.label}>{item.title}</Text>
            <Text style={styles.sub}>{item.details}</Text>
            {!!item.preview && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void playBuklodCue(item.preview!)}
                style={styles.preview}
              >
                <Text style={styles.previewText}>▶ Test sound</Text>
              </Pressable>
            )}
          </View>
          <Switch
            disabled={loading || saving}
            value={settings[item.category]}
            onValueChange={value => void update(item.category, value)}
            trackColor={{ false: '#BDD2CF', true: '#4CA58D' }}
          />
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.description}>
          <Text style={styles.label}>Quiet hours · 10 PM–7 AM</Text>
          <Text style={styles.sub}>Silence optional app feedback overnight. Urgent alerts and phone system controls remain separate.</Text>
        </View>
        <Switch
          disabled={loading || saving}
          value={settings.quietHours}
          onValueChange={value => void update('quietHours', value)}
        />
      </View>
      <Text style={styles.foot}>For notification sounds while BUKLOD is closed, use the Android/iOS notification channel and Do Not Disturb settings. Call ringing is managed by your phone and Stream calling service.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F7F6' },
  content: { padding: 20, paddingBottom: 50, gap: 12 },
  back: { paddingVertical: 8, alignSelf: 'flex-start' },
  backText: { color: '#176F69', fontSize: 16, fontWeight: '700' },
  title: { color: '#153B39', fontSize: 25, fontWeight: '800' },
  help: { color: '#526B69', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  description: { flex: 1 },
  label: { color: '#153B39', fontWeight: '700', fontSize: 15 },
  sub: { color: '#657B78', fontSize: 12, lineHeight: 17, marginTop: 4 },
  preview: { paddingVertical: 8, alignSelf: 'flex-start', marginTop: 3 },
  previewText: { color: '#176F69', fontWeight: '700', fontSize: 12 },
  foot: { color: '#627D7A', lineHeight: 19, fontSize: 12, padding: 8 },
});
