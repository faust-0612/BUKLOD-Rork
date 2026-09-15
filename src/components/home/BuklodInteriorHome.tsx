import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import BuklodHomeThemePicker from '@/components/home/BuklodHomeThemePicker';
import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';
import {
  formatBuklodHomeDate,
  getBuklodHomeDaypart,
  getBuklodHomeGreeting,
  getBuklodHomeTodayItems,
  type BuklodHomeMode,
} from '@/lib/buklodHomeModel';
import {
  DEFAULT_BUKLOD_HOME_THEME,
  getBuklodHomeTheme,
  isBuklodHomeThemeId,
  type BuklodHomeThemeId,
} from '@/lib/buklodHomeThemes';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { loadBuklodPointsDashboard } from '@/lib/buklodRewards';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type DrawerNote = {
  id: string;
  text: string;
  done: boolean;
};

const MODE_OPTIONS: Array<{
  value: BuklodHomeMode;
  label: string;
  subtitle: string;
  icon: IconName;
}> = [
  { value: 'home', label: 'Home', subtitle: 'Family & Personal', icon: 'home-heart' },
  { value: 'work', label: 'Work', subtitle: 'Get Things Done', icon: 'briefcase-outline' },
  { value: 'school', label: 'School', subtitle: 'Learn & Grow', icon: 'school-outline' },
  { value: 'business', label: 'Business', subtitle: 'Build & Earn', icon: 'chart-bar' },
];

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function BuklodInteriorHome() {
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { activeScope } = useBuklodScope();

  const userId = String(profile?.id ?? 'guest');
  const daypart = getBuklodHomeDaypart();
  const [mode, setMode] = useState<BuklodHomeMode>('home');
  const [homeThemeId, setHomeThemeId] = useState<BuklodHomeThemeId>(DEFAULT_BUKLOD_HOME_THEME);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [circleRank, setCircleRank] = useState('Circle Starter V');
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [drawerNotes, setDrawerNotes] = useState<DrawerNote[]>([]);
  const [drawerDraft, setDrawerDraft] = useState('');
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [askDraft, setAskDraft] = useState('');

  const homeTheme = getBuklodHomeTheme(homeThemeId);
  const palette = homeTheme.palette;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const modeKey = `buklod.personal-home.mode.${userId}`;
  const themeKey = `buklod.personal-home.theme.${userId}`;
  const doneKey = `buklod.personal-home.today.${userId}.${todayKey}`;
  const drawerKey = `buklod.personal-home.drawer.${userId}`;
  const timerKey = `buklod.personal-home.timer.${userId}`;

  const showFaithContent = Boolean(activeScope?.show_faith_content);
  const todayItems = useMemo(
    () => getBuklodHomeTodayItems({ daypart, mode, showFaithContent }),
    [daypart, mode, showFaithContent],
  );

  const displayName = resolvePersonDisplayName(profile, profile?.id);
  const firstName = String(displayName || 'Friend').split(' ')[0];
  const doneCount = todayItems.filter((item) => completedToday[item.id]).length;
  const threeColumns = width >= 390;
  const roomWidth = threeColumns ? '32%' : '48.5%';

  const styles = useMemo(
    () => StyleSheet.create({
      screen: { flex: 1, backgroundColor: palette.canvas },
      content: {
        width: '100%',
        maxWidth: 1040,
        alignSelf: 'center',
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 28,
      },
      homeShell: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.wall,
      },
      ceiling: {
        height: 13,
        backgroundColor: palette.wood,
      },
      topBar: {
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingHorizontal: 12,
        backgroundColor: palette.wall,
      },
      brandButton: {
        width: 40,
        height: 40,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primary,
      },
      brandCopy: { flex: 1, minWidth: 0 },
      brandTitle: {
        color: palette.text,
        fontSize: 20,
        lineHeight: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
      },
      brandSub: {
        color: palette.muted,
        fontSize: 8.5,
        lineHeight: 12,
        fontWeight: '700',
      },
      topAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      livingRoom: {
        minHeight: 242,
        marginHorizontal: 10,
        marginBottom: 9,
        borderRadius: 23,
        overflow: 'hidden',
        backgroundColor: palette.wallAlt,
        borderWidth: 1,
        borderColor: palette.border,
        position: 'relative',
      },
      livingWall: {
        flex: 1,
        minHeight: 184,
        flexDirection: 'row',
        alignItems: 'stretch',
        padding: 12,
        gap: 10,
      },
      characterZone: {
        width: threeColumns ? '38%' : '42%',
        minWidth: 118,
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: palette.primarySoft,
      },
      livingCopy: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        paddingTop: 16,
      },
      greeting: {
        color: palette.text,
        fontSize: threeColumns ? 27 : 22,
        lineHeight: threeColumns ? 31 : 26,
        fontWeight: '900',
        letterSpacing: -0.7,
      },
      date: {
        marginTop: 4,
        color: palette.muted,
        fontSize: 9.5,
        fontWeight: '700',
      },
      quote: {
        marginTop: 9,
        color: palette.muted,
        fontSize: 10.5,
        lineHeight: 15,
        fontStyle: 'italic',
        fontWeight: '700',
      },
      progress: {
        marginTop: 10,
        borderRadius: 16,
        padding: 9,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      progressIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.secondarySoft,
      },
      progressCopy: { flex: 1, minWidth: 0 },
      progressRank: { color: palette.text, fontSize: 10, fontWeight: '900' },
      progressMeta: { marginTop: 2, color: palette.muted, fontSize: 7.5, fontWeight: '700' },
      points: { color: palette.text, fontSize: 13, fontWeight: '900', textAlign: 'center' },
      pointsLabel: { color: palette.muted, fontSize: 6.8, fontWeight: '800', textAlign: 'center' },
      customize: {
        position: 'absolute',
        top: 9,
        right: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      customizeText: { color: palette.primary, fontSize: 7.5, fontWeight: '900' },
      floorStrip: {
        height: 50,
        backgroundColor: palette.floor,
        borderTopWidth: 6,
        borderTopColor: palette.wood,
        justifyContent: 'center',
        paddingHorizontal: 12,
      },
      floorText: {
        color: palette.surface,
        opacity: 0.9,
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.7,
      },
      modeBar: {
        marginHorizontal: 10,
        marginBottom: 9,
        flexDirection: 'row',
        gap: 6,
        padding: 7,
        borderRadius: 19,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      modeTile: {
        flex: 1,
        minHeight: 76,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        backgroundColor: palette.wall,
        borderWidth: 1,
        borderColor: palette.border,
      },
      modeTileActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
      modeLabel: { marginTop: 4, color: palette.text, fontSize: 9.5, fontWeight: '900' },
      modeSub: { marginTop: 1, color: palette.muted, fontSize: 6.5, lineHeight: 9, textAlign: 'center', fontWeight: '700' },
      askBar: {
        marginHorizontal: 10,
        marginBottom: 9,
        flexDirection: 'row',
        gap: 7,
        alignItems: 'center',
        borderRadius: 16,
        padding: 8,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      askIcon: {
        width: 32,
        height: 32,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primarySoft,
      },
      askInput: { flex: 1, minHeight: 36, color: palette.text, fontSize: 9.5, fontWeight: '700' },
      askGo: {
        minWidth: 42,
        minHeight: 32,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primary,
      },
      askGoText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
      rooms: {
        paddingHorizontal: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '1.9%',
        rowGap: 9,
      },
      room: {
        minHeight: 238,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.wallAlt,
      },
      roomBeam: { height: 7, backgroundColor: palette.wood },
      roomContent: { flex: 1, padding: 10, backgroundColor: palette.wall },
      roomTitleRow: { flexDirection: 'row', gap: 7, alignItems: 'center', marginBottom: 8 },
      roomIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primarySoft,
      },
      roomTitleCopy: { flex: 1, minWidth: 0 },
      roomTitle: { color: palette.text, fontSize: 11.5, fontWeight: '900' },
      roomSub: { marginTop: 1, color: palette.muted, fontSize: 7.7, lineHeight: 10.5, fontWeight: '700' },
      objectRow: {
        minHeight: 50,
        borderRadius: 13,
        paddingHorizontal: 7,
        paddingVertical: 6,
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      objectIcon: {
        width: 29,
        height: 29,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.secondarySoft,
      },
      objectCopy: { flex: 1, minWidth: 0 },
      objectTitle: { color: palette.text, fontSize: 9, lineHeight: 11.5, fontWeight: '900' },
      objectDetail: { marginTop: 1, color: palette.muted, fontSize: 7.3, lineHeight: 9.5, fontWeight: '700' },
      miniButton: {
        minWidth: 33,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        backgroundColor: palette.primarySoft,
      },
      timerValue: { color: palette.primary, fontSize: 15, fontWeight: '900' },
      timerChoices: { flexDirection: 'row', gap: 4, marginTop: 4 },
      timerChoice: {
        flex: 1,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      timerChoiceText: { color: palette.primary, fontSize: 7, fontWeight: '900' },
      drawerRow: { flexDirection: 'row', gap: 5, marginBottom: 6 },
      drawerInput: {
        flex: 1,
        minHeight: 34,
        borderRadius: 10,
        paddingHorizontal: 8,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        color: palette.text,
        fontSize: 8,
        fontWeight: '700',
      },
      drawerAdd: {
        width: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primary,
      },
      drawerAddText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900' },
      householdFaces: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 7 },
      face: {
        width: 33,
        height: 33,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      footer: {
        margin: 10,
        marginTop: 12,
        flexDirection: 'row',
        gap: 3,
        padding: 6,
        borderRadius: 19,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      footerItem: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2 },
      footerActive: { backgroundColor: palette.primarySoft },
      footerText: { color: palette.muted, fontSize: 7, fontWeight: '800' },
    }),
    [palette, threeColumns],
  );

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      AsyncStorage.getItem(modeKey),
      AsyncStorage.getItem(themeKey),
      AsyncStorage.getItem(doneKey),
      AsyncStorage.getItem(drawerKey),
      AsyncStorage.getItem(timerKey),
    ]).then(([storedMode, storedTheme, storedDone, storedDrawer, storedTimer]) => {
      if (!mounted) return;
      if (MODE_OPTIONS.some((item) => item.value === storedMode)) setMode(storedMode as BuklodHomeMode);
      if (isBuklodHomeThemeId(storedTheme)) setHomeThemeId(storedTheme);
      if (storedDone) {
        try { setCompletedToday(JSON.parse(storedDone)); } catch { setCompletedToday({}); }
      }
      if (storedDrawer) {
        try {
          const parsed = JSON.parse(storedDrawer);
          if (Array.isArray(parsed)) setDrawerNotes(parsed);
        } catch { setDrawerNotes([]); }
      }
      const parsedTimer = Number(storedTimer);
      if (Number.isFinite(parsedTimer) && parsedTimer > Date.now()) setTimerEndAt(parsedTimer);
    });
    return () => { mounted = false; };
  }, [modeKey, themeKey, doneKey, drawerKey, timerKey]);

  useEffect(() => {
    let mounted = true;
    const loadProgress = async () => {
      if (!profile?.id) return;
      try {
        const [rankResult, pointsResult] = await Promise.all([
          (supabase as any).rpc('get_member_circle_ranks_v1', { p_user_ids: [profile.id] }),
          loadBuklodPointsDashboard(),
        ]);
        if (!mounted) return;
        const rankRows = Array.isArray(rankResult?.data) ? rankResult.data : rankResult?.data ? [rankResult.data] : [];
        const rankRow = rankRows.find((row: any) => row?.user_id === profile.id) ?? rankRows[0];
        setCircleRank(rankRow?.rank_name || 'Circle Starter V');
        setLifetimePoints(pointsResult?.lifetime_points ?? 0);
        setAvailablePoints(pointsResult?.available_points ?? 0);
      } catch {
        // Home stays usable even if progression is temporarily unavailable.
      }
    };
    void loadProgress();
    return () => { mounted = false; };
  }, [profile?.id]);

  useEffect(() => {
    if (!timerEndAt) {
      setTimerRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
      setTimerRemaining(remaining);
      if (remaining <= 0) {
        setTimerEndAt(null);
        void AsyncStorage.removeItem(timerKey);
        Alert.alert('BUKLOD Timer', 'Tapos na ang timer.');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerEndAt, timerKey]);

  const selectMode = (next: BuklodHomeMode) => {
    setMode(next);
    void AsyncStorage.setItem(modeKey, next);
  };

  const selectTheme = (next: BuklodHomeThemeId) => {
    setHomeThemeId(next);
    void AsyncStorage.setItem(themeKey, next);
  };

  const toggleToday = (id: string) => {
    const next = { ...completedToday, [id]: !completedToday[id] };
    setCompletedToday(next);
    void AsyncStorage.setItem(doneKey, JSON.stringify(next));
  };

  const startTimer = (minutes: number) => {
    const endAt = Date.now() + minutes * 60_000;
    setTimerEndAt(endAt);
    void AsyncStorage.setItem(timerKey, String(endAt));
  };

  const stopTimer = () => {
    setTimerEndAt(null);
    setTimerRemaining(0);
    void AsyncStorage.removeItem(timerKey);
  };

  const saveDrawer = (notes: DrawerNote[]) => {
    setDrawerNotes(notes);
    void AsyncStorage.setItem(drawerKey, JSON.stringify(notes));
  };

  const addDrawerNote = () => {
    const text = drawerDraft.trim();
    if (!text) return;
    saveDrawer([{ id: `${Date.now()}`, text, done: false }, ...drawerNotes]);
    setDrawerDraft('');
  };

  const runAsk = () => {
    const input = askDraft.trim();
    if (!input) return;
    const lower = input.toLowerCase();
    const minuteMatch = lower.match(/(\d+)\s*(?:min|minute)/);
    if (lower.includes('timer') || lower.includes('sinaing')) {
      startTimer(minuteMatch ? Math.max(1, Number(minuteMatch[1])) : 20);
      setAskDraft('');
      return;
    }
    if (lower.includes('bayanihan')) {
      setAskDraft('');
      router.push('/bayanihan' as any);
      return;
    }
    if (lower.includes('community') || lower.includes('wall')) {
      setAskDraft('');
      router.push('/(tabs)/buklod' as any);
      return;
    }
    if (lower.includes('bible') || lower.includes('devotion')) {
      setAskDraft('');
      router.push('/bible' as any);
      return;
    }
    Alert.alert('Ask BUKLOD', 'Home command layer is ready. Full AI recipes, finance and health services remain separate verified integrations.');
  };

  const RoomHeader = ({ title, subtitle, icon }: { title: string; subtitle: string; icon: IconName }) => (
    <View style={styles.roomTitleRow}>
      <View style={styles.roomIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={palette.primary} />
      </View>
      <View style={styles.roomTitleCopy}>
        <Text style={styles.roomTitle}>{title}</Text>
        <Text style={styles.roomSub} numberOfLines={2}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={16} color={palette.primary} />
    </View>
  );

  const ObjectRow = ({
    icon,
    title,
    detail,
    onPress,
    right,
  }: {
    icon: IconName;
    title: string;
    detail: string;
    onPress?: () => void;
    right?: React.ReactNode;
  }) => {
    const inner = (
      <>
        <View style={styles.objectIcon}>
          <MaterialCommunityIcons name={icon} size={16} color={palette.secondary} />
        </View>
        <View style={styles.objectCopy}>
          <Text style={styles.objectTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.objectDetail} numberOfLines={2}>{detail}</Text>
        </View>
        {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={14} color={palette.muted} /> : null)}
      </>
    );
    return onPress ? (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.objectRow, pressed && { opacity: 0.78 }]}>{inner}</Pressable>
    ) : (
      <View style={styles.objectRow}>{inner}</View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <BuklodHomeThemePicker
        visible={themePickerOpen}
        selectedThemeId={homeThemeId}
        onSelect={selectTheme}
        onClose={() => setThemePickerOpen(false)}
      />

      <View style={styles.homeShell}>
        <View style={styles.ceiling} />

        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.brandButton} accessibilityLabel="Back to Community Map">
            <MaterialCommunityIcons name="home" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>BUKLOD HOME</Text>
            <Text style={styles.brandSub}>{homeTheme.label} · your digital home for real-life communities</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/buklod' as any)} style={styles.topAction}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={19} color={palette.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/me' as any)} style={styles.topAction}>
            <MaterialCommunityIcons name="account-outline" size={20} color={palette.primary} />
          </Pressable>
        </View>

        <View style={styles.livingRoom}>
          <View style={styles.livingWall}>
            <Pressable onPress={() => router.push('/points' as any)} style={styles.characterZone}>
              <BuklodActiveCharacterArt
                fallbackCharacter={DEFAULT_CHARACTER}
                height={204}
                viewportWidth={220}
                showStage={false}
                showEffects={false}
              />
            </Pressable>

            <View style={styles.livingCopy}>
              <Text style={styles.greeting}>{getBuklodHomeGreeting(daypart)}, {firstName}!</Text>
              <Text style={styles.date}>{formatBuklodHomeDate()}</Text>
              <Text style={styles.quote}>
                {showFaithContent
                  ? 'Faith, family and purpose — one day at a time.'
                  : 'One clear step at a time. Your Home keeps what matters close.'}
              </Text>
              <Pressable onPress={() => router.push('/points' as any)} style={styles.progress}>
                <View style={styles.progressIcon}>
                  <MaterialCommunityIcons name="home-heart" size={20} color={palette.secondary} />
                </View>
                <View style={styles.progressCopy}>
                  <Text style={styles.progressRank} numberOfLines={1}>{circleRank}</Text>
                  <Text style={styles.progressMeta}>Character + Home progression</Text>
                </View>
                <View>
                  <Text style={styles.points}>{availablePoints.toLocaleString()}</Text>
                  <Text style={styles.pointsLabel}>available</Text>
                  <Text style={styles.pointsLabel}>{lifetimePoints.toLocaleString()} lifetime</Text>
                </View>
              </Pressable>
            </View>

            <Pressable onPress={() => setThemePickerOpen(true)} style={styles.customize}>
              <MaterialCommunityIcons name="palette-outline" size={14} color={palette.primary} />
              <Text style={styles.customizeText}>Customize</Text>
            </Pressable>
          </View>

          <View style={styles.floorStrip}>
            <Text style={styles.floorText}>LIVING ROOM · CHARACTER · FAMILY LIFE</Text>
          </View>
        </View>

        <View style={styles.modeBar}>
          {MODE_OPTIONS.map((option) => {
            const active = option.value === mode;
            return (
              <Pressable key={option.value} onPress={() => selectMode(option.value)} style={[styles.modeTile, active && styles.modeTileActive]}>
                <MaterialCommunityIcons name={option.icon} size={22} color={active ? palette.primary : palette.muted} />
                <Text style={styles.modeLabel}>{option.label}</Text>
                <Text style={styles.modeSub} numberOfLines={2}>{option.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.askBar}>
          <View style={styles.askIcon}>
            <MaterialCommunityIcons name="creation" size={17} color={palette.primary} />
          </View>
          <TextInput
            value={askDraft}
            onChangeText={setAskDraft}
            onSubmitEditing={runAsk}
            placeholder="Ask BUKLOD… timer ng sinaing 20 minutes"
            placeholderTextColor={palette.muted}
            style={styles.askInput}
            returnKeyType="send"
          />
          <Pressable onPress={runAsk} style={styles.askGo}><Text style={styles.askGoText}>GO</Text></Pressable>
        </View>

        <View style={styles.rooms}>
          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Kitchen" subtitle="Cook, time, plan meals." icon="pot-steam-outline" />
              <View style={styles.objectRow}>
                <View style={styles.objectIcon}><MaterialCommunityIcons name="rice" size={16} color={palette.secondary} /></View>
                <View style={styles.objectCopy}>
                  <Text style={styles.objectTitle}>Rice / Kitchen Timer</Text>
                  <Text style={styles.timerValue}>{timerEndAt ? formatRemaining(timerRemaining) : 'Ready'}</Text>
                </View>
                <Pressable onPress={() => startTimer(20)} style={styles.miniButton}>
                  <MaterialCommunityIcons name="play" size={15} color={palette.primary} />
                </Pressable>
              </View>
              <View style={styles.timerChoices}>
                {[10, 20, 30].map((minutes) => (
                  <Pressable key={minutes} onPress={() => startTimer(minutes)} style={styles.timerChoice}>
                    <Text style={styles.timerChoiceText}>{minutes}m</Text>
                  </Pressable>
                ))}
                <Pressable onPress={stopTimer} style={styles.timerChoice}><Text style={styles.timerChoiceText}>Stop</Text></Pressable>
              </View>
              <ObjectRow icon="chef-hat" title="AI Recipe" detail="Recipe assistant slot; no fake recommendation is generated." />
              <ObjectRow icon="food-apple-outline" title="Meals & Wellness" detail="Health and calorie tools stay private to the user." />
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Study & Work" subtitle={`${doneCount}/${todayItems.length} priorities done`} icon="laptop" />
              {todayItems.slice(0, 3).map((item) => {
                const done = Boolean(completedToday[item.id]);
                return (
                  <Pressable key={item.id} onPress={() => toggleToday(item.id)} style={styles.objectRow}>
                    <View style={styles.objectIcon}>
                      <MaterialCommunityIcons name={done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={16} color={palette.secondary} />
                    </View>
                    <View style={styles.objectCopy}>
                      <Text style={[styles.objectTitle, done && { textDecorationLine: 'line-through', color: palette.muted }]} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.objectDetail} numberOfLines={1}>{item.detail}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Relax & Enjoy" subtitle="Living-room entertainment." icon="television-classic" />
              <ObjectRow icon="play-box-multiple-outline" title="BUKLOD IGPAT" detail="An Instant Bond." onPress={() => router.push('/igpat' as any)} />
              <ObjectRow icon="account-multiple-outline" title="Community Wall" detail="Your community outside the house." onPress={() => router.push('/(tabs)/buklod' as any)} />
              <ObjectRow icon="music" title="Music & Media" detail="Media door ready for supported providers." />
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="My Drawer" subtitle="Bills, dates and notes." icon="archive-outline" />
              <View style={styles.drawerRow}>
                <TextInput
                  value={drawerDraft}
                  onChangeText={setDrawerDraft}
                  onSubmitEditing={addDrawerNote}
                  placeholder="Add bill, date, or note"
                  placeholderTextColor={palette.muted}
                  style={styles.drawerInput}
                  returnKeyType="done"
                />
                <Pressable onPress={addDrawerNote} style={styles.drawerAdd}><Text style={styles.drawerAddText}>ADD</Text></Pressable>
              </View>
              {drawerNotes.length ? drawerNotes.slice(0, 3).map((note) => (
                <Pressable
                  key={note.id}
                  onPress={() => saveDrawer(drawerNotes.map((item) => item.id === note.id ? { ...item, done: !item.done } : item))}
                  onLongPress={() => saveDrawer(drawerNotes.filter((item) => item.id !== note.id))}
                  style={styles.objectRow}
                >
                  <View style={styles.objectIcon}><MaterialCommunityIcons name={note.done ? 'checkbox-marked-circle-outline' : 'note-outline'} size={16} color={palette.secondary} /></View>
                  <View style={styles.objectCopy}>
                    <Text style={[styles.objectTitle, note.done && { textDecorationLine: 'line-through', color: palette.muted }]} numberOfLines={2}>{note.text}</Text>
                    <Text style={styles.objectDetail}>Tap done · long press remove</Text>
                  </View>
                </Pressable>
              )) : (
                <ObjectRow icon="note-plus-outline" title="Drawer is ready" detail="Add anything you do not want to forget." />
              )}
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Budget & Money" subtitle="Simple household planning." icon="cash-multiple" />
              <ObjectRow icon="arrow-down-bold-circle-outline" title="Money received" detail="Shows only real finance data when that layer is connected." />
              <ObjectRow icon="arrow-up-bold-circle-outline" title="Bills to pay" detail="Drawer bills can later feed this summary." />
              <ObjectRow icon="chart-line" title="Smart suggestion" detail="Budget guidance requires real user data." />
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Household" subtitle="Stronger together." icon="account-group-outline" />
              <View style={styles.householdFaces}>
                {['account', 'account-outline', 'account-heart-outline', 'account-child-outline'].map((icon, index) => (
                  <View key={`${icon}-${index}`} style={styles.face}>
                    <MaterialCommunityIcons name={icon as IconName} size={18} color={palette.primary} />
                  </View>
                ))}
              </View>
              <ObjectRow icon="hand-heart-outline" title="Bayanihan" detail="Shared help and meaningful community action." onPress={() => router.push('/bayanihan' as any)} />
              <ObjectRow icon="account-multiple-outline" title="People" detail="Family and trusted connections." onPress={() => router.push('/connect' as any)} />
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Bedroom" subtitle="Wind down and prepare tomorrow." icon="bed-outline" />
              <ObjectRow icon="weather-night" title="Good Night" detail="Review tomorrow, then rest." />
              <ObjectRow icon="alarm" title="Tomorrow's Alarm" detail="OS alarm integration remains separate from this visual control." />
              <ObjectRow icon="heart-outline" title="Night reminder" detail="Keep only the important things for tomorrow." />
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Front Door" subtitle="Step outside your digital Home." icon="door-open" />
              <ObjectRow icon="map-marker-radius-outline" title="Community Map" detail="Return to your neighborhood and connected places." onPress={() => router.back()} />
              <ObjectRow icon="church-outline" title="Faith / Church" detail="Open your connected faith space." onPress={() => router.push('/church' as any)} />
              <ObjectRow icon="office-building-outline" title="Organizations" detail="Enter organizations, clusters and other spaces." onPress={() => router.push('/organizations' as any)} />
            </View>
          </View>

          <View style={[styles.room, { width: roomWidth as any }]}>
            <View style={styles.roomBeam} />
            <View style={styles.roomContent}>
              <RoomHeader title="Character Corner" subtitle="Your identity and progress." icon="account-star-outline" />
              <ObjectRow icon="star-circle-outline" title={circleRank} detail="Circle Rank and Character progression." onPress={() => router.push('/points' as any)} />
              <ObjectRow icon="palette-outline" title={homeTheme.label} detail="Change the house theme without changing your data." onPress={() => setThemePickerOpen(true)} />
              <ObjectRow icon="shield-check-outline" title="Stable Home" detail="Theme changes appearance only." />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {[
            { label: 'Home', icon: 'home', route: '/personal-home', active: true },
            { label: 'People', icon: 'account-group-outline', route: '/connect' },
            { label: 'Community', icon: 'account-multiple-outline', route: '/(tabs)/buklod' },
            { label: 'IGPAT', icon: 'compass-outline', route: '/igpat' },
            { label: 'Me', icon: 'account-outline', route: '/(tabs)/me' },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => item.active ? undefined : router.push(item.route as any)}
              style={[styles.footerItem, item.active && styles.footerActive]}
            >
              <MaterialCommunityIcons name={item.icon as IconName} size={19} color={item.active ? palette.primary : palette.muted} />
              <Text style={[styles.footerText, item.active && { color: palette.primary }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
