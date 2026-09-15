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

const MODES: Array<{
  value: BuklodHomeMode;
  label: string;
  icon: IconName;
}> = [
  { value: 'home', label: 'Home', icon: 'home-heart' },
  { value: 'work', label: 'Work', icon: 'briefcase-outline' },
  { value: 'school', label: 'School', icon: 'school-outline' },
  { value: 'business', label: 'Business', icon: 'chart-bar' },
];

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function BuklodSpatialHome() {
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { activeScope } = useBuklodScope();

  const userId = String(profile?.id ?? 'guest');
  const daypart = getBuklodHomeDaypart();
  const [mode, setMode] = useState<BuklodHomeMode>('home');
  const [homeThemeId, setHomeThemeId] =
    useState<BuklodHomeThemeId>(DEFAULT_BUKLOD_HOME_THEME);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [askDraft, setAskDraft] = useState('');
  const [circleRank, setCircleRank] = useState('Circle Starter V');
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [completedToday, setCompletedToday] =
    useState<Record<string, boolean>>({});
  const [drawerNotes, setDrawerNotes] = useState<DrawerNote[]>([]);
  const [drawerDraft, setDrawerDraft] = useState('');
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);

  const themePreset = getBuklodHomeTheme(homeThemeId);
  const palette = themePreset.palette;
  const compact = width < 560;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`;
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

      if (MODES.some((item) => item.value === storedMode)) {
        setMode(storedMode as BuklodHomeMode);
      }
      if (isBuklodHomeThemeId(storedTheme)) {
        setHomeThemeId(storedTheme);
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
  }, [doneKey, drawerKey, modeKey, themeKey, timerKey]);

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
          rankRows.find((row: any) => row?.user_id === profile.id) ??
          rankRows[0];

        setCircleRank(rankRow?.rank_name || 'Circle Starter V');
        setLifetimePoints(pointsResult?.lifetime_points ?? 0);
        setAvailablePoints(pointsResult?.available_points ?? 0);
      } catch {
        // Progress is enhancement data. Home stays usable when it is unavailable.
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
      const remaining = Math.max(
        0,
        Math.ceil((timerEndAt - Date.now()) / 1000),
      );
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

  const chooseTheme = (next: BuklodHomeThemeId) => {
    setHomeThemeId(next);
    void AsyncStorage.setItem(themeKey, next);
  };

  const chooseMode = (next: BuklodHomeMode) => {
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
      const minutes = minuteMatch
        ? Math.max(1, Number(minuteMatch[1]))
        : 20;
      startTimer(minutes);
      setAskDraft('');
      setAssistantOpen(false);
      return;
    }
    if (lower.includes('bayanihan')) {
      setAskDraft('');
      setAssistantOpen(false);
      router.push('/bayanihan' as any);
      return;
    }
    if (lower.includes('community') || lower.includes('wall')) {
      setAskDraft('');
      setAssistantOpen(false);
      router.push('/(tabs)/buklod' as any);
      return;
    }
    if (lower.includes('bible') || lower.includes('devotion')) {
      setAskDraft('');
      setAssistantOpen(false);
      router.push('/bible' as any);
      return;
    }

    Alert.alert(
      'Ask BUKLOD',
      'The Home command layer is ready. Full AI recipe, budget, and health services remain separate integrations.',
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: palette.canvas },
        content: {
          width: '100%',
          maxWidth: 920,
          alignSelf: 'center',
          paddingHorizontal: compact ? 0 : 10,
          paddingTop: compact ? 0 : 10,
          paddingBottom: 18,
        },
        house: {
          overflow: 'hidden',
          borderRadius: compact ? 0 : 28,
          borderWidth: compact ? 0 : 1,
          borderColor: palette.border,
          backgroundColor: palette.wall,
        },
        topBar: {
          minHeight: 64,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          backgroundColor: palette.surface,
          borderBottomWidth: 5,
          borderBottomColor: palette.wood,
        },
        logoBlock: {
          width: 42,
          height: 42,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.primary,
        },
        brandCopy: { flex: 1, minWidth: 0 },
        brand: {
          color: palette.text,
          fontSize: compact ? 17 : 20,
          fontWeight: '900',
        },
        brandSub: {
          color: palette.muted,
          fontSize: 8.5,
          fontWeight: '700',
          marginTop: 1,
        },
        topIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surfaceStrong,
        },
        living: {
          minHeight: compact ? 365 : 330,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: palette.wall,
          borderBottomWidth: 10,
          borderBottomColor: palette.wood,
        },
        window: {
          position: 'absolute',
          left: '5%',
          top: 28,
          width: '29%',
          height: compact ? 144 : 162,
          borderWidth: 7,
          borderColor: palette.wood,
          backgroundColor: palette.primarySoft,
          overflow: 'hidden',
        },
        windowSky: {
          flex: 1,
          backgroundColor: palette.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        windowCrossV: {
          position: 'absolute',
          width: 4,
          height: '100%',
          left: '49%',
          backgroundColor: palette.wood,
          opacity: 0.7,
        },
        windowCrossH: {
          position: 'absolute',
          height: 4,
          width: '100%',
          top: '49%',
          backgroundColor: palette.wood,
          opacity: 0.7,
        },
        wallMessage: {
          position: 'absolute',
          top: 24,
          right: '5%',
          width: compact ? '55%' : '52%',
        },
        greeting: {
          color: palette.text,
          fontSize: compact ? 22 : 30,
          lineHeight: compact ? 26 : 34,
          fontWeight: '900',
          letterSpacing: -0.5,
        },
        date: {
          marginTop: 4,
          color: palette.muted,
          fontSize: 9,
          fontWeight: '800',
        },
        encouragement: {
          marginTop: 8,
          color: palette.muted,
          fontSize: compact ? 9.5 : 11,
          lineHeight: compact ? 13 : 15,
          fontWeight: '700',
          fontStyle: 'italic',
        },
        rankShelf: {
          marginTop: 12,
          minHeight: 54,
          borderRadius: 15,
          paddingHorizontal: 9,
          paddingVertical: 7,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        rankIcon: {
          width: 35,
          height: 35,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.secondarySoft,
        },
        rankCopy: { flex: 1, minWidth: 0 },
        rankName: {
          color: palette.text,
          fontSize: 10,
          fontWeight: '900',
        },
        rankMeta: {
          color: palette.muted,
          fontSize: 7.5,
          marginTop: 1,
          fontWeight: '700',
        },
        rankPoints: {
          color: palette.primary,
          fontSize: 15,
          fontWeight: '900',
          textAlign: 'right',
        },
        rankPointsSub: {
          color: palette.muted,
          fontSize: 7,
          textAlign: 'right',
          fontWeight: '800',
        },
        characterZone: {
          position: 'absolute',
          left: compact ? '8%' : '12%',
          bottom: 14,
          width: compact ? 150 : 190,
          height: compact ? 205 : 235,
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        couch: {
          position: 'absolute',
          left: compact ? 16 : 28,
          bottom: 7,
          width: compact ? 190 : 270,
          height: 64,
          borderRadius: 28,
          backgroundColor: palette.surfaceStrong,
          borderWidth: 5,
          borderColor: palette.wood,
        },
        couchBack: {
          position: 'absolute',
          left: 18,
          right: 18,
          top: -34,
          height: 55,
          borderRadius: 22,
          backgroundColor: palette.surfaceStrong,
          borderWidth: 5,
          borderColor: palette.wood,
        },
        modeRail: {
          position: 'absolute',
          left: compact ? 8 : 14,
          right: compact ? 8 : 14,
          bottom: 8,
          height: 50,
          flexDirection: 'row',
          gap: 5,
          padding: 5,
          borderRadius: 15,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          opacity: 0.97,
        },
        modeButton: {
          flex: 1,
          minWidth: 0,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        },
        modeButtonActive: {
          backgroundColor: palette.primarySoft,
        },
        modeLabel: {
          fontSize: 7,
          fontWeight: '900',
          color: palette.muted,
        },
        modeLabelActive: { color: palette.primary },
        customize: {
          position: 'absolute',
          right: 10,
          top: 10,
          minHeight: 34,
          paddingHorizontal: 10,
          borderRadius: 17,
          flexDirection: 'row',
          gap: 5,
          alignItems: 'center',
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        customizeText: {
          color: palette.primary,
          fontSize: 8,
          fontWeight: '900',
        },
        askBubble: {
          position: 'absolute',
          right: 13,
          bottom: 67,
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.primary,
          borderWidth: 3,
          borderColor: palette.surface,
        },
        assistantPanel: {
          marginHorizontal: 10,
          marginTop: 10,
          borderRadius: 15,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          padding: 8,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        assistantInput: {
          flex: 1,
          minHeight: 38,
          color: palette.text,
          fontSize: 10,
          fontWeight: '700',
        },
        goButton: {
          minWidth: 46,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.primary,
        },
        goText: {
          color: '#FFFFFF',
          fontSize: 8,
          fontWeight: '900',
        },
        roomRow: {
          flexDirection: 'row',
          minHeight: compact ? 330 : 350,
          borderBottomWidth: 8,
          borderBottomColor: palette.wood,
        },
        room: {
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: palette.wallAlt,
        },
        roomLeftWall: {
          borderRightWidth: 7,
          borderRightColor: palette.wood,
        },
        roomTitlePlate: {
          position: 'absolute',
          left: 10,
          top: 10,
          minHeight: 38,
          maxWidth: '76%',
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 9,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          zIndex: 5,
        },
        roomTitle: {
          color: palette.text,
          fontSize: 10,
          fontWeight: '900',
        },
        roomSub: {
          color: palette.muted,
          fontSize: 7,
          marginTop: 1,
          fontWeight: '700',
        },
        floor: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '25%',
          backgroundColor: palette.floor,
        },
        counter: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 50,
          height: 66,
          borderRadius: 8,
          backgroundColor: palette.wood,
          borderTopWidth: 8,
          borderTopColor: palette.surfaceStrong,
        },
        cabinet: {
          position: 'absolute',
          bottom: 6,
          width: '30%',
          height: 45,
          borderWidth: 2,
          borderColor: palette.border,
          backgroundColor: palette.surfaceStrong,
        },
        cooker: {
          position: 'absolute',
          left: '9%',
          bottom: 103,
          width: compact ? 80 : 95,
          height: compact ? 83 : 98,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.surface,
          borderWidth: 4,
          borderColor: palette.border,
          zIndex: 4,
        },
        cookerLabel: {
          marginTop: 3,
          color: palette.text,
          fontSize: 7,
          fontWeight: '900',
          textAlign: 'center',
        },
        cookbook: {
          position: 'absolute',
          right: '8%',
          bottom: 114,
          width: compact ? 70 : 82,
          height: compact ? 76 : 88,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.secondarySoft,
          borderWidth: 3,
          borderColor: palette.secondary,
          transform: [{ rotate: '-3deg' }],
        },
        timerBadge: {
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 16,
          minHeight: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        timerText: {
          color: palette.primary,
          fontSize: 14,
          fontWeight: '900',
        },
        timerSmall: {
          color: palette.muted,
          fontSize: 7,
          fontWeight: '800',
        },
        desk: {
          position: 'absolute',
          left: '8%',
          right: '8%',
          bottom: 34,
          height: 54,
          backgroundColor: palette.wood,
          borderTopWidth: 8,
          borderTopColor: palette.surfaceStrong,
        },
        laptop: {
          position: 'absolute',
          left: '14%',
          bottom: 88,
          width: compact ? 90 : 118,
          height: compact ? 62 : 78,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.text,
          borderWidth: 4,
          borderColor: palette.border,
        },
        laptopScreen: {
          width: '78%',
          height: '62%',
          borderRadius: 3,
          backgroundColor: palette.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        stickyStack: {
          position: 'absolute',
          right: '6%',
          top: 64,
          width: compact ? '45%' : '42%',
          gap: 5,
        },
        sticky: {
          minHeight: 50,
          borderRadius: 4,
          paddingHorizontal: 6,
          paddingVertical: 6,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          transform: [{ rotate: '1deg' }],
        },
        stickyDone: {
          opacity: 0.58,
        },
        stickyTitle: {
          color: palette.text,
          fontSize: 7.5,
          fontWeight: '900',
        },
        stickyDetail: {
          color: palette.muted,
          fontSize: 6.5,
          lineHeight: 8,
          marginTop: 2,
          fontWeight: '700',
        },
        tv: {
          position: 'absolute',
          left: '8%',
          right: '8%',
          top: 74,
          height: compact ? 145 : 168,
          borderRadius: 14,
          padding: 8,
          backgroundColor: '#101820',
          borderWidth: 8,
          borderColor: palette.wood,
        },
        tvScreen: {
          flex: 1,
          borderRadius: 7,
          backgroundColor: palette.primarySoft,
          flexDirection: 'row',
          gap: 5,
          padding: 7,
        },
        tvChannel: {
          flex: 1,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        objectLabel: {
          color: palette.text,
          fontSize: 7,
          fontWeight: '900',
          textAlign: 'center',
        },
        speaker: {
          position: 'absolute',
          left: '24%',
          right: '24%',
          bottom: 35,
          height: 46,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          backgroundColor: palette.surfaceStrong,
          borderWidth: 3,
          borderColor: palette.wood,
        },
        dresser: {
          position: 'absolute',
          left: '8%',
          right: '8%',
          top: 76,
          bottom: 34,
          borderRadius: 8,
          padding: 8,
          backgroundColor: palette.wood,
          borderWidth: 4,
          borderColor: palette.surfaceStrong,
        },
        drawerTop: {
          flexDirection: 'row',
          gap: 5,
          marginBottom: 7,
        },
        drawerInput: {
          flex: 1,
          minHeight: 34,
          borderRadius: 7,
          paddingHorizontal: 7,
          color: palette.text,
          backgroundColor: palette.surface,
          fontSize: 8,
          fontWeight: '700',
        },
        drawerAdd: {
          width: 38,
          minHeight: 34,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.primary,
        },
        drawerFace: {
          flex: 1,
          minHeight: 52,
          borderRadius: 4,
          marginBottom: 6,
          paddingHorizontal: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          backgroundColor: palette.surface,
          borderWidth: 2,
          borderColor: palette.border,
        },
        drawerCopy: { flex: 1, minWidth: 0 },
        drawerTitle: {
          color: palette.text,
          fontSize: 7.5,
          fontWeight: '900',
        },
        drawerSub: {
          color: palette.muted,
          fontSize: 6.5,
          marginTop: 1,
          fontWeight: '700',
        },
        lowerRow: {
          flexDirection: 'row',
          minHeight: compact ? 315 : 345,
          borderBottomWidth: 8,
          borderBottomColor: palette.wood,
        },
        lowerRoom: {
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: palette.wall,
        },
        lowerDivider: {
          borderRightWidth: 6,
          borderRightColor: palette.wood,
        },
        moneyTable: {
          position: 'absolute',
          left: '11%',
          right: '11%',
          bottom: 48,
          height: 46,
          backgroundColor: palette.wood,
          borderTopWidth: 7,
          borderTopColor: palette.surfaceStrong,
        },
        piggy: {
          position: 'absolute',
          left: '18%',
          bottom: 91,
          width: compact ? 62 : 78,
          height: compact ? 58 : 70,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.secondarySoft,
          borderWidth: 3,
          borderColor: palette.secondary,
        },
        wallet: {
          position: 'absolute',
          right: '13%',
          bottom: 99,
          width: compact ? 60 : 78,
          height: compact ? 42 : 52,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.primary,
        },
        neutralNote: {
          position: 'absolute',
          left: 9,
          right: 9,
          top: 58,
          padding: 7,
          borderRadius: 8,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        neutralText: {
          color: palette.muted,
          fontSize: 7,
          lineHeight: 10,
          fontWeight: '700',
          textAlign: 'center',
        },
        sofa: {
          position: 'absolute',
          left: '8%',
          right: '8%',
          bottom: 48,
          height: 95,
          borderRadius: 24,
          backgroundColor: palette.surfaceStrong,
          borderWidth: 5,
          borderColor: palette.wood,
          paddingTop: 11,
          alignItems: 'center',
        },
        familyFaces: {
          flexDirection: 'row',
          gap: 4,
        },
        face: {
          width: compact ? 27 : 32,
          height: compact ? 27 : 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        sofaActions: {
          marginTop: 8,
          flexDirection: 'row',
          gap: 5,
        },
        sofaButton: {
          minHeight: 28,
          paddingHorizontal: 7,
          borderRadius: 9,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: palette.primarySoft,
        },
        sofaButtonText: {
          color: palette.primary,
          fontSize: 6.5,
          fontWeight: '900',
        },
        bed: {
          position: 'absolute',
          left: '8%',
          right: '5%',
          bottom: 35,
          height: 105,
          borderRadius: 8,
          backgroundColor: palette.primarySoft,
          borderWidth: 5,
          borderColor: palette.wood,
        },
        pillow: {
          position: 'absolute',
          right: 12,
          top: 9,
          width: '38%',
          height: 42,
          borderRadius: 14,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
        },
        bedside: {
          position: 'absolute',
          left: '7%',
          bottom: 36,
          width: compact ? 52 : 64,
          height: 72,
          borderRadius: 6,
          backgroundColor: palette.wood,
          alignItems: 'center',
          paddingTop: 7,
        },
        clock: {
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.surface,
          borderWidth: 2,
          borderColor: palette.border,
        },
        doorHall: {
          minHeight: 220,
          position: 'relative',
          backgroundColor: palette.wallAlt,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 22,
        },
        door: {
          width: compact ? 118 : 150,
          height: compact ? 152 : 174,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.wood,
          borderWidth: 8,
          borderColor: palette.surfaceStrong,
        },
        doorInset: {
          width: '72%',
          height: '68%',
          borderWidth: 3,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        doorText: {
          color: '#FFFFFF',
          fontSize: 8,
          fontWeight: '900',
          marginTop: 5,
        },
        rug: {
          position: 'absolute',
          bottom: 5,
          width: compact ? 150 : 210,
          height: 32,
          borderRadius: 50,
          backgroundColor: palette.surfaceStrong,
          borderWidth: 2,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rugText: {
          color: palette.muted,
          fontSize: 7,
          fontWeight: '800',
        },
        bottomNav: {
          minHeight: 66,
          flexDirection: 'row',
          backgroundColor: palette.surface,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          paddingHorizontal: 6,
          paddingVertical: 6,
        },
        navItem: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          borderRadius: 12,
        },
        navActive: {
          backgroundColor: palette.primarySoft,
        },
        navText: {
          color: palette.muted,
          fontSize: 7,
          fontWeight: '900',
        },
      }),
    [compact, palette],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.house}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.logoBlock}
            accessibilityRole="button"
            accessibilityLabel="Back to Community Map"
          >
            <MaterialCommunityIcons name="home" size={25} color="#FFFFFF" />
          </Pressable>

          <View style={styles.brandCopy}>
            <Text style={styles.brand}>BUKLOD HOME</Text>
            <Text style={styles.brandSub} numberOfLines={1}>
              {themePreset.label} · your digital home for real-life communities
            </Text>
          </View>

          <Pressable
            onPress={() => setThemePickerOpen(true)}
            style={styles.topIcon}
            accessibilityLabel="Customize Home"
          >
            <MaterialCommunityIcons
              name="palette-outline"
              size={20}
              color={palette.primary}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/me' as any)}
            style={styles.topIcon}
            accessibilityLabel="Open profile"
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={21}
              color={palette.primary}
            />
          </Pressable>
        </View>

        <View style={styles.living}>
          <View style={styles.window}>
            <View style={styles.windowSky}>
              <MaterialCommunityIcons
                name={daypart === 'night' ? 'weather-night' : 'weather-sunny'}
                size={compact ? 38 : 46}
                color={palette.secondary}
              />
            </View>
            <View style={styles.windowCrossV} />
            <View style={styles.windowCrossH} />
          </View>

          <View style={styles.wallMessage}>
            <Text style={styles.greeting}>
              {getBuklodHomeGreeting(daypart)}, {firstName}!
            </Text>
            <Text style={styles.date}>{formatBuklodHomeDate()}</Text>
            <Text style={styles.encouragement}>
              {showFaithContent
                ? 'Start the day with faith, focus, and the people that matter.'
                : 'One clear step at a time. Your Home keeps what matters close.'}
            </Text>

            <Pressable
              onPress={() => router.push('/points' as any)}
              style={styles.rankShelf}
            >
              <View style={styles.rankIcon}>
                <MaterialCommunityIcons
                  name="home-heart"
                  size={19}
                  color={palette.secondary}
                />
              </View>
              <View style={styles.rankCopy}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {circleRank}
                </Text>
                <Text style={styles.rankMeta}>Character + Home progression</Text>
              </View>
              <View>
                <Text style={styles.rankPoints}>
                  {availablePoints.toLocaleString()}
                </Text>
                <Text style={styles.rankPointsSub}>available</Text>
                <Text style={styles.rankPointsSub}>
                  {lifetimePoints.toLocaleString()} lifetime
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.couch}>
            <View style={styles.couchBack} />
          </View>

          <Pressable
            onPress={() => router.push('/points' as any)}
            style={styles.characterZone}
            accessibilityLabel="Open Character"
          >
            <BuklodActiveCharacterArt
              fallbackCharacter={DEFAULT_CHARACTER}
              height={compact ? 205 : 235}
              viewportWidth={compact ? 150 : 190}
              showStage={false}
              showEffects={false}
            />
          </Pressable>

          <Pressable
            onPress={() => setThemePickerOpen(true)}
            style={styles.customize}
          >
            <MaterialCommunityIcons
              name="palette-outline"
              size={14}
              color={palette.primary}
            />
            <Text style={styles.customizeText}>Customize</Text>
          </Pressable>

          <Pressable
            onPress={() => setAssistantOpen((open) => !open)}
            style={styles.askBubble}
            accessibilityLabel="Ask BUKLOD"
          >
            <MaterialCommunityIcons name="creation" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.modeRail}>
            {MODES.map((item) => {
              const active = mode === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => chooseMode(item.value)}
                  style={[styles.modeButton, active && styles.modeButtonActive]}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={16}
                    color={active ? palette.primary : palette.muted}
                  />
                  <Text
                    style={[
                      styles.modeLabel,
                      active && styles.modeLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {assistantOpen ? (
          <View style={styles.assistantPanel}>
            <MaterialCommunityIcons
              name="creation"
              size={18}
              color={palette.primary}
            />
            <TextInput
              value={askDraft}
              onChangeText={setAskDraft}
              onSubmitEditing={runAsk}
              placeholder="Ask BUKLOD… e.g. timer ng sinaing 20 minutes"
              placeholderTextColor={palette.muted}
              style={styles.assistantInput}
              returnKeyType="send"
            />
            <Pressable onPress={runAsk} style={styles.goButton}>
              <Text style={styles.goText}>GO</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.roomRow}>
          <View style={[styles.room, styles.roomLeftWall]}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="pot-steam-outline"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>Kitchen</Text>
                <Text style={styles.roomSub}>Timer · recipe · meals</Text>
              </View>
            </View>
            <View style={styles.floor} />

            <View style={styles.counter}>
              <View style={[styles.cabinet, { left: '3%' }]} />
              <View style={[styles.cabinet, { left: '35%' }]} />
              <View style={[styles.cabinet, { right: '3%' }]} />
            </View>

            <Pressable
              onPress={() => startTimer(20)}
              style={styles.cooker}
              accessibilityLabel="Start 20 minute rice timer"
            >
              <MaterialCommunityIcons
                name="pot-steam-outline"
                size={compact ? 30 : 38}
                color={palette.primary}
              />
              <Text style={styles.cookerLabel}>Rice Timer</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setAssistantOpen(true);
                setAskDraft('Suggest a simple recipe');
              }}
              style={styles.cookbook}
              accessibilityLabel="Ask BUKLOD for a recipe"
            >
              <MaterialCommunityIcons
                name="chef-hat"
                size={compact ? 27 : 33}
                color={palette.secondary}
              />
              <Text style={styles.cookerLabel}>AI Recipe</Text>
            </Pressable>

            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>
                {timerEndAt ? formatRemaining(timerRemaining) : 'Ready'}
              </Text>
              <Text style={styles.timerSmall}>
                {timerEndAt ? 'Tap cooker to restart 20m' : 'Tap the rice cooker'}
              </Text>
            </View>
          </View>

          <View style={styles.room}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="laptop"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>Study & Work</Text>
                <Text style={styles.roomSub}>
                  {doneCount}/{todayItems.length} priorities done
                </Text>
              </View>
            </View>
            <View style={styles.floor} />

            <View style={styles.desk} />
            <Pressable
              onPress={() => chooseMode(mode === 'school' ? 'work' : 'school')}
              style={styles.laptop}
              accessibilityLabel="Switch Study and Work mode"
            >
              <View style={styles.laptopScreen}>
                <MaterialCommunityIcons
                  name={mode === 'school' ? 'school-outline' : 'briefcase-outline'}
                  size={compact ? 24 : 30}
                  color={palette.primary}
                />
                <Text style={styles.cookerLabel}>
                  {mode === 'school' ? 'School' : 'Work'}
                </Text>
              </View>
            </Pressable>

            <View style={styles.stickyStack}>
              {todayItems.slice(0, 3).map((item) => {
                const done = Boolean(completedToday[item.id]);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleToday(item.id)}
                    style={[styles.sticky, done && styles.stickyDone]}
                  >
                    <Text style={styles.stickyTitle} numberOfLines={2}>
                      {done ? '✓ ' : '□ '}
                      {item.title}
                    </Text>
                    <Text style={styles.stickyDetail} numberOfLines={2}>
                      {item.detail}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.roomRow}>
          <View style={[styles.room, styles.roomLeftWall]}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="television"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>Relax & Enjoy</Text>
                <Text style={styles.roomSub}>Media in the living room</Text>
              </View>
            </View>
            <View style={styles.floor} />

            <View style={styles.tv}>
              <View style={styles.tvScreen}>
                <Pressable
                  onPress={() => router.push('/(tabs)/buklod' as any)}
                  style={styles.tvChannel}
                >
                  <MaterialCommunityIcons
                    name="account-multiple-outline"
                    size={compact ? 25 : 31}
                    color={palette.primary}
                  />
                  <Text style={styles.objectLabel}>Community Wall</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/igpat' as any)}
                  style={styles.tvChannel}
                >
                  <MaterialCommunityIcons
                    name="play-box-multiple-outline"
                    size={compact ? 25 : 31}
                    color={palette.secondary}
                  />
                  <Text style={styles.objectLabel}>BUKLOD IGPAT</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.speaker}>
              <MaterialCommunityIcons
                name="music-note"
                size={20}
                color={palette.primary}
              />
              <Text style={styles.objectLabel}>Music / Media</Text>
            </View>
          </View>

          <View style={styles.room}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="archive-outline"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>My Drawer</Text>
                <Text style={styles.roomSub}>Bills · dates · saved notes</Text>
              </View>
            </View>
            <View style={styles.floor} />

            <View style={styles.dresser}>
              <View style={styles.drawerTop}>
                <TextInput
                  value={drawerDraft}
                  onChangeText={setDrawerDraft}
                  onSubmitEditing={addDrawerNote}
                  placeholder="Add note"
                  placeholderTextColor={palette.muted}
                  style={styles.drawerInput}
                  returnKeyType="done"
                />
                <Pressable onPress={addDrawerNote} style={styles.drawerAdd}>
                  <MaterialCommunityIcons
                    name="plus"
                    size={18}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>

              {(drawerNotes.length
                ? drawerNotes.slice(0, 3)
                : [
                    {
                      id: 'empty',
                      text: 'Drawer is ready',
                      done: false,
                    },
                  ]
              ).map((note, index) => (
                <Pressable
                  key={note.id}
                  disabled={note.id === 'empty'}
                  onPress={() =>
                    note.id !== 'empty' &&
                    saveDrawer(
                      drawerNotes.map((item) =>
                        item.id === note.id
                          ? { ...item, done: !item.done }
                          : item,
                      ),
                    )
                  }
                  onLongPress={() =>
                    note.id !== 'empty' &&
                    saveDrawer(
                      drawerNotes.filter((item) => item.id !== note.id),
                    )
                  }
                  style={styles.drawerFace}
                >
                  <MaterialCommunityIcons
                    name={
                      note.id === 'empty'
                        ? 'note-plus-outline'
                        : note.done
                          ? 'checkbox-marked-circle-outline'
                          : index === 0
                            ? 'file-document-outline'
                            : 'bookmark-outline'
                    }
                    size={17}
                    color={palette.primary}
                  />
                  <View style={styles.drawerCopy}>
                    <Text
                      style={[
                        styles.drawerTitle,
                        note.done && { textDecorationLine: 'line-through' },
                      ]}
                      numberOfLines={1}
                    >
                      {note.text}
                    </Text>
                    <Text style={styles.drawerSub}>
                      {note.id === 'empty'
                        ? 'Add a bill, deadline, date, or note.'
                        : 'Tap = done · long press = remove'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.lowerRow}>
          <View style={[styles.lowerRoom, styles.lowerDivider]}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="cash"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>Budget & Money</Text>
                <Text style={styles.roomSub}>Wallet · bills · planning</Text>
              </View>
            </View>
            <View style={styles.floor} />
            <View style={styles.neutralNote}>
              <Text style={styles.neutralText}>
                No money amount is shown until real finance data is connected.
              </Text>
            </View>
            <View style={styles.moneyTable} />
            <View style={styles.piggy}>
              <MaterialCommunityIcons
                name="piggy-bank-outline"
                size={compact ? 28 : 36}
                color={palette.secondary}
              />
            </View>
            <View style={styles.wallet}>
              <MaterialCommunityIcons
                name="wallet-outline"
                size={compact ? 24 : 30}
                color="#FFFFFF"
              />
            </View>
          </View>

          <View style={[styles.lowerRoom, styles.lowerDivider]}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>Household</Text>
                <Text style={styles.roomSub}>People · chat · Bayanihan</Text>
              </View>
            </View>
            <View style={styles.floor} />
            <View style={styles.sofa}>
              <View style={styles.familyFaces}>
                {[
                  'account-outline',
                  'account-outline',
                  'account-outline',
                  'account-child-outline',
                ].map((icon, index) => (
                  <View key={`${icon}-${index}`} style={styles.face}>
                    <MaterialCommunityIcons
                      name={icon as IconName}
                      size={compact ? 16 : 19}
                      color={palette.primary}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.sofaActions}>
                <Pressable
                  onPress={() => router.push('/connect' as any)}
                  style={styles.sofaButton}
                >
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={13}
                    color={palette.primary}
                  />
                  <Text style={styles.sofaButtonText}>People</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/bayanihan' as any)}
                  style={styles.sofaButton}
                >
                  <MaterialCommunityIcons
                    name="hand-heart-outline"
                    size={13}
                    color={palette.primary}
                  />
                  <Text style={styles.sofaButtonText}>Bayanihan</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.lowerRoom}>
            <View style={styles.roomTitlePlate}>
              <MaterialCommunityIcons
                name="weather-night"
                size={18}
                color={palette.primary}
              />
              <View>
                <Text style={styles.roomTitle}>Good Night</Text>
                <Text style={styles.roomSub}>Rest · reminder · alarm</Text>
              </View>
            </View>
            <View style={styles.floor} />
            <View style={styles.bed}>
              <View style={styles.pillow} />
            </View>
            <View style={styles.bedside}>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Alarm',
                    'No OS alarm is scheduled from this design surface yet.',
                  )
                }
                style={styles.clock}
                accessibilityLabel="Alarm clock"
              >
                <MaterialCommunityIcons
                  name="alarm"
                  size={compact ? 22 : 27}
                  color={palette.primary}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.doorHall}>
          <Pressable
            onPress={() => router.back()}
            style={styles.door}
            accessibilityLabel="Exit Home to Community Map"
          >
            <View style={styles.doorInset}>
              <MaterialCommunityIcons
                name="door-open"
                size={38}
                color="#FFFFFF"
              />
              <Text style={styles.doorText}>COMMUNITY MAP</Text>
            </View>
          </Pressable>
          <View style={styles.rug}>
            <Text style={styles.rugText}>Home · real life connected</Text>
          </View>
        </View>

        <View style={styles.bottomNav}>
          {[
            {
              label: 'Home',
              icon: 'home',
              route: '/personal-home',
              active: true,
            },
            {
              label: 'People',
              icon: 'account-group-outline',
              route: '/connect',
            },
            {
              label: 'Community',
              icon: 'account-multiple-outline',
              route: '/(tabs)/buklod',
            },
            {
              label: 'IGPAT',
              icon: 'play-box-multiple-outline',
              route: '/igpat',
            },
            {
              label: 'Me',
              icon: 'account-outline',
              route: '/(tabs)/me',
            },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() =>
                item.active ? undefined : router.push(item.route as any)
              }
              style={[styles.navItem, item.active && styles.navActive]}
            >
              <MaterialCommunityIcons
                name={item.icon as IconName}
                size={19}
                color={item.active ? palette.primary : palette.muted}
              />
              <Text
                style={[
                  styles.navText,
                  item.active && { color: palette.primary },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <BuklodHomeThemePicker
        visible={themePickerOpen}
        selectedThemeId={homeThemeId}
        onSelect={chooseTheme}
        onClose={() => setThemePickerOpen(false)}
      />
    </ScrollView>
  );
}
