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

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';
import {
  formatBuklodHomeDate,
  getBuklodHomeDaypart,
  getBuklodHomeGreeting,
  getBuklodHomeTodayItems,
  type BuklodHomeMode,
} from '@/lib/buklodHomeModel';
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

type ModeOption = {
  value: BuklodHomeMode;
  label: string;
  subtitle: string;
  icon: IconName;
};

const MODE_OPTIONS: ModeOption[] = [
  { value: 'home', label: 'Home', subtitle: 'Family & Personal', icon: 'home-heart' },
  { value: 'work', label: 'Work', subtitle: 'Get Things Done', icon: 'briefcase-outline' },
  { value: 'school', label: 'School', subtitle: 'Learn & Grow', icon: 'school-outline' },
  { value: 'business', label: 'Business', subtitle: 'Build & Earn', icon: 'chart-bar' },
];

const CARD_TONES = {
  morning: { surface: '#FFF8E8', icon: '#F59E0B', soft: '#FFF0C7' },
  home: { surface: '#F0FBF5', icon: '#12A66A', soft: '#DDF7E9' },
  health: { surface: '#FFF2F3', icon: '#F04455', soft: '#FFE2E5' },
  tasks: { surface: '#F6F1FF', icon: '#8A48E8', soft: '#EBDDFF' },
  relax: { surface: '#EEF8FF', icon: '#2487E8', soft: '#DDEEFF' },
  drawer: { surface: '#F7F1FF', icon: '#914BEA', soft: '#EADDFB' },
  money: { surface: '#F0FBF6', icon: '#13A66A', soft: '#DDF7E9' },
  household: { surface: '#FFF5EC', icon: '#FF7C32', soft: '#FFE8D7' },
  night: { surface: '#EFF3FF', icon: '#264F9B', soft: '#DCE5FF' },
};

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PersonalHomeScreen() {
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { activeScope } = useBuklodScope();
  const { theme } = useBuklodPresentation();

  const userId = String(profile?.id ?? 'guest');
  const daypart = getBuklodHomeDaypart();
  const [mode, setMode] = useState<BuklodHomeMode>('home');
  const [circleRank, setCircleRank] = useState('Circle Starter V');
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [drawerNotes, setDrawerNotes] = useState<DrawerNote[]>([]);
  const [drawerDraft, setDrawerDraft] = useState('');
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [askDraft, setAskDraft] = useState('');

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const modeKey = `buklod.personal-home.mode.${userId}`;
  const doneKey = `buklod.personal-home.today.${userId}.${todayKey}`;
  const drawerKey = `buklod.personal-home.drawer.${userId}`;
  const timerKey = `buklod.personal-home.timer.${userId}`;

  const showFaithContent = Boolean(activeScope?.show_faith_content);
  const todayItems = useMemo(
    () =>
      getBuklodHomeTodayItems({
        daypart,
        mode,
        showFaithContent,
      }),
    [daypart, mode, showFaithContent],
  );

  const threeColumns = width >= 390;
  const cardWidth = threeColumns ? '32%' : '48.5%';
  const displayName = resolvePersonDisplayName(profile, profile?.id);
  const firstName = String(displayName || 'Friend').split(' ')[0];
  const doneCount = todayItems.filter((item) => completedToday[item.id]).length;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#F7FAFD' },
        content: {
          width: '100%',
          maxWidth: 980,
          alignSelf: 'center',
          paddingHorizontal: 10,
          paddingTop: 10,
          paddingBottom: 32,
          gap: 10,
        },
        brandBar: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 6,
          paddingVertical: 4,
        },
        brandHome: {
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#123D7A',
        },
        brandCopy: { flex: 1, minWidth: 0 },
        brandTitle: {
          color: '#123D7A',
          fontSize: 21,
          lineHeight: 23,
          fontWeight: '900',
          letterSpacing: -0.5,
        },
        brandSubtitle: {
          marginTop: 1,
          color: '#315175',
          fontSize: 9.5,
          lineHeight: 13,
          fontWeight: '700',
        },
        roundButton: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E1EAF4',
        },
        hero: {
          minHeight: 214,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: '#EDF7FF',
          borderWidth: 1,
          borderColor: '#D9E9F7',
          padding: 14,
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 12,
        },
        heroCharacter: {
          width: threeColumns ? '34%' : '38%',
          minWidth: 112,
          borderRadius: 19,
          overflow: 'hidden',
          backgroundColor: '#FFF6E8',
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        heroCopy: {
          flex: 1,
          minWidth: 0,
          justifyContent: 'center',
        },
        greeting: {
          color: '#102F69',
          fontSize: threeColumns ? 29 : 24,
          lineHeight: threeColumns ? 33 : 28,
          fontWeight: '900',
          letterSpacing: -0.7,
        },
        date: {
          marginTop: 5,
          color: '#58708E',
          fontSize: 10.5,
          fontWeight: '700',
        },
        encouragement: {
          marginTop: 11,
          color: '#355478',
          fontSize: 11.5,
          lineHeight: 17,
          fontStyle: 'italic',
          fontWeight: '700',
        },
        progressPanel: {
          marginTop: 12,
          borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: '#DFE9F4',
          paddingHorizontal: 11,
          paddingVertical: 9,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
        },
        progressIcon: {
          width: 38,
          height: 38,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFF0C8',
        },
        progressCopy: { flex: 1, minWidth: 0 },
        progressRank: {
          color: '#17386E',
          fontSize: 11,
          fontWeight: '900',
        },
        progressMeta: {
          marginTop: 2,
          color: '#5A7190',
          fontSize: 9,
          fontWeight: '700',
        },
        progressDivider: {
          width: 1,
          alignSelf: 'stretch',
          backgroundColor: '#E5ECF4',
        },
        pointsValue: {
          color: '#17386E',
          fontSize: 14,
          fontWeight: '900',
          textAlign: 'center',
        },
        pointsLabel: {
          color: '#637995',
          fontSize: 8,
          fontWeight: '800',
          textAlign: 'center',
        },
        customizeButton: {
          position: 'absolute',
          right: 10,
          top: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 9,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#D9E5F1',
        },
        customizeText: {
          color: '#21477A',
          fontSize: 8.5,
          fontWeight: '900',
        },
        modeBar: {
          flexDirection: 'row',
          gap: 7,
          padding: 8,
          borderRadius: 21,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E4EBF4',
        },
        modeTile: {
          flex: 1,
          minWidth: 0,
          minHeight: 88,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          borderWidth: 1,
          borderColor: '#EDF1F7',
          backgroundColor: '#EFF6FD',
        },
        modeTileActive: {
          backgroundColor: '#E6F8EF',
          borderColor: '#CDEDDD',
        },
        modeLabel: {
          marginTop: 5,
          color: '#17386E',
          fontSize: 11,
          fontWeight: '900',
        },
        modeSubtitle: {
          marginTop: 1,
          color: '#68809A',
          fontSize: 7.5,
          lineHeight: 10,
          textAlign: 'center',
          fontWeight: '700',
        },
        askBar: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          borderRadius: 17,
          padding: 8,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E4EBF4',
        },
        askIcon: {
          width: 34,
          height: 34,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#EDF5FF',
        },
        askInput: {
          flex: 1,
          minHeight: 38,
          color: '#17386E',
          fontSize: 10.5,
          fontWeight: '700',
        },
        askGo: {
          minWidth: 44,
          minHeight: 34,
          paddingHorizontal: 10,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1B73D1',
        },
        askGoText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
        lifeGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '1.9%',
          rowGap: 9,
          alignItems: 'stretch',
        },
        lifeCard: {
          minHeight: 230,
          borderRadius: 21,
          borderWidth: 1,
          padding: 11,
          overflow: 'hidden',
        },
        lifeHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 9,
        },
        lifeIcon: {
          width: 39,
          height: 39,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
        },
        lifeHeaderCopy: { flex: 1, minWidth: 0 },
        lifeTitle: {
          color: '#153568',
          fontSize: 12.5,
          fontWeight: '900',
        },
        lifeSubtitle: {
          marginTop: 1,
          color: '#687D98',
          fontSize: 8.5,
          lineHeight: 11,
          fontWeight: '700',
        },
        infoRow: {
          minHeight: 52,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.82)',
          borderWidth: 1,
          borderColor: 'rgba(220,229,239,0.85)',
          paddingHorizontal: 8,
          paddingVertical: 7,
          marginBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
        },
        infoIcon: {
          width: 29,
          height: 29,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        infoCopy: { flex: 1, minWidth: 0 },
        infoTitle: {
          color: '#1C3B6D',
          fontSize: 9.5,
          lineHeight: 12,
          fontWeight: '900',
        },
        infoDetail: {
          marginTop: 1,
          color: '#637A96',
          fontSize: 8,
          lineHeight: 10.5,
          fontWeight: '700',
        },
        miniAction: {
          minWidth: 35,
          height: 29,
          paddingHorizontal: 7,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F4F8FC',
        },
        miniActionText: {
          color: '#276FC0',
          fontSize: 8,
          fontWeight: '900',
        },
        timerValue: {
          color: '#17386E',
          fontSize: 18,
          fontWeight: '900',
        },
        timerButtons: {
          flexDirection: 'row',
          gap: 4,
          marginTop: 6,
        },
        timerButton: {
          flex: 1,
          minHeight: 28,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#DDE7F0',
        },
        timerButtonText: {
          color: '#2376C8',
          fontSize: 7.5,
          fontWeight: '900',
        },
        drawerInputRow: {
          flexDirection: 'row',
          gap: 5,
          alignItems: 'center',
          marginBottom: 7,
        },
        drawerInput: {
          flex: 1,
          minHeight: 35,
          borderRadius: 11,
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#DFE7F0',
          color: '#17386E',
          fontSize: 8.5,
          fontWeight: '700',
        },
        addButton: {
          minHeight: 35,
          minWidth: 38,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#8A48E8',
        },
        addButtonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
        householdFaces: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 7,
        },
        face: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E3E9EF',
        },
        footerNav: {
          flexDirection: 'row',
          gap: 4,
          padding: 7,
          borderRadius: 21,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E0E8F1',
        },
        footerItem: {
          flex: 1,
          minHeight: 52,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        },
        footerItemActive: { backgroundColor: '#EAF4FF' },
        footerText: {
          color: '#234777',
          fontSize: 7.5,
          fontWeight: '800',
        },
      }),
    [theme, threeColumns],
  );

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      AsyncStorage.getItem(modeKey),
      AsyncStorage.getItem(doneKey),
      AsyncStorage.getItem(drawerKey),
      AsyncStorage.getItem(timerKey),
    ]).then(([storedMode, storedDone, storedDrawer, storedTimer]) => {
      if (!mounted) return;
      if (MODE_OPTIONS.some((item) => item.value === storedMode)) {
        setMode(storedMode as BuklodHomeMode);
      }
      if (storedDone) {
        try {
          setCompletedToday(JSON.parse(storedDone));
        } catch {
          setCompletedToday({});
        }
      }
      if (storedDrawer) {
        try {
          const parsed = JSON.parse(storedDrawer);
          if (Array.isArray(parsed)) setDrawerNotes(parsed);
        } catch {
          setDrawerNotes([]);
        }
      }
      const parsedTimer = Number(storedTimer);
      if (Number.isFinite(parsedTimer) && parsedTimer > Date.now()) {
        setTimerEndAt(parsedTimer);
      }
    });
    return () => {
      mounted = false;
    };
  }, [modeKey, doneKey, drawerKey, timerKey]);

  useEffect(() => {
    let mounted = true;
    const loadProgress = async () => {
      if (!profile?.id) return;
      try {
        const [rankResult, pointsResult] = await Promise.all([
          (supabase as any).rpc('get_member_circle_ranks_v1', {
            p_user_ids: [profile.id],
          }),
          loadBuklodPointsDashboard(),
        ]);
        if (!mounted) return;
        const rankRows = Array.isArray(rankResult?.data)
          ? rankResult.data
          : rankResult?.data
            ? [rankResult.data]
            : [];
        const rankRow =
          rankRows.find((row: any) => row?.user_id === profile.id) ?? rankRows[0];
        setCircleRank(rankRow?.rank_name || 'Circle Starter V');
        setLifetimePoints(pointsResult?.lifetime_points ?? 0);
        setAvailablePoints(pointsResult?.available_points ?? 0);
      } catch {
        if (!mounted) return;
      }
    };
    void loadProgress();
    return () => {
      mounted = false;
    };
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
      const minutes = minuteMatch ? Math.max(1, Number(minuteMatch[1])) : 20;
      startTimer(minutes);
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
    Alert.alert(
      'Ask BUKLOD',
      'Naka-ready ang Home command layer. Ang full AI assistant para sa recipes, budget suggestions, at mas malalim na requests ay hiwalay na implementation.',
    );
  };

  const LifeHeader = ({
    title,
    subtitle,
    icon,
    tone,
  }: {
    title: string;
    subtitle: string;
    icon: IconName;
    tone: (typeof CARD_TONES)[keyof typeof CARD_TONES];
  }) => (
    <View style={styles.lifeHeader}>
      <View style={[styles.lifeIcon, { backgroundColor: tone.soft }]}>
        <MaterialCommunityIcons name={icon} size={21} color={tone.icon} />
      </View>
      <View style={styles.lifeHeaderCopy}>
        <Text style={styles.lifeTitle}>{title}</Text>
        <Text style={styles.lifeSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={17} color={tone.icon} />
    </View>
  );

  const InfoRow = ({
    icon,
    title,
    detail,
    tone,
    onPress,
    right,
  }: {
    icon: IconName;
    title: string;
    detail: string;
    tone: (typeof CARD_TONES)[keyof typeof CARD_TONES];
    onPress?: () => void;
    right?: React.ReactNode;
  }) => {
    const content = (
      <>
        <View style={[styles.infoIcon, { backgroundColor: tone.soft }]}>
          <MaterialCommunityIcons name={icon} size={16} color={tone.icon} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.infoDetail} numberOfLines={2}>{detail}</Text>
        </View>
        {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={15} color="#7A8FA8" /> : null)}
      </>
    );
    return onPress ? (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.78 }]}>
        {content}
      </Pressable>
    ) : (
      <View style={styles.infoRow}>{content}</View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandBar}>
        <Pressable onPress={() => router.back()} style={styles.brandHome} accessibilityLabel="Back to Community Map">
          <MaterialCommunityIcons name="home" size={25} color="#FFFFFF" />
        </Pressable>
        <View style={styles.brandCopy}>
          <Text style={styles.brandTitle}>BUKLOD</Text>
          <Text style={styles.brandSubtitle}>your digital home for real-life communities.</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/buklod' as any)} style={styles.roundButton} accessibilityLabel="Open Community">
          <MaterialCommunityIcons name="magnify" size={20} color="#17386E" />
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/me' as any)} style={styles.roundButton} accessibilityLabel="Open profile">
          <MaterialCommunityIcons name="account-outline" size={21} color="#17386E" />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Pressable
          onPress={() => router.push('/points' as any)}
          style={styles.heroCharacter}
          accessibilityLabel="Open Character and Circle Points"
        >
          <BuklodActiveCharacterArt
            fallbackCharacter={DEFAULT_CHARACTER}
            height={204}
            viewportWidth={220}
            showStage={false}
            showEffects={false}
          />
        </Pressable>

        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>{getBuklodHomeGreeting(daypart)}, {firstName}!</Text>
          <Text style={styles.date}>{formatBuklodHomeDate()}</Text>
          <Text style={styles.encouragement}>
            {showFaithContent
              ? 'Start the day with faith, focus, and the people that matter.'
              : 'One clear step at a time. BUKLOD keeps what matters close.'}
          </Text>

          <Pressable onPress={() => router.push('/points' as any)} style={styles.progressPanel}>
            <View style={styles.progressIcon}>
              <MaterialCommunityIcons name="home-heart" size={22} color="#B57408" />
            </View>
            <View style={styles.progressCopy}>
              <Text style={styles.progressRank} numberOfLines={1}>{circleRank}</Text>
              <Text style={styles.progressMeta}>Character + Home progression</Text>
            </View>
            <View style={styles.progressDivider} />
            <View>
              <Text style={styles.pointsValue}>{availablePoints.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Available</Text>
              <Text style={styles.pointsLabel}>{lifetimePoints.toLocaleString()} lifetime</Text>
            </View>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/points' as any)} style={styles.customizeButton}>
          <MaterialCommunityIcons name="tshirt-crew-outline" size={14} color="#21477A" />
          <Text style={styles.customizeText}>Customize</Text>
        </Pressable>
      </View>

      <View style={styles.modeBar}>
        {MODE_OPTIONS.map((option) => {
          const active = mode === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => selectMode(option.value)}
              style={[styles.modeTile, active && styles.modeTileActive]}
            >
              <MaterialCommunityIcons
                name={option.icon}
                size={24}
                color={active ? '#12A66A' : '#34569A'}
              />
              <Text style={styles.modeLabel}>{option.label}</Text>
              <Text style={styles.modeSubtitle} numberOfLines={2}>{option.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.askBar}>
        <View style={styles.askIcon}>
          <MaterialCommunityIcons name="creation" size={18} color="#2877DD" />
        </View>
        <TextInput
          value={askDraft}
          onChangeText={setAskDraft}
          onSubmitEditing={runAsk}
          placeholder="Ask BUKLOD… e.g. timer ng sinaing 20 minutes"
          placeholderTextColor="#7890A9"
          style={styles.askInput}
          returnKeyType="send"
        />
        <Pressable onPress={runAsk} style={styles.askGo}>
          <Text style={styles.askGoText}>GO</Text>
        </Pressable>
      </View>

      <View style={styles.lifeGrid}>
        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.morning.surface, borderColor: '#F5E4BD' }]}>
          <LifeHeader title="My Morning" subtitle="A good day starts here." icon="weather-sunny" tone={CARD_TONES.morning} />
          <InfoRow icon="alarm" title="Alarm & reminders" detail="Your morning routine stays close to Home." tone={CARD_TONES.morning} />
          <InfoRow
            icon={showFaithContent ? 'book-open-page-variant-outline' : 'lightbulb-on-outline'}
            title={showFaithContent ? "Today's Devotion" : "Today's Encouragement"}
            detail={todayItems[0]?.detail ?? 'Start with one important thing.'}
            tone={CARD_TONES.morning}
            onPress={showFaithContent ? () => router.push('/bible' as any) : undefined}
          />
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.home.surface, borderColor: '#D4EFDF' }]}>
          <LifeHeader title="Home Tasks" subtitle="For a well-kept home." icon="pot-steam-outline" tone={CARD_TONES.home} />
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: CARD_TONES.home.soft }]}>
              <MaterialCommunityIcons name="rice" size={16} color={CARD_TONES.home.icon} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Rice / Kitchen Timer</Text>
              <Text style={styles.timerValue}>{timerEndAt ? formatRemaining(timerRemaining) : 'Ready'}</Text>
            </View>
            <Pressable onPress={() => startTimer(20)} style={styles.miniAction}>
              <MaterialCommunityIcons name="play" size={16} color="#2477C8" />
            </Pressable>
          </View>
          <View style={styles.timerButtons}>
            {[10, 20, 30].map((minutes) => (
              <Pressable key={minutes} onPress={() => startTimer(minutes)} style={styles.timerButton}>
                <Text style={styles.timerButtonText}>{minutes}m</Text>
              </Pressable>
            ))}
            <Pressable onPress={stopTimer} style={styles.timerButton}>
              <Text style={styles.timerButtonText}>Stop</Text>
            </Pressable>
          </View>
          <InfoRow icon="chef-hat" title="AI Recipe" detail="Recipe assistant slot, ready for the AI service layer." tone={CARD_TONES.home} />
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.health.surface, borderColor: '#F4D7DB' }]}>
          <LifeHeader title="Health & Meals" subtitle="A healthier you." icon="heart" tone={CARD_TONES.health} />
          <InfoRow icon="food-apple-outline" title="Meal & calorie tracker" detail="Design-ready; no fake calorie total is shown." tone={CARD_TONES.health} />
          <InfoRow icon="leaf" title="Food suggestion" detail="Will use the user's actual meal and preference data when connected." tone={CARD_TONES.health} />
          <InfoRow icon="sprout" title="Wellness tip" detail="General wellness guidance can surface here." tone={CARD_TONES.health} />
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.tasks.surface, borderColor: '#E6DBF6' }]}>
          <LifeHeader title="Tasks & Deadlines" subtitle={`${doneCount}/${todayItems.length} done today`} icon="clipboard-check-outline" tone={CARD_TONES.tasks} />
          {todayItems.slice(0, 3).map((item) => {
            const done = Boolean(completedToday[item.id]);
            return (
              <Pressable key={item.id} onPress={() => toggleToday(item.id)} style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: CARD_TONES.tasks.soft }]}>
                  <MaterialCommunityIcons name={done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={16} color={CARD_TONES.tasks.icon} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoTitle, done && { textDecorationLine: 'line-through', color: '#8994A5' }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.infoDetail} numberOfLines={1}>{item.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.relax.surface, borderColor: '#D6EAF8' }]}>
          <LifeHeader title="Relax & Enjoy" subtitle="Take a break. You deserve it." icon="gamepad-variant-outline" tone={CARD_TONES.relax} />
          <InfoRow icon="play-box-multiple-outline" title="Watch BUKLOD IGPAT" detail="An Instant Bond." tone={CARD_TONES.relax} onPress={() => router.push('/igpat' as any)} />
          <InfoRow icon="account-multiple-outline" title="Community Wall" detail="See what is happening in your community." tone={CARD_TONES.relax} onPress={() => router.push('/(tabs)/buklod' as any)} />
          <InfoRow icon="account-group-outline" title="People" detail="Open your BUKLOD connections." tone={CARD_TONES.relax} onPress={() => router.push('/connect' as any)} />
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.drawer.surface, borderColor: '#E5D9F5' }]}>
          <LifeHeader title="My Drawer" subtitle="Important things in one place." icon="archive-outline" tone={CARD_TONES.drawer} />
          <View style={styles.drawerInputRow}>
            <TextInput
              value={drawerDraft}
              onChangeText={setDrawerDraft}
              onSubmitEditing={addDrawerNote}
              placeholder="Add bill, date, or note"
              placeholderTextColor="#8895A7"
              style={styles.drawerInput}
              returnKeyType="done"
            />
            <Pressable onPress={addDrawerNote} style={styles.addButton}>
              <Text style={styles.addButtonText}>ADD</Text>
            </Pressable>
          </View>
          {drawerNotes.length ? (
            drawerNotes.slice(0, 3).map((note) => (
              <Pressable
                key={note.id}
                onPress={() => saveDrawer(drawerNotes.map((item) => item.id === note.id ? { ...item, done: !item.done } : item))}
                onLongPress={() => saveDrawer(drawerNotes.filter((item) => item.id !== note.id))}
                style={styles.infoRow}
              >
                <View style={[styles.infoIcon, { backgroundColor: CARD_TONES.drawer.soft }]}>
                  <MaterialCommunityIcons name={note.done ? 'checkbox-marked-circle-outline' : 'note-outline'} size={16} color={CARD_TONES.drawer.icon} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoTitle, note.done && { textDecorationLine: 'line-through', color: '#8994A5' }]} numberOfLines={2}>{note.text}</Text>
                  <Text style={styles.infoDetail}>Tap = done · long press = remove</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <InfoRow icon="note-plus-outline" title="Drawer is ready" detail="Add a bill, deadline, important date, or note." tone={CARD_TONES.drawer} />
          )}
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.money.surface, borderColor: '#D5EEE0' }]}>
          <LifeHeader title="Budget & Money" subtitle="Plan today. A brighter tomorrow." icon="cash" tone={CARD_TONES.money} />
          <InfoRow icon="arrow-down-bold-circle-outline" title="Money received" detail="No amount shown until the finance layer has real user data." tone={CARD_TONES.money} />
          <InfoRow icon="arrow-up-bold-circle-outline" title="Bills to pay" detail="Drawer bills can later feed this summary automatically." tone={CARD_TONES.money} />
          <InfoRow icon="chart-line" title="Smart suggestion" detail="Budget guidance slot is ready for verified financial data." tone={CARD_TONES.money} />
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.household.surface, borderColor: '#F3DFD1' }]}>
          <LifeHeader title="Household" subtitle="Stronger together." icon="account-group" tone={CARD_TONES.household} />
          <View style={styles.householdFaces}>
            {['account', 'account-outline', 'account-heart-outline', 'account-child-outline'].map((icon, index) => (
              <View key={`${icon}-${index}`} style={styles.face}>
                <MaterialCommunityIcons name={icon as IconName} size={18} color={CARD_TONES.household.icon} />
              </View>
            ))}
          </View>
          <InfoRow icon="hand-heart-outline" title="Bayanihan" detail="Shared help, responsibilities, and community action." tone={CARD_TONES.household} onPress={() => router.push('/bayanihan' as any)} />
          <InfoRow icon="account-multiple-outline" title="Household people" detail="Use BUKLOD connections now; household membership stays a separate layer." tone={CARD_TONES.household} onPress={() => router.push('/connect' as any)} />
        </View>

        <View style={[styles.lifeCard, { width: cardWidth as any, backgroundColor: CARD_TONES.night.surface, borderColor: '#D9E1F3' }]}>
          <LifeHeader title="Good Night" subtitle="Rest well for a brighter tomorrow." icon="weather-night" tone={CARD_TONES.night} />
          <InfoRow icon="bed-outline" title="Bedtime reminder" detail="Night routine slot; actual alarm integration remains separate." tone={CARD_TONES.night} />
          <InfoRow icon="alarm" title="Tomorrow's alarm" detail="Design-ready without pretending an OS alarm has been scheduled." tone={CARD_TONES.night} />
          <InfoRow icon="heart-outline" title="A reminder" detail="Review tomorrow's important items, then rest." tone={CARD_TONES.night} />
        </View>
      </View>

      <View style={styles.footerNav}>
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
            style={[styles.footerItem, item.active && styles.footerItemActive]}
          >
            <MaterialCommunityIcons name={item.icon as IconName} size={20} color={item.active ? '#1C7FD9' : '#31537F'} />
            <Text style={[styles.footerText, item.active && { color: '#1C7FD9' }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
