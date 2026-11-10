/* Kingdom Legacy Gallery R1
 * Source of truth: Character Selection V2 + server collectible RPC.
 * No client-minted BP, Shards, XP, cash, or gameplay entitlements.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BuklodCircleRankBadge from '@/components/points/BuklodCircleRankBadge';
import KingdomRelicEmblem, { kingdomFinishLabel } from '@/features/games/kingdom/KingdomRelicEmblem';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { useAuth } from '@/providers/AuthProvider';
import {
  CHARACTER_DISPLAY_NAME, CORE_CHARACTER_ORDER, SPECIAL_CHARACTER_ORDER,
  getCachedBuklodCharacterSelectionV2, getMyBuklodCharacterSelectionV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State, type BuklodCoreCharacterId, type BuklodSpecialCharacterId, type BuklodCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { PROGRESSIVE_LEVEL_THRESHOLDS, collectibleNames } from '@/lib/buklodProgressiveCharacter';
import { getBuklodSpecialLevelAsset } from '@/lib/buklodSpecialCharacterAssets';
import {
  characterTokenIcon, clearMyCharacterCollectible, getMyCharacterCollectibles,
  isCollectibleLevelOpen, isCollectibleShown, shownCollectiblePins, redeemMyCharacterCollectible,
  useMyCharacterCollectible, type CharacterCollectibleState,
} from '@/lib/buklodCharacterCollectibles';

const C = {
  sky: '#071d2e', deep: '#0b2437', card: '#142f40', border: '#947b52',
  gold: '#f1d598', muted: '#bfd1d2', white: '#fff3d7', emerald: '#86d7bc',
};
const money = (value: number) => Math.max(0, Math.floor(value || 0)).toLocaleString('en-PH');
/** Existing approved map routes. No new games, unlocks or station mutations. */
const HERO_GAME: Record<BuklodCharacterId, string> = {
  phan: '/games/phan-enterprise-builder',
  quin: '/games/quin-discovery-expedition',
  van: '/games/van-living-city-dispatch',
  christian: '/games/christian-civic-leadership',
  lhen: '/games/lhen-rhythm-journey',
  jawo: '/games/jawo-forest-trail',
  vhen: '/games/vhen-farm-to-market',
  trudice: '/games/trudice-playground-memory',
  mitch: '/games/mitch-restore-mural',
  ace: '/games/ace-rescue-grid',
  niel: '/games/niel-mission-trail',
  angel: '/games/angel-kingdom-treasury',
  ellusur: '/games/elesur-village-builder',
};

