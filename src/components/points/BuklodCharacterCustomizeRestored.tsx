import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import BuklodSpecialCharacterArtV2 from '@/components/points/BuklodSpecialCharacterArtV2';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import { collectibleNames, PROGRESSIVE_CHARACTERS, type ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';
import {
  CHARACTER_DISPLAY_NAME,
  CORE_CHARACTER_ORDER,
  SPECIAL_CHARACTER_ORDER,
  SPECIAL_REQUIRED_RANK_ORDER,
  getMyBuklodCharacterSelectionV2,
  setMyBuklodCharacterActiveV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterId,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  lifetimePoints: number;
  onSaved?: (config: BuklodCharacterState) => void;
};

const SPECIAL_START: Record<BuklodSpecialCharacterId, string> = {
  ace: 'Curious Learner', ellusur: 'Little Learner', jawo: 'Young Dreamer',
  mitch: 'Little Dreamer', niel: 'Young Singer', angel: 'Little Helper',
  vhen: 'Farm Helper', trudice: 'Little Learner',
};

const CORE_BADGES: Record<ProgressiveCharacterId, readonly string[]> = {
  phan: ['Builder', 'Service', 'Leadership', 'Enterprise'],
  quin: ['Explorer', 'Travel', 'Creator', 'Tourism'],
  van: ['Joy', 'Worship', 'Mission', 'Global Service'],
  christian: ['Athlete', 'Leadership', 'Public Service', 'Legacy'],
  lhen: ['Work', 'Music', 'Teaching', 'Mission'],
};

function isCore(id: BuklodCharacterId): id is ProgressiveCharacterId {
  return CORE_CHARACTER_ORDER.includes(id as ProgressiveCharacterId);
}

export default function BuklodCharacterCustomizeRestored({ visible, onClose, userId }: Props) {
  const { theme } = useBuklodPresentation();
  const bottom = useBuklodDrawerBottomInset();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<BuklodCharacterId | null>(null);
  const [detail, setDetail] = useState<ProgressiveCharacterId | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    let alive = true;
    setLoading(true);
    void getMyBuklodCharacterSelectionV2(userId, true)
      .then(v => {
        if (!alive) return;
        setState(v);
        if (isCore(v.active_character_id)) setDetail(v.active_character_id);
      })
      .catch((e: unknown) => {
        if (alive) Alert.alert('BUKLOD Character', e instanceof Error ? e.message : 'Could not load Character Selection.');
      })
      .finally(() => { if (alive) setLoading(false); });
    const off = subscribeBuklodCharacterSelectionV2((id, v) => {
      if (!alive || id !== userId) return;
      setState(v);
      if (isCore(v.active_character_id)) setDetail(v.active_character_id);
    });
    return () => { alive = false; off(); };
  }, [userId, visible]);

  const unlocked = useMemo(() => new Set(state?.visible_special_character_ids ?? []), [state?.visible_special_character_ids]);
  const nextLocked = useMemo(() => SPECIAL_CHARACTER_ORDER.find(id => !unlocked.has(id)) ?? null, [unlocked]);
  const activeCore = state && isCore(state.active_character_id) ? state.active_character_id : null;

  async function select(id: BuklodCharacterId) {
    if (!userId || busy || state?.active_character_id === id) return;
    if (SPECIAL_CHARACTER_ORDER.includes(id as BuklodSpecialCharacterId) && !unlocked.has(id as BuklodSpecialCharacterId)) return;
    setBusy(id);
    try {
      const next = await setMyBuklodCharacterActiveV2(userId, id);
      setState(next);
      if (isCore(next.active_character_id)) setDetail(next.active_character_id);
    } catch (e: unknown) {
      Alert.alert('BUKLOD Character', e instanceof Error ? e.message : 'Could not change Character.');
    } finally {
      setBusy(null);
    }
  }

  const levelFor = (id: BuklodCharacterId) => state?.active_character_id === id ? state.character_level : 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: theme.surface, paddingBottom: bottom }]} onPress={e => e.stopPropagation()}>
          <View style={[s.header, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: theme.textPrimary }]}>Customize BUKLOD Character</Text>
              <Text style={[s.sub, { color: theme.textMuted }]}>5 Basic + 8 Special · independent Level 1–20 journeys</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP} accessibilityRole="button" accessibilityLabel="Close Character Customize">
              <MaterialCommunityIcons name="close" size={24} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {loading && !state ? <View style={s.loading}><ActivityIndicator color={theme.accent} /></View> : null}

            {state ? (
              <View style={[s.hero, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
                <View style={[s.heroArt, { backgroundColor: theme.surface }]}> 
                  {isCore(state.active_character_id) ? (
                    <BuklodProgressiveCharacterArt characterId={state.active_character_id} level={state.character_level} height={176} viewportWidth={138} />
                  ) : (
                    <BuklodSpecialCharacterArtV2 characterId={state.active_character_id as BuklodSpecialCharacterId} height={150} viewportWidth={138} />
                  )}
                </View>
                <View style={s.heroCopy}>
                  <Text style={[s.eyebrow, { color: theme.accent }]}>CURRENT CHARACTER PREVIEW</Text>
                  <Text style={[s.statusName, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[state.active_character_id]}</Text>
                  <Text style={[s.heroLevel, { color: theme.textPrimary }]}>Level {state.character_level}</Text>
                  <Text style={[s.meta, { color: theme.textSecondary }]}>{state.circle_rank_name} · Circle Rank #{state.circle_rank_order}</Text>
                  <Text style={[s.meta, { color: theme.textMuted }]}>{state.character_points_since_selection.toLocaleString('en-PH')} Character Points</Text>
                  {activeCore ? (
                    <Text style={[s.heroStage, { color: theme.accent }]}>{PROGRESSIVE_CHARACTERS[activeCore].stages[state.character_level - 1]}</Text>
                  ) : (
                    <Text style={[s.heroStage, { color: theme.accent }]}>SPECIAL · {SPECIAL_START[state.active_character_id as BuklodSpecialCharacterId]}</Text>
                  )}
                </View>
              </View>
            ) : null}

            {activeCore && state ? (
              <View style={[s.featurePanel, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={s.featureTitleRow}>
                  <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={18} color={theme.accent} />
                  <Text style={[s.featureTitle, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[activeCore]} · Level 1–20 Journey</Text>
                </View>
                <Text style={[s.detailBody, { color: theme.textSecondary }]}>{PROGRESSIVE_CHARACTERS[activeCore].traits}</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.journeyRow}>
                  {PROGRESSIVE_CHARACTERS[activeCore].stages.map((stage, index) => {
                    const level = index + 1;
                    const reached = level <= state.character_level;
                    const current = level === state.character_level;
                    return (
                      <View key={`${activeCore}-${level}`} style={[s.levelCard, { borderColor: current ? theme.accent : theme.border, backgroundColor: current ? theme.accentSoft : theme.surface }, !reached && s.lockedLevel]}>
                        <View style={[s.levelOrb, { backgroundColor: reached ? theme.accent : theme.surfaceElevated }]}>
                          <Text style={[s.levelNumber, { color: reached ? theme.surface : theme.textMuted }]}>{level}</Text>
                        </View>
                        <Text numberOfLines={2} style={[s.levelName, { color: reached ? theme.textPrimary : theme.textMuted }]}>{stage}</Text>
                        <Text style={[s.levelState, { color: current ? theme.accent : theme.textMuted }]}>{current ? 'CURRENT' : reached ? 'REACHED' : 'LOCKED'}</Text>
                      </View>
                    );
                  })}
                </ScrollView>

                <Text style={[s.featureLabel, { color: theme.textMuted }]}>CURRENT COLLECTIBLES</Text>
                <View style={s.chips}>{collectibleNames(activeCore, state.character_level).map(item => (
                  <View key={item} style={[s.chip, { borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="treasure-chest-outline" size={14} color={theme.accent} />
                    <Text style={[s.chipText, { color: theme.textSecondary }]}>{item}</Text>
                  </View>
                ))}</View>

                <Text style={[s.featureLabel, { color: theme.textMuted }]}>BADGE MILESTONES</Text>
                <View style={s.badgeRow}>{CORE_BADGES[activeCore].map((badge, index) => {
                  const requiredLevel = (index + 1) * 5;
                  const reached = state.character_level >= requiredLevel;
                  return (
                    <View key={badge} style={[s.badge, { borderColor: reached ? theme.accent : theme.border, backgroundColor: reached ? theme.accentSoft : theme.surface }]}>
                      <MaterialCommunityIcons name={reached ? 'medal' : 'lock-outline'} size={17} color={reached ? theme.accent : theme.textMuted} />
                      <Text style={[s.badgeText, { color: reached ? theme.textPrimary : theme.textMuted }]}>{badge}</Text>
                      <Text style={[s.badgeLevel, { color: theme.textMuted }]}>Lv {requiredLevel}</Text>
                    </View>
                  );
                })}</View>

                <View style={[s.ruleInline, { borderColor: theme.border }]}>
                  <MaterialCommunityIcons name="shield-check-outline" size={17} color={theme.accent} />
                  <Text style={[s.ruleInlineText, { color: theme.textSecondary }]}>Character level is independent per selected character. Circle Rank and Circle Points are preserved. Measurable rewards should be server-validated before award.</Text>
                </View>
              </View>
            ) : null}

            <Text style={[s.section, { color: theme.textMuted }]}>5 BASIC CHARACTERS</Text>
            <Text style={[s.hint, { color: theme.textSecondary }]}>Tap the artwork for details. SELECT immediately updates the active preview above.</Text>
            <View style={s.grid}>{CORE_CHARACTER_ORDER.map(id => {
              const active = state?.active_character_id === id;
              const level = levelFor(id);
              const profile = PROGRESSIVE_CHARACTERS[id];
              return (
                <View key={id} style={[s.card, { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border }]}>
                  <Pressable onPress={() => setDetail(id)} style={s.art} accessibilityRole="button" accessibilityLabel={`Preview ${CHARACTER_DISPLAY_NAME[id]}`}>
                    <BuklodProgressiveCharacterArt characterId={id} level={level} height={116} viewportWidth={104} />
                  </Pressable>
                  <Text style={[s.name, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[id]}</Text>
                  <Text style={[s.stage, { color: theme.textSecondary }]} numberOfLines={1}>{profile.stages[level - 1]}</Text>
                  <Text style={[s.small, { color: theme.textMuted }]}>{active ? `LEVEL ${level}` : 'STARTS LEVEL 1'}</Text>
                  {active ? <Text style={[s.active, { color: theme.accent }]}>● ACTIVE</Text> : (
                    <Pressable onPress={() => void select(id)} disabled={Boolean(busy)} style={[s.select, { borderColor: theme.border }, busy && s.disabled]} accessibilityRole="button" accessibilityLabel={`Select ${CHARACTER_DISPLAY_NAME[id]}`}>
                      {busy === id ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[s.selectText, { color: theme.accent }]}>SELECT</Text>}
                    </Pressable>
                  )}
                </View>
              );
            })}</View>

            {detail ? (
              <View style={[s.detail, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={s.detailPreviewRow}>
                  <BuklodProgressiveCharacterArt characterId={detail} level={levelFor(detail)} height={138} viewportWidth={112} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.eyebrow, { color: theme.accent }]}>PREVIEW · LEVEL {levelFor(detail)}</Text>
                    <Text style={[s.detailTitle, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[detail]}</Text>
                    <Text style={[s.detailBody, { color: theme.textSecondary }]}>{PROGRESSIVE_CHARACTERS[detail].stages[levelFor(detail) - 1]}</Text>
                    <Text style={[s.detailBody, { color: theme.textMuted }]}>{PROGRESSIVE_CHARACTERS[detail].traits}</Text>
                  </View>
                </View>
                <View style={s.chips}>{collectibleNames(detail, levelFor(detail)).map(item => (
                  <View key={item} style={[s.chip, { borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="star-circle-outline" size={13} color={theme.accent} />
                    <Text style={[s.chipText, { color: theme.textSecondary }]}>{item}</Text>
                  </View>
                ))}</View>
              </View>
            ) : null}

            <View style={s.specialHead}>
              <Text style={[s.section, { color: theme.textMuted, marginBottom: 0 }]}>8 SPECIAL CHARACTERS</Text>
              <MaterialCommunityIcons name="star-four-points-outline" size={17} color={theme.accent} />
            </View>
            <Text style={[s.hint, { color: theme.textSecondary }]}>Unlocked = selectable. Next = locked preview. Later Specials = concealed.</Text>
            <View style={s.grid}>{SPECIAL_CHARACTER_ORDER.map(id => {
              const isUnlocked = unlocked.has(id);
              const isNext = id === nextLocked;
              const concealed = !isUnlocked && !isNext;
              const active = state?.active_character_id === id;
              return (
                <View key={id} style={[s.card, { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border }, concealed && { opacity: .68 }]}>
                  {concealed ? (
                    <View style={[s.art, s.concealed, { borderColor: theme.border }]}>
                      <MaterialCommunityIcons name="lock-outline" size={30} color={theme.textMuted} />
                      <Text style={[s.hidden, { color: theme.textMuted }]}>SPECIAL</Text>
                    </View>
                  ) : (
                    <View style={[s.art, isNext && { opacity: .28 }]}>
                      <BuklodSpecialCharacterArtV2 characterId={id} height={116} viewportWidth={104} />
                      {isNext ? <View style={s.lock}><MaterialCommunityIcons name="lock" size={25} color="#fff" /></View> : null}
                    </View>
                  )}
                  <Text style={[s.name, { color: concealed ? theme.textMuted : theme.textPrimary }]}>{concealed ? 'LOCKED SPECIAL' : CHARACTER_DISPLAY_NAME[id]}</Text>
                  <Text style={[s.stage, { color: theme.textSecondary }]}>{isUnlocked ? SPECIAL_START[id] : `Circle Rank #${SPECIAL_REQUIRED_RANK_ORDER[id]}`}</Text>
                  <Text style={[s.small, { color: theme.textMuted }]}>{isUnlocked ? (active ? `SPECIAL · LEVEL ${levelFor(id)}` : 'SPECIAL · STARTS LEVEL 1') : isNext ? 'NEXT UNLOCK' : 'CONCEALED'}</Text>
                  {active ? <Text style={[s.active, { color: theme.accent }]}>★ ACTIVE</Text> : isUnlocked ? (
                    <Pressable onPress={() => void select(id)} disabled={Boolean(busy)} style={[s.select, { borderColor: theme.border }, busy && s.disabled]} accessibilityRole="button" accessibilityLabel={`Select ${CHARACTER_DISPLAY_NAME[id]}`}>
                      {busy === id ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[s.selectText, { color: theme.accent }]}>SELECT</Text>}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}</View>

            {nextLocked ? (
              <View style={[s.next, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="lock-open-variant-outline" size={20} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.eyebrow, { color: theme.accent }]}>NEXT SPECIAL UNLOCK</Text>
                  <Text style={[s.nextText, { color: theme.textSecondary }]}>{CHARACTER_DISPLAY_NAME[nextLocked]} · Circle Rank #{SPECIAL_REQUIRED_RANK_ORDER[nextLocked]}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.5)'},
  sheet:{height:'94%',borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden'},
  header:{minHeight:66,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,borderBottomWidth:StyleSheet.hairlineWidth},
  title:{fontSize:19,fontWeight:'900'},sub:{marginTop:3,fontSize:10.5},content:{padding:14,paddingBottom:36},loading:{minHeight:80,alignItems:'center',justifyContent:'center'},
  hero:{padding:12,borderRadius:18,borderWidth:1,marginBottom:14,flexDirection:'row',alignItems:'center',gap:14,minHeight:190},
  heroArt:{width:142,height:180,borderRadius:16,overflow:'hidden',alignItems:'center',justifyContent:'flex-end'},heroCopy:{flex:1},heroLevel:{marginTop:2,fontSize:24,fontWeight:'900'},heroStage:{marginTop:8,fontSize:11,fontWeight:'900'},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:.8},statusName:{marginTop:4,fontSize:20,fontWeight:'900'},meta:{marginTop:3,fontSize:10.5,fontWeight:'700'},
  featurePanel:{padding:12,borderRadius:17,borderWidth:1,marginBottom:18},featureTitleRow:{flexDirection:'row',alignItems:'center',gap:7},featureTitle:{fontSize:15,fontWeight:'900'},featureLabel:{marginTop:14,marginBottom:7,fontSize:9,fontWeight:'900',letterSpacing:.8},
  journeyRow:{gap:8,paddingVertical:10,paddingRight:8},levelCard:{width:92,minHeight:94,padding:8,borderRadius:13,borderWidth:1,alignItems:'center'},lockedLevel:{opacity:.58},levelOrb:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},levelNumber:{fontSize:10,fontWeight:'900'},levelName:{marginTop:6,fontSize:9,fontWeight:'800',textAlign:'center',lineHeight:12},levelState:{marginTop:5,fontSize:7.5,fontWeight:'900'},
  badgeRow:{flexDirection:'row',flexWrap:'wrap',gap:7},badge:{width:'48%',minHeight:62,padding:8,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center'},badgeText:{marginTop:3,fontSize:9,fontWeight:'900',textAlign:'center'},badgeLevel:{marginTop:2,fontSize:8,fontWeight:'700'},
  ruleInline:{marginTop:14,padding:10,borderRadius:12,borderWidth:1,flexDirection:'row',alignItems:'flex-start',gap:8},ruleInlineText:{flex:1,fontSize:9.5,lineHeight:14,fontWeight:'700'},
  section:{fontSize:10,fontWeight:'900',letterSpacing:.9,marginBottom:4},hint:{marginBottom:10,fontSize:10,lineHeight:14},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  card:{width:'47.8%',minHeight:216,borderRadius:17,borderWidth:1.5,padding:10,alignItems:'center'},art:{width:104,height:116,borderRadius:13,overflow:'hidden',alignItems:'center',justifyContent:'center'},name:{marginTop:7,fontSize:13,fontWeight:'900'},stage:{marginTop:3,fontSize:9,fontWeight:'800',textAlign:'center'},small:{marginTop:3,fontSize:8.5,fontWeight:'900',textAlign:'center'},active:{marginTop:9,fontSize:8,fontWeight:'900'},
  select:{marginTop:7,minHeight:30,minWidth:76,paddingHorizontal:10,borderRadius:999,borderWidth:1,alignItems:'center',justifyContent:'center'},selectText:{fontSize:8,fontWeight:'900'},disabled:{opacity:.55},
  detail:{marginTop:12,padding:12,borderRadius:15,borderWidth:1},detailPreviewRow:{flexDirection:'row',alignItems:'center',gap:12},detailTitle:{marginTop:4,fontSize:15,fontWeight:'900'},detailBody:{marginTop:4,fontSize:10,lineHeight:14},chips:{marginTop:9,flexDirection:'row',flexWrap:'wrap',gap:6},chip:{minHeight:29,paddingHorizontal:7,paddingVertical:5,borderRadius:9,borderWidth:1,flexDirection:'row',alignItems:'center',gap:4},chipText:{fontSize:8.5,fontWeight:'700'},
  specialHead:{marginTop:22,marginBottom:4,flexDirection:'row',alignItems:'center',gap:6},concealed:{borderWidth:1,gap:5},hidden:{fontSize:8,fontWeight:'900',letterSpacing:1.2},lock:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},
  next:{marginTop:14,padding:12,borderRadius:14,borderWidth:1,flexDirection:'row',alignItems:'center',gap:9},nextText:{marginTop:2,fontSize:10,fontWeight:'700'},
});
