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
  jawo: 'Young Dreamer', trudice: 'Little Learner', ace: 'Curious Learner',
  mitch: 'Little Dreamer', niel: 'Young Singer', angel: 'Little Helper',
  vhen: 'Farm Helper', ellusur: 'Little Learner',
};

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
      .then(v => { if (alive) setState(v); })
      .catch((e: unknown) => { if (alive) Alert.alert('BUKLOD Character', e instanceof Error ? e.message : 'Could not load Character Selection.'); })
      .finally(() => { if (alive) setLoading(false); });
    const off = subscribeBuklodCharacterSelectionV2((id, v) => { if (alive && id === userId) setState(v); });
    return () => { alive = false; off(); };
  }, [userId, visible]);

  const unlocked = useMemo(() => new Set(state?.visible_special_character_ids ?? []), [state?.visible_special_character_ids]);
  const nextLocked = useMemo(() => SPECIAL_CHARACTER_ORDER.find(id => !unlocked.has(id)) ?? null, [unlocked]);

  async function select(id: BuklodCharacterId) {
    if (!userId || busy || state?.active_character_id === id) return;
    if (SPECIAL_CHARACTER_ORDER.includes(id as BuklodSpecialCharacterId) && !unlocked.has(id as BuklodSpecialCharacterId)) return;
    setBusy(id);
    try { setState(await setMyBuklodCharacterActiveV2(userId, id)); }
    catch (e: unknown) { Alert.alert('BUKLOD Character', e instanceof Error ? e.message : 'Could not change Character.'); }
    finally { setBusy(null); }
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
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP}><MaterialCommunityIcons name="close" size={24} color={theme.textMuted} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {loading && !state ? <View style={s.loading}><ActivityIndicator color={theme.accent} /></View> : null}
            {state ? <View style={[s.status, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
              <Text style={[s.eyebrow, { color: theme.accent }]}>CURRENT CHARACTER</Text>
              <Text style={[s.statusName, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[state.active_character_id]} · Level {state.character_level}</Text>
              <Text style={[s.meta, { color: theme.textSecondary }]}>{state.circle_rank_name} · Circle Rank #{state.circle_rank_order}</Text>
              <Text style={[s.meta, { color: theme.textMuted }]}>{state.character_points_since_selection.toLocaleString('en-PH')} Character Points</Text>
            </View> : null}

            <Text style={[s.section, { color: theme.textMuted }]}>5 BASIC CHARACTERS</Text>
            <Text style={[s.hint, { color: theme.textSecondary }]}>Approved 20-stage visual progression and collectible family per Character.</Text>
            <View style={s.grid}>{CORE_CHARACTER_ORDER.map(id => {
              const active = state?.active_character_id === id;
              const level = levelFor(id);
              const profile = PROGRESSIVE_CHARACTERS[id];
              return <View key={id} style={[s.card, { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border }]}>
                <Pressable onPress={() => setDetail(id)} style={s.art}>
                  <BuklodProgressiveCharacterArt characterId={id} level={level} height={116} viewportWidth={104} />
                </Pressable>
                <Text style={[s.name, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[id]}</Text>
                <Text style={[s.stage, { color: theme.textSecondary }]} numberOfLines={1}>{profile.stages[level - 1]}</Text>
                <Text style={[s.small, { color: theme.textMuted }]}>{active ? `LEVEL ${level}` : 'STARTS LEVEL 1'}</Text>
                {active ? <Text style={[s.active, { color: theme.accent }]}>● ACTIVE</Text> :
                  <Pressable onPress={() => void select(id)} style={[s.select, { borderColor: theme.border }]}>
                    {busy === id ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[s.selectText, { color: theme.accent }]}>SELECT</Text>}
                  </Pressable>}
              </View>;
            })}</View>

            {detail ? <View style={[s.detail, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[s.eyebrow, { color: theme.accent }]}>LEVEL {levelFor(detail)} COLLECTION</Text>
              <Text style={[s.detailTitle, { color: theme.textPrimary }]}>{CHARACTER_DISPLAY_NAME[detail]} · {PROGRESSIVE_CHARACTERS[detail].stages[levelFor(detail) - 1]}</Text>
              <Text style={[s.detailBody, { color: theme.textSecondary }]}>{PROGRESSIVE_CHARACTERS[detail].traits}</Text>
              <View style={s.chips}>{collectibleNames(detail, levelFor(detail)).map(item =>
                <View key={item} style={[s.chip, { borderColor: theme.border }]}><MaterialCommunityIcons name="star-circle-outline" size={13} color={theme.accent} /><Text style={[s.chipText, { color: theme.textSecondary }]}>{item}</Text></View>
              )}</View>
            </View> : null}

            <View style={s.specialHead}><Text style={[s.section, { color: theme.textMuted, marginBottom: 0 }]}>8 SPECIAL CHARACTERS</Text><MaterialCommunityIcons name="star-four-points-outline" size={17} color={theme.accent} /></View>
            <Text style={[s.hint, { color: theme.textSecondary }]}>Unlocked = selectable. Next = locked preview. Later Specials = concealed.</Text>
            <View style={s.grid}>{SPECIAL_CHARACTER_ORDER.map(id => {
              const isUnlocked = unlocked.has(id);
              const isNext = id === nextLocked;
              const concealed = !isUnlocked && !isNext;
              const active = state?.active_character_id === id;
              return <View key={id} style={[s.card, { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border }, concealed && { opacity: .68 }]}>
                {concealed ? <View style={[s.art, s.concealed, { borderColor: theme.border }]}><MaterialCommunityIcons name="lock-outline" size={30} color={theme.textMuted} /><Text style={[s.hidden, { color: theme.textMuted }]}>SPECIAL</Text></View> :
                  <View style={[s.art, isNext && { opacity: .28 }]}><BuklodSpecialCharacterArtV2 characterId={id} height={116} viewportWidth={104} />{isNext ? <View style={s.lock}><MaterialCommunityIcons name="lock" size={25} color="#fff" /></View> : null}</View>}
                <Text style={[s.name, { color: concealed ? theme.textMuted : theme.textPrimary }]}>{concealed ? 'LOCKED SPECIAL' : CHARACTER_DISPLAY_NAME[id]}</Text>
                <Text style={[s.stage, { color: theme.textSecondary }]}>{isUnlocked ? SPECIAL_START[id] : `Circle Rank #${SPECIAL_REQUIRED_RANK_ORDER[id]}`}</Text>
                <Text style={[s.small, { color: theme.textMuted }]}>{isUnlocked ? (active ? `SPECIAL · LEVEL ${levelFor(id)}` : 'SPECIAL · STARTS LEVEL 1') : isNext ? 'NEXT UNLOCK' : 'CONCEALED'}</Text>
                {active ? <Text style={[s.active, { color: theme.accent }]}>★ ACTIVE</Text> : isUnlocked ? <Pressable onPress={() => void select(id)} style={[s.select, { borderColor: theme.border }]}>{busy === id ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[s.selectText, { color: theme.accent }]}>SELECT</Text>}</Pressable> : null}
              </View>;
            })}</View>

            {nextLocked ? <View style={[s.next, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><MaterialCommunityIcons name="lock-open-variant-outline" size={20} color={theme.accent} /><View style={{ flex: 1 }}><Text style={[s.eyebrow, { color: theme.accent }]}>NEXT SPECIAL UNLOCK</Text><Text style={[s.nextText, { color: theme.textSecondary }]}>{CHARACTER_DISPLAY_NAME[nextLocked]} · Circle Rank #{SPECIAL_REQUIRED_RANK_ORDER[nextLocked]}</Text></View></View> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.5)'},sheet:{height:'94%',borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden'},header:{minHeight:66,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,borderBottomWidth:StyleSheet.hairlineWidth},title:{fontSize:19,fontWeight:'900'},sub:{marginTop:3,fontSize:10.5},content:{padding:14,paddingBottom:36},loading:{minHeight:80,alignItems:'center',justifyContent:'center'},status:{padding:14,borderRadius:17,borderWidth:1,marginBottom:18},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:.8},statusName:{marginTop:4,fontSize:18,fontWeight:'900'},meta:{marginTop:3,fontSize:10.5,fontWeight:'700'},section:{fontSize:10,fontWeight:'900',letterSpacing:.9,marginBottom:4},hint:{marginBottom:10,fontSize:10,lineHeight:14},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},card:{width:'47.8%',minHeight:216,borderRadius:17,borderWidth:1.5,padding:10,alignItems:'center'},art:{width:104,height:116,borderRadius:13,overflow:'hidden',alignItems:'center',justifyContent:'center'},name:{marginTop:7,fontSize:13,fontWeight:'900'},stage:{marginTop:3,fontSize:9,fontWeight:'800',textAlign:'center'},small:{marginTop:3,fontSize:8.5,fontWeight:'900',textAlign:'center'},active:{marginTop:9,fontSize:8,fontWeight:'900'},select:{marginTop:7,minHeight:27,minWidth:66,paddingHorizontal:9,borderRadius:999,borderWidth:1,alignItems:'center',justifyContent:'center'},selectText:{fontSize:8,fontWeight:'900'},detail:{marginTop:12,padding:12,borderRadius:15,borderWidth:1},detailTitle:{marginTop:4,fontSize:15,fontWeight:'900'},detailBody:{marginTop:4,fontSize:10,lineHeight:14},chips:{marginTop:9,flexDirection:'row',flexWrap:'wrap',gap:6},chip:{minHeight:29,paddingHorizontal:7,paddingVertical:5,borderRadius:9,borderWidth:1,flexDirection:'row',alignItems:'center',gap:4},chipText:{fontSize:8.5,fontWeight:'700'},specialHead:{marginTop:22,marginBottom:4,flexDirection:'row',alignItems:'center',gap:6},concealed:{borderWidth:1,gap:5},hidden:{fontSize:8,fontWeight:'900',letterSpacing:1.2},lock:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},next:{marginTop:14,padding:12,borderRadius:14,borderWidth:1,flexDirection:'row',alignItems:'center',gap:9},nextText:{marginTop:2,fontSize:10,fontWeight:'700'},
});
