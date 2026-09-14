/* BUKLOD_SPECIAL_R40_FORWARD_PORT_V2_SAFE */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { supabase } from '@/lib/supabase';
import {
  setMyBuklodCharacterActiveV2,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import {
  SPECIAL_CHARACTER_HERO,
  getBuklodSpecialLevelAsset,
} from '@/lib/buklodSpecialCharacterAssets';

type Props = {
  userId?: string | null;
  state: BuklodCharacterSelectionV2State;
  onStateRefresh: () => Promise<void> | void;
};

type CollectibleRow = {
  level_no?: number;
  collectible_id?: string;
  collectible_name?: string;
  badge_name?: string;
  earned?: boolean;
};

type SpecialProfile = {
  id: BuklodSpecialCharacterId;
  name: string;
  domain: string;
  stages: readonly string[];
};

const SPECIAL_PROFILES: Record<BuklodSpecialCharacterId, SpecialProfile> = {
  jawo: {
    id: 'jawo', name: 'JAWO', domain: 'NATURE · MUSIC · COMMUNITY',
    stages: ['Young Dreamer','Nature Lover','Student Musician','Campus Volunteer','Youth Encourager','Choir Member','Guitar Learner','Worship Music Helper','Community Singer','Music Team Member','Youth Mentor','Worship Leader','Creative Ministry Worker','Forest Advocate','Community Organizer','Music Trainer','Mission Volunteer','Discipleship Worker','Church Planting Partner','Purposeful Leader'],
  },
  trudice: {
    id: 'trudice', name: 'TRUDICE', domain: 'CHILDREN · TEACHING · DISCIPLESHIP',
    stages: ['Little Learner','Story Listener','Sunday School Helper','Young Teacher','Children’s Guide','Classroom Assistant','Student Mentor','Learning Facilitator','Sunday School Teacher','Classroom Teacher','Creative Educator','Values Mentor','Children’s Ministry Teacher','Learning Coordinator','Teacher-Leader','Curriculum Builder','Mentor of Teachers','Education Ministry Leader','Community Educator','Legacy Teacher'],
  },
  ace: {
    id: 'ace', name: 'ACE', domain: 'HEALTH · STRATEGY · SERVICE',
    stages: ['Curious Learner','Caring Student','Chess Beginner','School Helper','Youth Encourager','Nursing Student','Chess Competitor','Community Helper','Campus Leader','Junior Nurse','Board Passer','Staff Nurse','Wellness Advocate','Chess Mentor','Community Health Leader','Mission Nurse','Strategic Mentor','Healing Servant Leader','Regional Health Mentor','Legacy Care Champion'],
  },
  mitch: {
    id: 'mitch', name: 'MITCH', domain: 'ARTS · CULTURE · TEACHING',
    stages: ['Little Dreamer','Young Creator','Art Helper','Story Drawer','Classroom Assistant','Student Teacher','Creative Mentor','Community Artist','Arts Teacher','Tribal Educator','Culture Advocate','Creative Leader','Workshop Facilitator','Arts Ministry Worker','Community Inspiration Builder','Education & Arts Coordinator','Missionary-Educator','Regional Creative Trainer','Heritage Advocate','Legacy Art Mentor'],
  },
  niel: {
    id: 'niel', name: 'NIEL', domain: 'WORSHIP · DISCIPLESHIP · MISSION',
    stages: ['Young Singer','Faith Listener','Youth Helper','Small Group Member','Worship Volunteer','Bible Learner','Student Mentor','Young Teacher','Worship Leader','Youth Pastor','Discipleship Leader','Mission Volunteer','Outreach Trainer','Church Planting Apprentice','Community Shepherd','Ministry Coordinator','Discipleship Pastor','Church Planting Leader','Regional Mission Mentor','Legacy Disciple-Maker'],
  },
  angel: {
    id: 'angel', name: 'ANGEL', domain: 'STEWARDSHIP · ACCOUNTABILITY',
    stages: ['Little Helper','Savings Learner','Student Organizer','Class Treasurer','Young Steward','Record Keeper','Budget Assistant','Community Volunteer','Stewardship Worker','Finance Coordinator','Ministry Treasurer','Resource Planner','Budget Manager','Community Treasurer','Financial Trainer','Stewardship Leader','Development Coordinator','Resource Director','Community Finance Head','Legacy Steward'],
  },
  vhen: {
    id: 'vhen', name: 'VHEN', domain: 'AGRICULTURE · BUSINESS · FAMILY',
    stages: ['Farm Helper','Garden Learner','Student Worker','Youth Volunteer','Field Assistant','Crop Care Worker','Community Helper','Agriculture Learner','Farm Technician','Harvest Organizer','Agribusiness Starter','Small Business Owner','Community Grower','Agriculture Specialist','Family Provider','Farm Entrepreneur','Community Business Leader','Resource Steward','Agriculture Mentor','Legacy Builder'],
  },
  ellusur: {
    id: 'ellusur', name: 'ELESUR', domain: 'FAITH · TEACHING · SERVICE',
    stages: ['Little Learner','Church Boy','Student Helper','Youth Volunteer','Bible Learner','Classroom Assistant','Farm Helper','Community Volunteer','Sunday Helper','Teacher-in-Service','Ministry Worker','Field Mentor','Faith Leader','Community Teacher','Pastor','Agricultural Advocate','Volunteer Coordinator','Mission Pastor','Community Builder','Legacy Shepherd'],
  },
};

export default function BuklodSpecialCharacterSeries({
  userId,
  state,
  onStateRefresh,
}: Props) {
  const { theme } = useBuklodPresentation();
  const visible = state.visible_special_character_ids;
  const [selectedId, setSelectedId] = useState<BuklodSpecialCharacterId | null>(
    visible.includes(state.active_character_id as BuklodSpecialCharacterId)
      ? (state.active_character_id as BuklodSpecialCharacterId)
      : visible[0] ?? null,
  );
  const [previewLevel, setPreviewLevel] = useState(1);
  const [busy, setBusy] = useState(false);
  const [collectibles, setCollectibles] = useState<CollectibleRow[]>([]);
  const [collectibleLoading, setCollectibleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && visible.includes(selectedId)) return;
    setSelectedId(visible[0] ?? null);
  }, [selectedId, visible]);

  const selected = selectedId ? SPECIAL_PROFILES[selectedId] : null;
  const active = selectedId != null && state.active_character_id === selectedId;
  const currentLevel = active ? state.character_level : 1;

  useEffect(() => {
    if (!selectedId || !userId) {
      setCollectibles([]);
      setCollectibleLoading(false);
      return;
    }

    let mounted = true;
    setCollectibleLoading(true);

    /* Compatibility with the recovered R40 server contract. Missing RPC is a
     * graceful no-data state; Character selection/progression remains V2-safe. */
    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc(
          'get_my_buklod_special_collectibles_v2',
          { p_character_id: selectedId },
        );

        if (!mounted) return;
        if (error) {
          setCollectibles([]);
          return;
        }

        const rows = Array.isArray(data?.collectibles) ? data.collectibles : [];
        setCollectibles(rows as CollectibleRow[]);
      } catch {
        if (mounted) setCollectibles([]);
      } finally {
        if (mounted) setCollectibleLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedId, userId]);

  const choose = async () => {
    if (!userId || !selectedId || active || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await setMyBuklodCharacterActiveV2(userId, selectedId);
      setPreviewLevel(1);
      await onStateRefresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not activate Special Character.');
    } finally {
      setBusy(false);
    }
  };

  const trackJourney = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await (supabase as any).rpc('set_my_buklod_special_character_pursuit_v1', {
        p_character_id: selectedId,
      });
      if (error) throw error;
      setMessage(`${SPECIAL_PROFILES[selectedId].name} journey is tracked.`);
    } catch {
      setMessage('Journey tracking is not available on this backend yet. Character access is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const levelCollectibles = useMemo(
    () => collectibles.filter((item) => Number(item.level_no) === previewLevel),
    [collectibles, previewLevel],
  );

  if (!visible.length || !selected) {
    return (
      <View style={[styles.shell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Special Character Journey</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Special Characters stay hidden until your canonical Circle Rank unlocks them.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.shell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Special Character Journey</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Only characters already unlocked by Circle Rank appear here. Switching to one starts that selected Character at Level 1.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {visible.map((id) => {
          const profile = SPECIAL_PROFILES[id];
          const selectedNow = id === selectedId;
          const activeNow = state.active_character_id === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                setSelectedId(id);
                setPreviewLevel(activeNow ? state.character_level : 1);
                setMessage(null);
              }}
              style={[
                styles.card,
                { borderColor: selectedNow ? theme.accent : theme.border, backgroundColor: theme.surface },
              ]}
            >
              <Image source={SPECIAL_CHARACTER_HERO[id]} resizeMode="contain" style={styles.heroThumb} />
              <Text style={[styles.name, { color: theme.textPrimary }]}>{profile.name}</Text>
              <Text style={[styles.meta, { color: activeNow ? theme.accent : theme.textMuted }]}>
                {activeNow ? `ACTIVE · L${state.character_level}` : 'UNLOCKED'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.detail, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Image source={getBuklodSpecialLevelAsset(selected.id, previewLevel)} resizeMode="contain" style={styles.levelArt} />
        <View style={styles.detailCopy}>
          <Text style={[styles.detailName, { color: theme.textPrimary }]}>{selected.name} · Level {previewLevel}</Text>
          <Text style={[styles.domain, { color: theme.accent }]}>{selected.domain}</Text>
          <Text style={[styles.stage, { color: theme.textSecondary }]}>{selected.stages[previewLevel - 1]}</Text>
          <Text style={[styles.previewRule, { color: theme.textMuted }]}>
            {previewLevel <= currentLevel ? 'AVAILABLE LEVEL' : 'FUTURE ART PREVIEW — NOT YET EARNED'}
          </Text>
          {!active ? (
            <Pressable disabled={busy} onPress={() => void choose()} style={[styles.primary, { backgroundColor: theme.accent }, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryText}>USE CHARACTER</Text>}
            </Pressable>
          ) : (
            <View style={[styles.activePill, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.activeText, { color: theme.accent }]}>ACTIVE CHARACTER</Text>
            </View>
          )}
          <Pressable disabled={busy} onPress={() => void trackJourney()} style={styles.trackButton}>
            <Text style={[styles.trackText, { color: theme.textSecondary }]}>Track journey</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRail}>
        {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
          const selectedLevel = level === previewLevel;
          return (
            <Pressable
              key={`${selected.id}-${level}`}
              onPress={() => setPreviewLevel(level)}
              style={[
                styles.levelChip,
                { borderColor: selectedLevel ? theme.accent : theme.border, backgroundColor: selectedLevel ? theme.accentSoft : theme.surface },
              ]}
            >
              <Text style={[styles.levelText, { color: selectedLevel ? theme.accent : theme.textPrimary }]}>L{level}</Text>
              <Text style={[styles.levelState, { color: theme.textMuted }]}>{level <= currentLevel ? 'VIEW' : 'PREVIEW'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.collectibles, { borderColor: theme.border }]}>
        <Text style={[styles.collectibleTitle, { color: theme.textPrimary }]}>Collectibles & Badges · Level {previewLevel}</Text>
        {collectibleLoading ? <ActivityIndicator size="small" color={theme.accent} /> : levelCollectibles.length ? (
          levelCollectibles.map((item, index) => (
            <Text key={item.collectible_id ?? `${previewLevel}-${index}`} style={[styles.collectibleText, { color: theme.textSecondary }]}>
              {item.earned ? '✓ ' : '• '}{item.collectible_name ?? `Level ${previewLevel} collectible`}{item.badge_name ? ` · ${item.badge_name}` : ''}
            </Text>
          ))
        ) : (
          <Text style={[styles.collectibleText, { color: theme.textMuted }]}>
            Server collectible details are not available for this level. Character progression is unaffected.
          </Text>
        )}
      </View>

      {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 18 },
  title: { fontSize: 14, fontWeight: '900' },
  hint: { marginTop: 4, fontSize: 10, lineHeight: 15 },
  rail: { gap: 8, paddingVertical: 10 },
  card: { width: 106, minHeight: 150, padding: 7, borderWidth: 1, borderRadius: 14, alignItems: 'center' },
  heroThumb: { width: 90, height: 108 },
  name: { marginTop: 4, fontSize: 10, fontWeight: '900' },
  meta: { marginTop: 2, fontSize: 8, fontWeight: '900' },
  detail: { flexDirection: 'row', gap: 12, padding: 10, borderWidth: 1, borderRadius: 16, alignItems: 'center' },
  levelArt: { width: 154, height: 220 },
  detailCopy: { flex: 1, minWidth: 0 },
  detailName: { fontSize: 14, fontWeight: '900' },
  domain: { marginTop: 3, fontSize: 9, fontWeight: '900' },
  stage: { marginTop: 5, fontSize: 11, fontWeight: '800' },
  previewRule: { marginTop: 5, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  primary: { marginTop: 10, minHeight: 38, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  activePill: { marginTop: 10, minHeight: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeText: { fontSize: 9, fontWeight: '900' },
  trackButton: { marginTop: 6, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  trackText: { fontSize: 9, fontWeight: '800' },
  levelRail: { gap: 6, paddingVertical: 10 },
  levelChip: { minWidth: 48, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderRadius: 10, alignItems: 'center' },
  levelText: { fontSize: 10, fontWeight: '900' },
  levelState: { marginTop: 2, fontSize: 7, fontWeight: '800' },
  collectibles: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  collectibleTitle: { fontSize: 11, fontWeight: '900', marginBottom: 5 },
  collectibleText: { fontSize: 9, lineHeight: 15 },
  message: { marginTop: 8, fontSize: 9, lineHeight: 14, fontWeight: '700' },
});