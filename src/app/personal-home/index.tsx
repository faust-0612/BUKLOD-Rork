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
  View,
} from 'react-native';

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';
import { loadBuklodPointsDashboard } from '@/lib/buklodRewards';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { supabase } from '@/lib/supabase';
import {
  formatBuklodHomeDate,
  getBuklodHomeDaypart,
  getBuklodHomeDaypartLabel,
  getBuklodHomeGreeting,
  getBuklodHomeModeLabel,
  getBuklodHomeTodayItems,
  type BuklodHomeMode,
} from '@/lib/buklodHomeModel';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type DrawerNote = {
  id: string;
  text: string;
  done: boolean;
};

const MODE_OPTIONS: Array<{
  value: BuklodHomeMode;
  label: string;
  icon: IconName;
}> = [
  { value: 'home', label: 'Home', icon: 'home-heart' },
  { value: 'work', label: 'Work', icon: 'briefcase-outline' },
  { value: 'school', label: 'School', icon: 'school-outline' },
  { value: 'business', label: 'Business', icon: 'storefront-outline' },
];

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PersonalHomeScreen() {
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

  const todayKey = new Date().toISOString().slice(0, 10);
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: theme.canvas,
        },
        content: {
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 96,
          gap: 10,
        },
        hero: {
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardSurface,
          padding: 16,
          overflow: 'hidden',
        },
        heroTop: {
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        },
        greetingCol: {
          flex: 1,
          minWidth: 0,
        },
        eyebrow: {
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.9,
          color: theme.accent,
        },
        greeting: {
          marginTop: 3,
          fontSize: 25,
          lineHeight: 30,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        date: {
          marginTop: 4,
          fontSize: 12,
          lineHeight: 17,
          color: theme.textMuted,
        },
        characterFrame: {
          width: 92,
          minHeight: 142,
          alignItems: 'center',
          justifyContent: 'flex-end',
          borderRadius: 18,
          backgroundColor: theme.accentSoft,
          overflow: 'hidden',
        },
        rankRow: {
          marginTop: 12,
          flexDirection: 'row',
          gap: 8,
        },
        rankChip: {
          flex: 1,
          minHeight: 52,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
        chipLabel: {
          fontSize: 8,
          fontWeight: '900',
          letterSpacing: 0.7,
          color: theme.textMuted,
        },
        chipValue: {
          marginTop: 3,
          fontSize: 12,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        modeRow: {
          flexDirection: 'row',
          gap: 6,
          marginTop: 12,
        },
        modeButton: {
          flex: 1,
          minHeight: 48,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        modeButtonActive: {
          borderColor: theme.accent,
          backgroundColor: theme.accentSoft,
        },
        modeText: {
          fontSize: 9,
          fontWeight: '900',
          color: theme.textMuted,
        },
        modeTextActive: {
          color: theme.accent,
        },
        card: {
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardSurface,
          padding: 14,
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        sectionHint: {
          marginTop: 2,
          fontSize: 11,
          lineHeight: 16,
          color: theme.textMuted,
        },
        todayItem: {
          marginTop: 9,
          minHeight: 58,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: 14,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 10,
        },
        check: {
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardSurface,
        },
        todayCopy: {
          flex: 1,
          minWidth: 0,
        },
        todayTitle: {
          fontSize: 13,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        todayDetail: {
          marginTop: 2,
          fontSize: 10.5,
          lineHeight: 15,
          color: theme.textMuted,
        },
        actionGrid: {
          marginTop: 10,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        action: {
          width: '48%',
          minHeight: 74,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          padding: 11,
          justifyContent: 'space-between',
        },
        actionLabel: {
          marginTop: 8,
          fontSize: 12,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        inputRow: {
          marginTop: 10,
          flexDirection: 'row',
          gap: 7,
          alignItems: 'center',
        },
        input: {
          flex: 1,
          minHeight: 44,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 12,
          paddingVertical: 9,
          color: theme.textPrimary,
        },
        smallButton: {
          minHeight: 44,
          paddingHorizontal: 13,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accent,
        },
        smallButtonText: {
          fontSize: 10,
          fontWeight: '900',
          color: '#FFFFFF',
        },
        timerValue: {
          marginTop: 10,
          fontSize: 31,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        timerRow: {
          flexDirection: 'row',
          gap: 7,
          marginTop: 10,
        },
        timerButton: {
          flex: 1,
          minHeight: 40,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface,
        },
        timerButtonText: {
          fontSize: 10,
          fontWeight: '900',
          color: theme.accent,
        },
        drawerItem: {
          marginTop: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderRadius: 12,
          backgroundColor: theme.surface,
          paddingHorizontal: 10,
          paddingVertical: 9,
        },
        drawerText: {
          flex: 1,
          fontSize: 11.5,
          lineHeight: 16,
          color: theme.textPrimary,
        },
        muted: {
          color: theme.textMuted,
        },
      }),
    [theme],
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
    const next = {
      ...completedToday,
      [id]: !completedToday[id],
    };
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

    saveDrawer([
      {
        id: `${Date.now()}`,
        text,
        done: false,
      },
      ...drawerNotes,
    ]);
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
      'Naka-ready na ang Home command layer. Ang full AI assistant para sa recipes, budget suggestions, at mas malalim na requests ay ikakabit sa susunod na verified slice.',
    );
  };

  const displayName = resolvePersonDisplayName(profile, profile?.id);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.greetingCol}>
            <Text style={styles.eyebrow}>
              {getBuklodHomeDaypartLabel(daypart)}
            </Text>
            <Text style={styles.greeting} numberOfLines={2}>
              {getBuklodHomeGreeting(daypart)}, {displayName}
            </Text>
            <Text style={styles.date}>{formatBuklodHomeDate()}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open character and points"
            onPress={() => router.push('/points' as any)}
            style={({ pressed }) => [
              styles.characterFrame,
              pressed && { opacity: 0.86 },
            ]}
          >
            <BuklodActiveCharacterArt
              fallbackCharacter={DEFAULT_CHARACTER}
              height={136}
              viewportWidth={88}
              showStage={false}
              showEffects={false}
            />
          </Pressable>
        </View>

        <View style={styles.rankRow}>
          <Pressable
            onPress={() => router.push('/points' as any)}
            style={styles.rankChip}
          >
            <Text style={styles.chipLabel}>CHARACTER / RANK</Text>
            <Text style={styles.chipValue} numberOfLines={1}>
              {circleRank}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/points' as any)}
            style={styles.rankChip}
          >
            <Text style={styles.chipLabel}>LIFETIME / AVAILABLE</Text>
            <Text style={styles.chipValue} numberOfLines={1}>
              {lifetimePoints.toLocaleString()} / {availablePoints.toLocaleString()}
            </Text>
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => selectMode(option.value)}
                style={[
                  styles.modeButton,
                  active && styles.modeButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={17}
                  color={active ? theme.accent : theme.textMuted}
                />
                <Text
                  style={[
                    styles.modeText,
                    active && styles.modeTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today</Text>
        <Text style={styles.sectionHint}>
          {getBuklodHomeModeLabel(mode)} mode · simple lang ang kailangan mong makita ngayon.
        </Text>

        {todayItems.map((item) => {
          const done = Boolean(completedToday[item.id]);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggleToday(item.id)}
              style={({ pressed }) => [
                styles.todayItem,
                pressed && { opacity: 0.82 },
              ]}
            >
              <View style={styles.check}>
                <MaterialCommunityIcons
                  name={done ? 'check' : 'circle-outline'}
                  size={17}
                  color={done ? theme.accent : theme.textMuted}
                />
              </View>
              <View style={styles.todayCopy}>
                <Text
                  style={[
                    styles.todayTitle,
                    done && { textDecorationLine: 'line-through', color: theme.textMuted },
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.todayDetail}>{item.detail}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ask BUKLOD</Text>
        <Text style={styles.sectionHint}>
          Sabihin lang ang kailangan mo. May local commands na agad habang ikinakabit ang full AI layer.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            value={askDraft}
            onChangeText={setAskDraft}
            onSubmitEditing={runAsk}
            placeholder="Hal. timer ng sinaing 20 minutes"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            returnKeyType="send"
          />
          <Pressable onPress={runAsk} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>GO</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick Home</Text>
        <Text style={styles.sectionHint}>
          Madalas gamitin, hindi kailangang hanapin sa maraming menu.
        </Text>

        <View style={styles.actionGrid}>
          <Pressable onPress={() => router.push('/connect' as any)} style={styles.action}>
            <MaterialCommunityIcons name="account-group-outline" size={23} color={theme.accent} />
            <Text style={styles.actionLabel}>People</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/bayanihan' as any)} style={styles.action}>
            <MaterialCommunityIcons name="hand-heart-outline" size={23} color={theme.accent} />
            <Text style={styles.actionLabel}>Bayanihan</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(tabs)/buklod' as any)} style={styles.action}>
            <MaterialCommunityIcons name="account-multiple-outline" size={23} color={theme.accent} />
            <Text style={styles.actionLabel}>Community Wall</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/points' as any)} style={styles.action}>
            <MaterialCommunityIcons name="account-star-outline" size={23} color={theme.accent} />
            <Text style={styles.actionLabel}>Character</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Timer</Text>
        <Text style={styles.sectionHint}>
          Pang-sinaing, pagluluto, study session, pahinga, o kahit anong mabilis na timer.
        </Text>
        <Text style={styles.timerValue}>
          {timerEndAt ? formatRemaining(timerRemaining) : '00:00'}
        </Text>
        <View style={styles.timerRow}>
          {[10, 20, 30].map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => startTimer(minutes)}
              style={styles.timerButton}
            >
              <Text style={styles.timerButtonText}>{minutes} MIN</Text>
            </Pressable>
          ))}
          <Pressable onPress={stopTimer} style={styles.timerButton}>
            <Text style={styles.timerButtonText}>STOP</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Drawer</Text>
        <Text style={styles.sectionHint}>
          Mabilisang lagayan ng bayarin, deadline, kailangang bilhin, o anumang ayaw mong makalimutan.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            value={drawerDraft}
            onChangeText={setDrawerDraft}
            onSubmitEditing={addDrawerNote}
            placeholder="Hal. Kuryente due Friday"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
            returnKeyType="done"
          />
          <Pressable onPress={addDrawerNote} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>ADD</Text>
          </Pressable>
        </View>

        {drawerNotes.length === 0 ? (
          <Text style={[styles.sectionHint, { marginTop: 10 }]}>Wala pang laman ang Drawer.</Text>
        ) : (
          drawerNotes.slice(0, 8).map((note) => (
            <Pressable
              key={note.id}
              onPress={() =>
                saveDrawer(
                  drawerNotes.map((item) =>
                    item.id === note.id ? { ...item, done: !item.done } : item,
                  ),
                )
              }
              onLongPress={() =>
                saveDrawer(drawerNotes.filter((item) => item.id !== note.id))
              }
              style={styles.drawerItem}
            >
              <MaterialCommunityIcons
                name={note.done ? 'checkbox-marked-circle-outline' : 'circle-outline'}
                size={19}
                color={note.done ? theme.accent : theme.textMuted}
              />
              <Text
                style={[
                  styles.drawerText,
                  note.done && {
                    color: theme.textMuted,
                    textDecorationLine: 'line-through',
                  },
                ]}
              >
                {note.text}
              </Text>
            </Pressable>
          ))
        )}

        {drawerNotes.length > 0 ? (
          <Text style={[styles.sectionHint, { marginTop: 8 }]}>Tap = done · long press = remove</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
