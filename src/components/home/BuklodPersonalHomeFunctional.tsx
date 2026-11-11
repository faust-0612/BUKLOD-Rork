import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import BuklodHomeThemePicker from '@/components/home/BuklodHomeThemePicker';
import {
  DEFAULT_BUKLOD_HOME_THEME,
  getBuklodHomeTheme,
  isBuklodHomeThemeId,
  type BuklodHomeThemeId,
} from '@/lib/buklodHomeThemes';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

type Note = { id: string; text: string; done: boolean };
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const keyFor = (userId: string, name: string) => `buklod.personal-home.${name}.${userId}`;

export default function BuklodPersonalHomeFunctional() {
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { activeScope } = useBuklodScope();
  const compact = width < 600;
  const userId = String(profile?.id ?? 'guest');
  const [themeId, setThemeId] = useState<BuklodHomeThemeId>(DEFAULT_BUKLOD_HOME_THEME);
  const [themeOpen, setThemeOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'home' | 'work' | 'school' | 'business'>('home');
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState('');
  const [recipe, setRecipe] = useState('');
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [alarm, setAlarm] = useState('');

  const palette = getBuklodHomeTheme(themeId).palette;
  const name = resolvePersonDisplayName(profile, profile?.id).split(' ')[0] || 'Friend';

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(keyFor(userId, 'theme')),
      AsyncStorage.getItem(keyFor(userId, 'drawer')),
      AsyncStorage.getItem(keyFor(userId, 'timer')),
      AsyncStorage.getItem(keyFor(userId, 'mode')),
      AsyncStorage.getItem(keyFor(userId, 'alarm')),
    ]).then(([storedTheme, storedNotes, storedTimer, storedMode, storedAlarm]) => {
      if (!active) return;
      if (isBuklodHomeThemeId(storedTheme)) setThemeId(storedTheme);
      if (storedNotes) {
        try { setNotes(JSON.parse(storedNotes)); } catch { setNotes([]); }
      }
      const end = Number(storedTimer);
      if (Number.isFinite(end) && end > Date.now()) setTimerEnd(end);
      if (storedMode === 'home' || storedMode === 'work' || storedMode === 'school' || storedMode === 'business') setMode(storedMode);
      if (storedAlarm) setAlarm(storedAlarm);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!timerEnd) { setRemaining(0); return; }
    const tick = () => {
      const next = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setRemaining(next);
      if (!next) {
        setTimerEnd(null);
        void AsyncStorage.removeItem(keyFor(userId, 'timer'));
        Alert.alert('BUKLOD Timer', 'Tapos na ang timer.');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerEnd, userId]);

  const saveNotes = (next: Note[]) => {
    setNotes(next);
    void AsyncStorage.setItem(keyFor(userId, 'drawer'), JSON.stringify(next));
  };
  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    saveNotes([{ id: `${Date.now()}`, text, done: false }, ...notes]);
    setDraft('');
  };
  const startTimer = (minutes: number) => {
    const end = Date.now() + minutes * 60_000;
    setTimerEnd(end);
    void AsyncStorage.setItem(keyFor(userId, 'timer'), String(end));
  };
  const stopTimer = () => {
    setTimerEnd(null);
    setRemaining(0);
    void AsyncStorage.removeItem(keyFor(userId, 'timer'));
  };
  const openRoute = (path: string) => {
    try { router.push(path as any); } catch { Alert.alert('BUKLOD Home', 'This destination is unavailable.'); }
  };
  const runRecipe = () => {
    const ingredient = recipeDraft.trim() || 'available ingredients';
    setRecipe(`Simple recipe for ${ingredient}: prepare the ingredients, sauté aromatics, add the main ingredient and a little water, season to taste, then simmer until cooked. Tap the drawer to save your next step.`);
  };
  const saveAlarm = () => {
    if (!alarm.trim()) return;
    void AsyncStorage.setItem(keyFor(userId, 'alarm'), alarm.trim());
    setAlarmOpen(false);
    Alert.alert('Reminder saved', `Your reminder is set for ${alarm.trim()}.`);
  };
  const styles = useMemo(() => makeStyles(palette, compact), [palette, compact]);
  const time = remaining ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : 'Ready';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.house}>
        <View style={styles.header}>
          <View style={styles.logo}><MaterialCommunityIcons name="home-heart" size={24} color="#fff" /></View>
          <View style={{ flex: 1 }}><Text style={styles.brand}>BUKLOD HOME</Text><Text style={styles.muted}>{getBuklodHomeTheme(themeId).label} · {activeScope?.name ?? 'your personal space'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Customize Home" onPress={() => setThemeOpen(true)} style={styles.icon}><MaterialCommunityIcons name="palette-outline" size={20} color={palette.primary} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => openRoute('/(tabs)/me')} style={styles.icon}><MaterialCommunityIcons name="account-outline" size={20} color={palette.primary} /></Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.greeting}>Good day, {name}!</Text>
          <Text style={styles.muted}>Your personal home keeps everyday actions close.</Text>
          <View style={styles.modeRow}>{(['home', 'work', 'school', 'business'] as const).map(item => <Pressable key={item} onPress={() => { setMode(item); void AsyncStorage.setItem(keyFor(userId, 'mode'), item); }} style={[styles.mode, mode === item && styles.modeActive]}><Text style={mode === item ? styles.modeTextActive : styles.modeText}>{item.toUpperCase()}</Text></Pressable>)}</View>
        </View>

        <View style={styles.row}>
          <Room title="Kitchen" subtitle="Recipe · timer · meals" icon="pot-steam-outline" palette={palette}>
            <View style={styles.inlineButtons}><Action label="AI RECIPE" icon="chef-hat" onPress={() => { setRecipeOpen(true); setRecipe(''); }} styles={styles} /><Action label="20 MIN TIMER" icon="timer-outline" onPress={() => startTimer(20)} styles={styles} /></View>
            <Pressable onPress={timerEnd ? stopTimer : () => startTimer(20)} style={styles.timer}><Text style={styles.timerText}>{time}</Text><Text style={styles.small}>{timerEnd ? 'Tap to stop' : 'Tap to start rice timer'}</Text></Pressable>
          </Room>
          <Room title="Study & Work" subtitle={`${mode} · priorities`} icon="laptop" palette={palette}>
            <Pressable onPress={() => setMode(mode === 'school' ? 'work' : 'school')} style={styles.bigAction}><MaterialCommunityIcons name={mode === 'school' ? 'school-outline' : 'briefcase-outline'} size={30} color={palette.primary} /><Text style={styles.label}>{mode === 'school' ? 'SCHOOL MODE' : 'WORK MODE'}</Text></Pressable>
            <Text style={styles.small}>{notes.filter(item => item.done).length}/{notes.length} drawer items complete</Text>
          </Room>
        </View>

        <View style={styles.row}>
          <Room title="Relax & Enjoy" subtitle="Community · media" icon="television" palette={palette}>
            <View style={styles.inlineButtons}><Action label="COMMUNITY WALL" icon="account-multiple-outline" onPress={() => openRoute('/(tabs)/buklod')} styles={styles} /></View>
            <Action label="MUSIC / MEDIA" icon="music-note" onPress={() => openRoute('/personal-home/media')} styles={styles} />
          </Room>
          <Room title="My Drawer" subtitle="Bills · dates · notes" icon="archive-outline" palette={palette}>
            <View style={styles.drawerTop}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={addNote} placeholder="Add note" placeholderTextColor={palette.muted} style={styles.input} /><Pressable onPress={addNote} style={styles.add}><MaterialCommunityIcons name="plus" size={18} color="#fff" /></Pressable></View>
            {(notes.length ? notes.slice(0, 4) : [{ id: 'empty', text: 'Drawer is ready', done: false }]).map(note => <Pressable key={note.id} disabled={note.id === 'empty'} onPress={() => saveNotes(notes.map(item => item.id === note.id ? { ...item, done: !item.done } : item))} onLongPress={() => saveNotes(notes.filter(item => item.id !== note.id))} style={styles.note}><MaterialCommunityIcons name={note.done ? 'checkbox-marked-circle-outline' : 'note-outline'} size={16} color={palette.primary} /><Text style={[styles.label, note.done && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{note.text}</Text></Pressable>)}
          </Room>
        </View>

        <View style={styles.row}>
          <Room title="Budget & Money" subtitle="Wallet · planning" icon="wallet-outline" palette={palette}>
            <Text style={styles.small}>Keep your real financial data in the secure wallet area.</Text><Action label="OPEN WALLET / BUDGET" icon="wallet-outline" onPress={() => openRoute('/points')} styles={styles} />
          </Room>
          <Room title="Household" subtitle="People · Bayanihan" icon="account-group-outline" palette={palette}>
            <View style={styles.inlineButtons}><Action label="PEOPLE" icon="message-text-outline" onPress={() => openRoute('/connect')} styles={styles} /><Action label="BAYANIHAN" icon="hand-heart-outline" onPress={() => openRoute('/bayanihan')} styles={styles} /></View>
          </Room>
          <Room title="Good Night" subtitle="Reminder · alarm" icon="weather-night" palette={palette}>
            <Pressable onPress={() => setAlarmOpen(true)} style={styles.bigAction}><MaterialCommunityIcons name="alarm" size={30} color={palette.primary} /><Text style={styles.label}>{alarm ? `REMINDER ${alarm}` : 'SET REMINDER'}</Text></Pressable>
          </Room>
        </View>

        <View style={styles.footerRow}><Action label="MARKET / DELIVERY" icon="storefront-outline" onPress={() => openRoute('/profile/buklod-market')} styles={styles} /><Action label="COMMUNITY MAP" icon="map-marker-radius-outline" onPress={() => openRoute('/city')} styles={styles} /><Action label="BUKLOD CITY" icon="door-open" onPress={() => router.replace('/city' as any)} styles={styles} /></View>
      </View>

      <BuklodHomeThemePicker visible={themeOpen} selectedThemeId={themeId} onSelect={next => { setThemeId(next); void AsyncStorage.setItem(keyFor(userId, 'theme'), next); }} onClose={() => setThemeOpen(false)} />
      <Modal visible={recipeOpen} transparent animationType="slide" onRequestClose={() => setRecipeOpen(false)}><View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>AI RECIPE</Text><TextInput value={recipeDraft} onChangeText={setRecipeDraft} placeholder="Ingredients or dish" placeholderTextColor={palette.muted} style={styles.modalInput} /><Action label="MAKE RECIPE" icon="chef-hat" onPress={runRecipe} styles={styles} />{recipe ? <Text style={styles.modalBody}>{recipe}</Text> : null}<Pressable onPress={() => setRecipeOpen(false)}><Text style={styles.close}>CLOSE</Text></Pressable></View></View></Modal>
      <Modal visible={alarmOpen} transparent animationType="slide" onRequestClose={() => setAlarmOpen(false)}><View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>SET REMINDER</Text><TextInput value={alarm} onChangeText={setAlarm} placeholder="e.g. 9:00 PM" placeholderTextColor={palette.muted} style={styles.modalInput} /><Action label="SAVE REMINDER" icon="check" onPress={saveAlarm} styles={styles} /><Pressable onPress={() => setAlarmOpen(false)}><Text style={styles.close}>CANCEL</Text></Pressable></View></View></Modal>
    </ScrollView>
  );
}

function Room({ title, subtitle, icon, palette, children }: any) { return <View style={{ flex: 1, minWidth: 0, padding: 12, backgroundColor: palette.wallAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 16, gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><MaterialCommunityIcons name={icon} size={19} color={palette.primary} /><View><Text style={{ color: palette.text, fontWeight: '900', fontSize: 12 }}>{title}</Text><Text style={{ color: palette.muted, fontSize: 8 }}>{subtitle}</Text></View></View>{children}</View>; }
function Action({ label, icon, onPress, styles }: { label: string; icon: IconName; onPress: () => void; styles: any }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.65 }]}><MaterialCommunityIcons name={icon} size={17} color={styles.palette.primary} /><Text style={styles.actionText}>{label}</Text></Pressable>; }
function makeStyles(palette: any, compact: boolean) { const base = StyleSheet.create({ screen: { flex: 1, backgroundColor: palette.canvas }, content: { padding: compact ? 0 : 12, paddingBottom: 28 }, house: { maxWidth: 980, width: '100%', alignSelf: 'center', gap: 8 }, header: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.border }, logo: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary }, brand: { color: palette.text, fontSize: 18, fontWeight: '900' }, muted: { color: palette.muted, fontSize: 9, fontWeight: '700' }, icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceStrong }, hero: { padding: 18, borderRadius: 18, backgroundColor: palette.wall, borderWidth: 1, borderColor: palette.border }, greeting: { color: palette.text, fontSize: compact ? 25 : 32, fontWeight: '900' }, modeRow: { flexDirection: 'row', gap: 5, marginTop: 14 }, mode: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' }, modeActive: { backgroundColor: palette.primarySoft }, modeText: { color: palette.muted, fontSize: 8, fontWeight: '900' }, modeTextActive: { color: palette.primary, fontSize: 8, fontWeight: '900' }, row: { flexDirection: compact ? 'column' : 'row', gap: 8 }, inlineButtons: { flexDirection: 'row', gap: 6 }, action: { flex: 1, minHeight: 40, paddingHorizontal: 8, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: palette.border }, actionText: { color: palette.primary, fontSize: 8, fontWeight: '900', textAlign: 'center' }, timer: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, timerText: { color: palette.primary, fontSize: 19, fontWeight: '900' }, small: { color: palette.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' }, bigAction: { minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: palette.surface }, label: { color: palette.text, fontSize: 9, fontWeight: '900', textAlign: 'center' }, drawerTop: { flexDirection: 'row', gap: 5 }, input: { flex: 1, minHeight: 38, paddingHorizontal: 8, color: palette.text, backgroundColor: palette.surface, borderRadius: 9, fontSize: 10 }, add: { width: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary }, note: { minHeight: 38, padding: 8, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: palette.surface }, footerRow: { flexDirection: compact ? 'column' : 'row', gap: 7, padding: 8, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.45)' }, modal: { gap: 12, padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: palette.surface }, modalTitle: { color: palette.text, fontSize: 18, fontWeight: '900' }, modalInput: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: palette.surfaceStrong, color: palette.text }, modalBody: { color: palette.text, fontSize: 13, lineHeight: 20 }, close: { paddingVertical: 10, textAlign: 'center', color: palette.muted, fontWeight: '900' } }); return { ...base, palette }; }
