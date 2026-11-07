import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  DEFAULT_BUKLOD_SOUND_SETTINGS,
  getBuklodSoundSettings,
  playBuklodCue,
  saveBuklodSoundSettings,
  type BuklodSoundCategory,
  type BuklodSoundProfile,
  type BuklodSoundVolume,
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

  const update = async <K extends keyof BuklodSoundSettings>(key: K, value: BuklodSoundSettings[K]) => {
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
      <Text style={styles.help}>Choose your sound style and loudness. Separate controls below manage which events may play sounds.</Text>
      <View style={styles.group}>
        <Text style={styles.label}>Sound style</Text>
        <Text style={styles.sub}>All choices use existing BUKLOD sounds—no additional download required.</Text>
        <View style={styles.optionRow}>
          {([
            {id:'classic',name:'Classic',hint:'Original BUKLOD'},
            {id:'gentle',name:'Gentle',hint:'Subtle & brief'},
            {id:'celebration',name:'Celebration',hint:'Lively feedback'},
          ] as const).map(item=><Pressable key={item.id} accessibilityRole="button"
            accessibilityState={{selected:settings.soundProfile===item.id}}
            disabled={loading||saving}
            onPress={()=>void update('soundProfile',item.id as BuklodSoundProfile)}
            style={[styles.option,settings.soundProfile===item.id&&styles.selected]}>
            <Text style={styles.optionTitle}>{item.name}</Text>
            <Text style={styles.optionHint}>{item.hint}</Text>
          </Pressable>)}
        </View>
        <Pressable accessibilityRole="button" onPress={()=>void playBuklodCue('community',{preview:true})}
          style={styles.preview}><Text style={styles.previewText}>▶ Preview selected style</Text></Pressable>
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Playback volume</Text>
        <View style={styles.optionRow}>
          {([
            {id:'low',name:'Low'},
            {id:'balanced',name:'Balanced'},
            {id:'high',name:'High'},
          ] as const).map(item=><Pressable key={item.id}
            accessibilityRole="button" accessibilityState={{selected:settings.volumeLevel===item.id}}
            disabled={loading||saving}
            onPress={()=>void update('volumeLevel',item.id as BuklodSoundVolume)}
            style={[styles.option,settings.volumeLevel===item.id&&styles.selected]}>
            <Text style={styles.optionTitle}>{item.name}</Text>
          </Pressable>)}
        </View>
      </View>
      {choices.map(item => (
        <View style={styles.row} key={item.category}>
          <View style={styles.description}>
            <Text style={styles.label}>{item.title}</Text>
            <Text style={styles.sub}>{item.details}</Text>
            {!!item.preview && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void playBuklodCue(item.preview!,{preview:true})}
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
  group:{padding:16,backgroundColor:'#FFFFFF',borderRadius:13,gap:9},
  optionRow:{flexDirection:'row',flexWrap:'wrap',gap:8},
  option:{flex:1,minWidth:90,padding:11,borderRadius:10,borderWidth:1,borderColor:'#CFE0D6',
    backgroundColor:'#F8FBF9',alignItems:'center',gap:3},
  selected:{backgroundColor:'#E1F3E9',borderColor:'#1B8162',borderWidth:2},
  optionTitle:{color:'#174C3D',fontWeight:'900',fontSize:12},
  optionHint:{color:'#637A71',fontSize:10,textAlign:'center'},
});