export default function KingdomLegacyScreen() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(() =>
    getCachedBuklodCharacterSelectionV2(uid),
  );
  const [collection, setCollection] = useState<CharacterCollectibleState | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [reveal, setReveal] = useState<{ name: string; index: number; level: number; kind?: import('@/lib/buklodCharacterCollectibles').CharacterCollectibleRewardKind } | null>(null);
  const revealScale = useRef(new Animated.Value(.72)).current;
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const operation = useRef(false);
  const accountRef = useRef(uid);
  accountRef.current = uid;
  const activeId = state?.active_character_id;
  const core = activeId && CORE_CHARACTER_ORDER.includes(activeId as BuklodCoreCharacterId)
    ? activeId as BuklodCoreCharacterId : null;
  const level = Math.min(20, Math.max(1, Math.floor(state?.character_level || 1)));
  const points = Math.max(0, state?.character_points_since_selection || 0);
  const nextTarget = level < 20 ? PROGRESSIVE_LEVEL_THRESHOLDS[level] : null;
  const previousTarget = PROGRESSIVE_LEVEL_THRESHOLDS[level - 1];
  const consistent = points >= previousTarget && (nextTarget === null || points < nextTarget);
  const percent = consistent && nextTarget !== null
    ? Math.max(0, Math.min(100, 100 * (points - previousTarget) / (nextTarget - previousTarget)))
    : nextTarget === null ? 100 : 0;
  const itemNames = useMemo(() => core ? collectibleNames(core, level) : [], [core, level]);
  const acquired = useMemo(() => (collection?.items ?? []).filter(item =>
    item.redeemedAt && item.collectibleId && item.characterId === core), [collection, core]);
  const treasured = useMemo(() => [...acquired].sort((a,b) =>
    b.level - a.level || b.itemIndex - a.itemIndex).slice(0, 6), [acquired]);

  useEffect(() => {
    if (!reveal) return;
    revealScale.setValue(.72);
    revealOpacity.setValue(0);
    const entering = Animated.parallel([
      Animated.spring(revealScale, { toValue:1, speed:17, bounciness:8, useNativeDriver:true }),
      Animated.timing(revealOpacity, { toValue:1, duration:260, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]);
    entering.start();
    return () => entering.stop();
  }, [reveal, revealOpacity, revealScale]);

  const load = useCallback(async (id: string, refresh = false) => {
    const next = await getMyBuklodCharacterSelectionV2(id, refresh);
    if (next.active_character_id && CORE_CHARACTER_ORDER.includes(next.active_character_id as BuklodCoreCharacterId)) {
      const items = await getMyCharacterCollectibles(next.active_character_id as BuklodCoreCharacterId);
      return { next, items };
    }
    return { next, items: null };
  }, []);

  useEffect(() => {
    let alive = true;
    setState(uid ? getCachedBuklodCharacterSelectionV2(uid) : null);
    setCollection(null);
    setReveal(null);
    setError('');
    setNotice('');
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    void load(uid, true).then(({ next, items }) => {
      if (!alive) return;
      setState(next); setCollection(items);
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : 'Your progress could not load.');
    }).finally(() => { if (alive) setLoading(false); });
    const unsubscribe = subscribeBuklodCharacterSelectionV2((changedId, next) => {
      if (alive && changedId === uid) { setState(next); setCollection(null); }
    });
    return () => { alive = false; unsubscribe(); };
  }, [uid, load]);

  const refresh = useCallback(async () => {
    if (!uid || operation.current) return;
    setLoading(true);
    setError('');
    try {
      const { next, items } = await load(uid, true);
      if (accountRef.current === uid) { setState(next); setCollection(items); }
    } catch (reason) {
      if (accountRef.current === uid) setError(reason instanceof Error ? reason.message : 'Unable to refresh progress.');
    } finally { setLoading(false); }
  }, [uid, load]);

  const changeItem = useCallback(async (index: number, equipped: boolean) => {
    if (!uid || !core || !collection || operation.current) return;
    if (!isCollectibleLevelOpen(collection, level)) return;
    const original = { uid, core, level };
    operation.current = true;
    setBusyKey(String(index));
    setNotice('');
    try {
      if (equipped) {
        const item = collection.items.find(row =>
          row.characterId === core && row.level === level && row.itemIndex === index);
        if (!item) throw new Error('Item not available. Refresh your collection.');
        await clearMyCharacterCollectible(core, item.rewardKind);
      } else {
        // The server validates level ownership, account and item before any activation.
        await redeemMyCharacterCollectible(core, level, index);
        await useMyCharacterCollectible(core, level, index);
      }
      const updated = await getMyCharacterCollectibles(core);
      // Never carry an old account's collection into a newly signed-in account.
      if (original.uid === accountRef.current && original.core === core && original.level === level) {
        setCollection(updated);
        setNotice(equipped ? 'Item removed from your character.' : 'Item claimed and equipped to your character!');
        if (!equipped) {
          const verified = updated.items.find(row => row.characterId === core &&
            row.level === level && row.itemIndex === index && Boolean(row.redeemedAt));
          if (verified) {
            setReveal({ name: itemNames[index-1] ?? 'Character collectible', index,
              kind: verified.rewardKind, level });
            void playBuklodGameFeedback('unlock');
          }
        }
      }
    } catch (reason) {
      if (original.uid === accountRef.current) setNotice(reason instanceof Error ? reason.message : 'Could not update item. Please retry.');
    } finally {
      operation.current = false;
      setBusyKey('');
    }
  }, [uid, core, collection, level, itemNames]);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#071c2d', '#123c4e', '#071c2d']} style={StyleSheet.absoluteFill}/>
      <View pointerEvents="none" style={s.sunGlow}/>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: Math.max(12, insets.top) + 10, paddingBottom: Math.max(18, insets.bottom) + 26 }]}
      >
        <View style={s.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Kingdom map"
            onPress={() => router.back()} style={s.iconButton}>
            <MaterialCommunityIcons name="arrow-left" color={C.white} size={23}/>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>BUKLOD KINGDOM</Text>
            <Text style={s.pageTitle}>Hall of Legacy</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh Kingdom progress"
            disabled={loading} onPress={() => void refresh()} style={s.iconButton}>
            <MaterialCommunityIcons name="refresh" color={C.white} size={22}/>
          </Pressable>
        </View>

        {!uid ? (
          <View style={s.emptyPanel}><Text style={s.emptyTitle}>Sign in to view your Kingdom Legacy.</Text>
            <Text style={s.hint}>Your badges and Character items are private to your BUKLOD account.</Text></View>
        ) : null}
        {uid && error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        {uid && loading ? <ActivityIndicator color={C.gold} style={{ marginBottom: 12 }}/> : null}

        {uid && state ? <>
          <LinearGradient colors={['#244754', '#153b4a', '#0b293e']} style={s.hero}>
            <View style={s.stars}><MaterialCommunityIcons name="star-four-points" color="#f5ddaa" size={17}/>
              <Text style={s.starsText}>PERMANENT KINGDOM LEGACY</Text></View>
            <View style={s.heroContent}>
              <View style={s.medal}>
                <BuklodCircleRankBadge rankName={state.circle_rank_name} size={83}/>
              </View>
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <Text style={s.heroLabel}>OVERALL CIRCLE RANK</Text>
                <Text style={s.heroTitle}>{state.circle_rank_name}</Text>
                <Text style={s.heroMeta}>{money(state.lifetime_points)} verified lifetime BP</Text>
              </View>
            </View>
            <View style={s.ribbon}>
              <MaterialCommunityIcons name="shield-check" color={C.emerald} size={19}/>
              <Text style={s.ribbonText}>Permanent rank — it does not reset when you change character.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/points/progression' as any)}
              style={s.goldButton}>
              <Text style={s.goldButtonText}>VIEW FULL RANK ROADMAP</Text>
              <MaterialCommunityIcons name="arrow-right" color="#382d1d" size={18}/>
            </Pressable>
          </LinearGradient>

          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>YOUR ACTIVE HERO</Text>
            <Text style={s.sectionHint}>Character Level {level} / 20</Text>
          </View>
          <View style={s.heroCard}>
            <View style={[s.artFrame, { width: windowWidth < 390 ? 112 : 140 }]}>
              {core ? <BuklodProgressiveCharacterArt
                characterId={core} level={level} height={205}
                viewportWidth={windowWidth < 390 ? 112 : 140}/> :
                activeId && SPECIAL_CHARACTER_ORDER.includes(activeId as BuklodSpecialCharacterId)
                  ? <Image source={getBuklodSpecialLevelAsset(activeId as BuklodSpecialCharacterId, level)}
                      resizeMode="contain" style={{ width: windowWidth < 390 ? 112 : 140, height: 205 }}/>
                  : <View style={s.fallbackArt}><MaterialCommunityIcons name="crown" size={55} color={C.gold}/></View>}
              {core && collection ? <View pointerEvents="none" style={s.itemPins}>
                {shownCollectiblePins(collection, core).map(pin =>
                  <View key={pin.key} style={s.itemPin}>
                    <MaterialCommunityIcons name={characterTokenIcon(core, pin.itemIndex) as never} color={C.gold} size={14}/>
                  </View>)}
              </View> : null}
            </View>
            <View style={{ flex: 1, justifyContent: 'center', gap: 7 }}>
              <Text style={s.heroName}>{activeId ? CHARACTER_DISPLAY_NAME[activeId] : 'Character'}</Text>
              <Text style={s.labelSmall}>LEVEL {level} • CHARACTER PROGRESSION</Text>
              <Text style={s.valueSmall}>{money(points)} points earned since selection</Text>
              <View accessibilityLabel="Character level progress" style={s.track}>
                <View style={[s.fill, { width: percent + '%' }]}/>
              </View>
              <Text style={s.hint}>
                {nextTarget === null ? 'Maximum character level reached'
                  : consistent ? money(nextTarget - points) + ' BP to next character level'
                    : 'Refresh to verify level progression'}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/me' as any)} style={s.outlineButton}>
                <Text style={s.outlineText}>OPEN CHARACTER STUDIO</Text>
              </Pressable>
            </View>
          </View>

          {activeId ? <Pressable accessibilityRole="button"
            accessibilityLabel={'Play ' + CHARACTER_DISPLAY_NAME[activeId] + ' Kingdom games'}
            onPress={() => router.push(HERO_GAME[activeId] as any)} style={s.questCard}>
            <MaterialCommunityIcons name="sword-cross" size={25} color={C.gold}/>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.questTitle}>CONTINUE {CHARACTER_DISPLAY_NAME[activeId].toUpperCase()}'S ADVENTURE</Text>
              <Text style={s.questCopy}>Open this hero's existing Kingdom game center. Only server-verified mastery can credit real BP.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={25} color={C.gold}/>
          </Pressable> : null}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>YOUR EQUIPMENT & REWARDS</Text>
            <Text style={s.sectionHint}>{collection ? acquired.length + ' claimed' : 'Server-verified items'}</Text>
          </View>
          {core ? <>
            <Text style={s.description}>Each item belongs to your current hero. Claim and show it to add its existing visual, profile or character effect. Other equipment types do not alter BP or rank.</Text>
            <View style={s.collection}>
              {itemNames.map((name, i) => {
                const index = i + 1;
                const item = collection?.items.find(row => row.characterId === core && row.level === level && row.itemIndex === index);
                const unlocked = isCollectibleLevelOpen(collection, level);
                const equipped = Boolean(item && isCollectibleShown(item, collection));
                const disabled = !collection || !unlocked || Boolean(busyKey);
                return <View key={core + ':' + level + ':' + index} style={s.itemRow}>
                  <View style={s.itemIcon}>
                    <KingdomRelicEmblem index={index} level={level}
                      rewardKind={item?.rewardKind} size={62} locked={!unlocked}/>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={s.itemName}>{name}</Text>
                    <Text style={s.itemDescription}>{equipped ? 'EQUIPPED' : !collection ? 'CHECKING REWARD' : unlocked ? kingdomFinishLabel(level).toUpperCase() + ' FINISH · READY TO CLAIM' : 'LOCKED'}</Text>
                  </View>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel={(equipped ? 'Remove ' : 'Claim and equip ') + name}
                    disabled={disabled}
                    onPress={() => void changeItem(index, equipped)}
                    style={[s.itemAction, disabled && s.disabled, equipped && s.equippedAction]}>
                    {busyKey === String(index) ? <ActivityIndicator color={C.deep} size="small"/> :
                      <Text style={s.itemActionText}>{equipped ? 'REMOVE' : unlocked ? 'CLAIM' : 'LOCKED'}</Text>}
                  </Pressable>
                </View>;
              })}
            </View>
            {treasured.length > 0 ? <>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>LEGACY COLLECTION</Text>
                <Text style={s.sectionHint}>Previously claimed • {acquired.length} total</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                {treasured.map(item => (
                  <View key={item.collectibleId} style={s.trophyCard}>
                    <KingdomRelicEmblem index={item.itemIndex} level={item.level}
                      rewardKind={item.rewardKind} size={72}/>
                    <Text numberOfLines={1} style={s.trophyLevel}>LEVEL {item.level}</Text>
                    <Text numberOfLines={1} style={s.trophyFinish}>{kingdomFinishLabel(item.level)}</Text>
                  </View>
                ))}
              </ScrollView>
            </> : null}
          </> : <View style={s.emptyPanel}>
            <Text style={s.emptyTitle}>Special Character Collection</Text>
            <Text style={s.hint}>Your Special Character badges and rewards are managed in Character Studio. This gallery never creates duplicate awards.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/me' as any)} style={s.outlineButton}>
              <Text style={s.outlineText}>VIEW SPECIAL CHARACTER BADGES</Text>
            </Pressable>
          </View>}
          {notice ? <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text> : null}
          <View style={s.footerNote}>
            <MaterialCommunityIcons name="information-outline" size={18} color={C.muted}/>
            <Text style={s.footerText}>Kingdom map clears are local gameplay records, separate from lifetime BP and server-confirmed collectible rewards. New relics and Shards are not yet spendable or claimable.</Text>
          </View>
        </> : uid && !loading ? <View style={s.emptyPanel}>
          <Text style={s.emptyTitle}>No verified Character data yet.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={s.outlineButton}><Text style={s.outlineText}>RETRY</Text></Pressable>
        </View> : null}
      </ScrollView>
      <Modal visible={Boolean(reveal)} transparent animationType="fade"
        onRequestClose={() => setReveal(null)}>
        <View style={s.modalShade}>
          <Animated.View style={[s.modalCard, {
            opacity: revealOpacity, transform: [{ scale: revealScale }],
          }]}>
            <Text style={s.modalEyebrow}>KINGDOM COLLECTION</Text>
            <View style={{ alignItems: 'center', marginVertical: 9 }}>
              {reveal ? <KingdomRelicEmblem size={144} index={reveal.index}
                level={reveal.level} rewardKind={reveal.kind}/> : null}
            </View>
            <Text style={s.modalTitle}>ITEM EQUIPPED!</Text>
            <Text style={s.modalName}>{reveal?.name ?? ''}</Text>
            <Text style={s.modalDescription}>Server-confirmed character collectible • {reveal ? kingdomFinishLabel(reveal.level) : ''} visual finish. No additional BP or currency awarded.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close reward celebration"
              onPress={() => setReveal(null)} style={s.goldButton}>
              <Text style={s.goldButtonText}>CONTINUE MY KINGDOM</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.sky },
  sunGlow: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(198,157,73,0.08)', top: -145, right: -125 },
  scroll: { width: '100%', maxWidth: 770, alignSelf: 'center', paddingHorizontal: 14, gap: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  overline: { fontSize: 10, letterSpacing: 2, fontWeight: '900', color: C.gold },
  pageTitle: { fontSize: 25, fontWeight: '900', color: C.white },
  hero: { borderRadius: 23, padding: 17, gap: 13, borderWidth: 1.5, borderColor: '#c7a96a' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  starsText: { fontSize: 10, fontWeight: '900', color: C.gold, letterSpacing: 1.4 },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medal: { width: 103, height: 113, borderRadius: 19, backgroundColor: 'rgba(255,228,162,.08)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 9, fontWeight: '900', color: C.muted, letterSpacing: 1.0 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: C.white, marginTop: 5 },
  heroMeta: { fontSize: 12, fontWeight: '700', color: C.gold, marginTop: 6 },
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 11, backgroundColor: 'rgba(4,20,28,.46)' },
  ribbonText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700', color: C.muted },
  goldButton: { minHeight: 44, borderRadius: 12, backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goldButtonText: { fontSize: 12, fontWeight: '900', color: '#382d1d' },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 5 },
  sectionTitle: { fontSize: 14, color: C.gold, fontWeight: '900', letterSpacing: 0.8 },
  sectionHint: { fontSize: 10, color: C.muted, fontWeight: '800' },
  heroCard: { minHeight: 215, flexDirection: 'row', gap: 11, borderRadius: 20, padding: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  artFrame: { minHeight: 205, backgroundColor: '#1e4b54', borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  fallbackArt: { height: 205, alignItems: 'center', justifyContent: 'center' },
  itemPins: { position: 'absolute', top: 6, left: 5, gap: 4 },
  itemPin: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#0c2735', borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 21, color: C.white, fontWeight: '900' },
  labelSmall: { color: C.gold, fontSize: 9, fontWeight: '900', lineHeight: 14 },
  valueSmall: { fontSize: 11, fontWeight: '700', color: C.white },
  track: { height: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: '#092132', borderWidth: 1, borderColor: '#5c6f74' },
  fill: { height: '100%', backgroundColor: '#e1b75c' },
  hint: { fontSize: 11, lineHeight: 17, color: C.muted },
  outlineButton: { borderRadius: 10, borderWidth: 1, borderColor: C.gold, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 10, fontWeight: '900', color: C.gold, textAlign: 'center' },
  description: { color: C.muted, fontSize: 12, lineHeight: 18 },
  questCard: { flexDirection:'row', alignItems:'center', gap:12, borderWidth:1, borderColor:'#b19a6c', borderRadius:14, backgroundColor:'#203e4a', padding:13, minHeight:76 },
  questTitle: { color:C.gold, fontSize:12, fontWeight:'900', letterSpacing:.4 },
  questCopy: { color:C.muted, fontSize:11, lineHeight:16 },
  collection: { gap: 9 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 81, padding: 9, borderRadius: 14, borderWidth: 1, borderColor: '#68828a', backgroundColor: '#153144' },
  itemIcon: { width: 68, height: 68, borderRadius: 14, backgroundColor:'#0c2734', alignItems: 'center', justifyContent: 'center' },
  trophyCard: { width:105, alignItems:'center', gap:2, backgroundColor:'#143448', borderWidth:1, borderColor:'#987c53', borderRadius:13, padding:9 },
  trophyLevel: { color:C.white, fontSize:11, fontWeight:'900' },
  trophyFinish: { color:C.gold, fontSize:10, fontWeight:'800' },
  modalShade: { flex:1, backgroundColor:'rgba(2,13,23,.88)', alignItems:'center', justifyContent:'center', padding:20 },
  modalCard: { width:'100%', maxWidth:360, borderRadius:23, backgroundColor:'#183747', borderWidth:2, borderColor:'#edcc83', padding:22, alignItems:'center', gap:10 },
  modalEyebrow: { color:C.gold, fontWeight:'900', fontSize:11, letterSpacing:2 },
  modalTitle: { color:C.white, fontWeight:'900', fontSize:23, textAlign:'center' },
  modalName: { color:C.gold, fontSize:16, fontWeight:'900', textAlign:'center' },
  modalDescription: { color:C.muted, fontSize:12, lineHeight:19, textAlign:'center', marginBottom:13 },
  itemName: { fontSize: 12, fontWeight: '900', color: C.white },
  itemDescription: { marginTop: 5, fontSize: 9, letterSpacing: .5, fontWeight: '900', color: C.emerald },
  itemAction: { minWidth: 64, paddingHorizontal: 8, height: 38, backgroundColor: C.gold, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  itemActionText: { fontSize: 10, fontWeight: '900', color: '#2d3136' },
  equippedAction: { backgroundColor: '#abccb9' },
  disabled: { opacity: .46 },
  error: { fontSize: 12, lineHeight: 18, padding: 12, color: '#ffd4ca', backgroundColor: '#5d2e39', borderRadius: 9 },
  notice: { fontSize: 12, lineHeight: 18, color: C.emerald, backgroundColor: '#173c3c', padding: 12, borderRadius: 11 },
  emptyPanel: { gap: 13, padding: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  emptyTitle: { fontSize: 16, color: C.white, fontWeight: '900' },
  footerNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, borderRadius: 12, backgroundColor: 'rgba(7,22,31,.55)' },
  footerText: { flex: 1, fontSize: 11, lineHeight: 17, color: C.muted },
});
