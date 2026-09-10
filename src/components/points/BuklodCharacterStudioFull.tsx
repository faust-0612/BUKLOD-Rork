import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import BuklodSpecialCharacterArtV2 from '@/components/points/BuklodSpecialCharacterArtV2';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import { useAuth } from '@/providers/AuthProvider';
import { collectibleNames, PROGRESSIVE_CHARACTERS, type ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';
import { BUKLOD_SPECIAL_CATALOG } from '@/lib/buklodCharacterSpecialCatalog';
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
  type BuklodCoreCharacterId,
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

const ALL_IDS: BuklodCharacterId[] = [...CORE_CHARACTER_ORDER, ...SPECIAL_CHARACTER_ORDER];

function isBasic(id: BuklodCharacterId): id is BuklodCoreCharacterId {
  return CORE_CHARACTER_ORDER.includes(id as BuklodCoreCharacterId);
}

function CharacterArt({ id, level, size = 176 }: { id: BuklodCharacterId; level: number; size?: number }) {
  if (isBasic(id)) {
    return <BuklodProgressiveCharacterArt characterId={id as ProgressiveCharacterId} level={level} height={size} viewportWidth={size - 8} />;
  }
  return <BuklodSpecialCharacterArtV2 characterId={id as BuklodSpecialCharacterId} height={size} viewportWidth={size - 8} />;
}

export default function BuklodCharacterStudioFull({ visible, onClose, userId }: Props) {
  const { theme } = useBuklodPresentation();
  const bottom = useBuklodDrawerBottomInset();
  const { hasRole } = useAuth();
  const isSystemAdmin = hasRole('system_admin');

  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<BuklodCharacterId | null>(null);
  const [previewId, setPreviewId] = useState<BuklodCharacterId>('phan');
  const [qaLevel, setQaLevel] = useState(1);
  const [qaAchievementPreview, setQaAchievementPreview] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    let alive = true;
    setLoading(true);
    void getMyBuklodCharacterSelectionV2(userId, true)
      .then(next => {
        if (!alive) return;
        setState(next);
        setPreviewId(next.active_character_id);
        setQaLevel(next.character_level);
      })
      .catch((error: unknown) => {
        if (alive) Alert.alert('BUKLOD Character', error instanceof Error ? error.message : 'Could not load character selection.');
      })
      .finally(() => { if (alive) setLoading(false); });
    const off = subscribeBuklodCharacterSelectionV2((id, next) => {
      if (!alive || id !== userId) return;
      setState(next);
      if (!isSystemAdmin || previewId === next.active_character_id) {
        setPreviewId(next.active_character_id);
        setQaLevel(next.character_level);
      }
    });
    return () => { alive = false; off(); };
  }, [isSystemAdmin, previewId, userId, visible]);

  const serverUnlocked = useMemo(() => new Set(state?.visible_special_character_ids ?? []), [state?.visible_special_character_ids]);
  const visibleUnlocked = useMemo(() => {
    if (isSystemAdmin) return new Set<BuklodSpecialCharacterId>(SPECIAL_CHARACTER_ORDER);
    return serverUnlocked;
  }, [isSystemAdmin, serverUnlocked]);

  const nextLocked = useMemo(() => SPECIAL_CHARACTER_ORDER.find(id => !serverUnlocked.has(id)) ?? null, [serverUnlocked]);
  const previewLevel = isSystemAdmin ? qaLevel : state?.active_character_id === previewId ? state.character_level : 1;

  const basicProfile = isBasic(previewId) ? PROGRESSIVE_CHARACTERS[previewId as ProgressiveCharacterId] : null;
  const specialProfile = !isBasic(previewId) ? BUKLOD_SPECIAL_CATALOG[previewId as BuklodSpecialCharacterId] : null;
  const levelTitles = basicProfile?.stages ?? specialProfile?.levels ?? [];
  const currentTitle = levelTitles[Math.max(0, previewLevel - 1)] ?? `Level ${previewLevel}`;
  const traitText = basicProfile?.traits ?? specialProfile?.description ?? '';
  const world = specialProfile?.world ?? `${CHARACTER_DISPLAY_NAME[previewId]} Growth World`;
  const miniGame = specialProfile?.miniGame ?? `${CHARACTER_DISPLAY_NAME[previewId]} Character Challenge`;
  const focusTags = specialProfile?.focusTags ?? ['Growth','Consistency','Service','BUKLOD Participation'];
  const collectibleList = isBasic(previewId)
    ? collectibleNames(previewId as ProgressiveCharacterId, previewLevel)
    : specialProfile?.collectibles ?? [];
  const badgeList = specialProfile?.badges ?? [
    `${CHARACTER_DISPLAY_NAME[previewId]} Starter`,
    `${CHARACTER_DISPLAY_NAME[previewId]} Builder`,
    `${CHARACTER_DISPLAY_NAME[previewId]} Guide`,
    `${CHARACTER_DISPLAY_NAME[previewId]} Master`,
    `${CHARACTER_DISPLAY_NAME[previewId]} Champion`,
  ];

  const canSelectNormally = (id: BuklodCharacterId) => isBasic(id) || serverUnlocked.has(id as BuklodSpecialCharacterId);

  async function choose(id: BuklodCharacterId) {
    setPreviewId(id);
    setQaLevel(state?.active_character_id === id ? state.character_level : 1);
    setQaAchievementPreview(false);

    if (isSystemAdmin && !canSelectNormally(id)) return;
    if (!userId || busy || state?.active_character_id === id) return;
    setBusy(id);
    try {
      const next = await setMyBuklodCharacterActiveV2(userId, id);
      setState(next);
      setPreviewId(next.active_character_id);
      setQaLevel(next.character_level);
    } catch (error: unknown) {
      Alert.alert('BUKLOD Character', error instanceof Error ? error.message : 'Could not change Character.');
    } finally {
      setBusy(null);
    }
  }

  const earnedLevel = isSystemAdmin && qaAchievementPreview ? previewLevel : state?.active_character_id === previewId ? state.character_level : 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: theme.surface, paddingBottom: bottom }]} onPress={e => e.stopPropagation()}>
          <View style={[s.header, { borderBottomColor: theme.border }]}>
            <View style={{flex:1}}>
              <Text style={[s.title,{color:theme.textPrimary}]}>Customize BUKLOD Character</Text>
              <Text style={[s.sub,{color:theme.textMuted}]}>5 Basic + 8 Special · Level 1–20 · Collectibles · Badges · Worlds · Challenges</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP}><MaterialCommunityIcons name="close" size={24} color={theme.textMuted}/></Pressable>
          </View>

          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {loading && !state ? <View style={s.loading}><ActivityIndicator color={theme.accent}/></View> : null}

            {isSystemAdmin ? <View style={[s.admin,{borderColor:theme.accent,backgroundColor:theme.accentSoft}]}><MaterialCommunityIcons name="shield-key-outline" size={24} color={theme.accent}/><View style={{flex:1}}><Text style={[s.adminTitle,{color:theme.accent}]}>SYSTEM ADMIN · CHARACTER QA ACCESS</Text><Text style={[s.adminCopy,{color:theme.textSecondary}]}>All 13 characters and all Levels 1–20 can be previewed. QA preview does not bypass the server for normal users.</Text></View></View> : null}

            {state ? <View style={[s.status,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}><Text style={[s.eyebrow,{color:theme.accent}]}>CURRENT SERVER CHARACTER</Text><Text style={[s.statusName,{color:theme.textPrimary}]}>{CHARACTER_DISPLAY_NAME[state.active_character_id]} · Level {state.character_level}</Text><Text style={[s.meta,{color:theme.textSecondary}]}>{state.circle_rank_name} · Circle Rank #{state.circle_rank_order}</Text><Text style={[s.meta,{color:theme.textMuted}]}>{state.character_points_since_selection.toLocaleString('en-PH')} Character Points</Text></View> : null}

            <View style={[s.hero,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}>
              <View style={[s.heroArt,{backgroundColor:theme.surface,borderColor:theme.border}]}><CharacterArt id={previewId} level={previewLevel} size={188}/></View>
              <View style={s.heroCopy}>
                <Text style={[s.eyebrow,{color:theme.accent}]}>{isBasic(previewId)?'BASIC CHARACTER':'SPECIAL CHARACTER'}</Text>
                <Text style={[s.heroName,{color:theme.textPrimary}]}>{CHARACTER_DISPLAY_NAME[previewId]}</Text>
                {specialProfile ? <Text style={[s.themeTitle,{color:theme.accent}]}>{specialProfile.themeTitle}</Text> : null}
                {specialProfile ? <Text style={[s.motto,{color:theme.textSecondary}]}>“{specialProfile.motto}”</Text> : null}
                <Text style={[s.heroStage,{color:theme.textPrimary}]}>Level {previewLevel} · {currentTitle}</Text>
                <Text style={[s.heroBody,{color:theme.textSecondary}]}>{traitText}</Text>
                <View style={s.tags}>{focusTags.map(tag=><View key={tag} style={[s.tag,{borderColor:theme.border}]}><Text style={[s.tagText,{color:theme.textSecondary}]}>{tag}</Text></View>)}</View>
              </View>
            </View>

            <Text style={[s.section,{color:theme.textMuted}]}>5 BASIC CHARACTERS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.characterRail}>
              {CORE_CHARACTER_ORDER.map(id => {
                const active = previewId === id;
                return <Pressable key={id} onPress={()=>void choose(id)} style={[s.characterCard,{borderColor:active?theme.accent:theme.border,backgroundColor:theme.surface}]}><View style={s.smallArt}><BuklodProgressiveCharacterArt characterId={id as ProgressiveCharacterId} level={state?.active_character_id===id?state.character_level:1} height={100} viewportWidth={88}/></View><Text style={[s.characterName,{color:theme.textPrimary}]}>{CHARACTER_DISPLAY_NAME[id]}</Text><Text style={[s.characterMeta,{color:theme.textMuted}]}>{state?.active_character_id===id?`LEVEL ${state.character_level}`:'STARTS LEVEL 1'}</Text>{busy===id?<ActivityIndicator size="small" color={theme.accent}/>:null}</Pressable>;
              })}
            </ScrollView>

            <View style={s.sectionRow}><Text style={[s.section,{color:theme.textMuted,marginBottom:0}]}>8 SPECIAL CHARACTERS</Text><MaterialCommunityIcons name="star-four-points-outline" size={17} color={theme.accent}/></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.characterRail}>
              {SPECIAL_CHARACTER_ORDER.map(id => {
                const isServerUnlocked = serverUnlocked.has(id);
                const qaVisible = isSystemAdmin;
                const isNext = id===nextLocked;
                const concealed = !qaVisible && !isServerUnlocked && !isNext;
                const active = previewId===id;
                return <Pressable key={id} disabled={concealed} onPress={()=>void choose(id)} style={[s.characterCard,{borderColor:active?theme.accent:theme.border,backgroundColor:theme.surface},concealed&&{opacity:.55}]}>{concealed?<View style={[s.smallArt,s.concealed,{borderColor:theme.border}]}><MaterialCommunityIcons name="lock" size={30} color={theme.textMuted}/></View>:<View style={[s.smallArt,!isServerUnlocked&&!isSystemAdmin&&{opacity:.3}]}><BuklodSpecialCharacterArtV2 characterId={id} height={100} viewportWidth={88}/></View>}<Text style={[s.characterName,{color:theme.textPrimary}]}>{concealed?'LOCKED SPECIAL':CHARACTER_DISPLAY_NAME[id]}</Text><Text style={[s.characterMeta,{color:theme.textMuted}]}>{isServerUnlocked?'UNLOCKED':isSystemAdmin?'QA OPEN':`RANK ${SPECIAL_REQUIRED_RANK_ORDER[id]}`}</Text></Pressable>;
              })}
            </ScrollView>

            <View style={s.sectionRow}><View><Text style={[s.section,{color:theme.textMuted,marginBottom:0}]}>LEVEL 1–20 JOURNEY</Text><Text style={[s.hint,{color:theme.textSecondary}]}>Each character has its own independent journey.</Text></View>{isSystemAdmin?<Text style={[s.qaText,{color:theme.accent}]}>QA LEVEL {qaLevel}</Text>:null}</View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.levelRail}>
              {Array.from({length:20},(_,i)=>i+1).map(level => {
                const current = level===previewLevel;
                const earned = level<=earnedLevel;
                return <Pressable key={level} disabled={!isSystemAdmin} onPress={()=>isSystemAdmin&&setQaLevel(level)} style={[s.levelCard,{borderColor:current?theme.accent:theme.border,backgroundColor:earned?theme.accentSoft:theme.surface}]}><Text style={[s.levelNumber,{color:current?theme.accent:theme.textPrimary}]}>L{level}</Text><Text numberOfLines={2} style={[s.levelTitle,{color:theme.textSecondary}]}>{levelTitles[level-1]??`Stage ${level}`}</Text><MaterialCommunityIcons name={earned?'check-circle':'lock-outline'} size={15} color={earned?theme.accent:theme.textMuted}/></Pressable>;
              })}
            </ScrollView>

            <View style={s.twoCol}>
              <View style={[s.panel,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}><Text style={[s.section,{color:theme.textMuted}]}>WORLD / MAP</Text><MaterialCommunityIcons name="map-marker-path" size={29} color={theme.accent}/><Text style={[s.panelTitle,{color:theme.textPrimary}]}>{world}</Text><Text style={[s.panelBody,{color:theme.textSecondary}]}>Expandable character world. Future stations can be added without ending the journey at Level 20.</Text><Pressable onPress={()=>Alert.alert('Character World',`${world} is assigned to ${CHARACTER_DISPLAY_NAME[previewId]}.`)} style={[s.panelButton,{borderColor:theme.border}]}><Text style={[s.panelButtonText,{color:theme.accent}]}>OPEN WORLD INFO</Text></Pressable></View>
              <View style={[s.panel,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}><Text style={[s.section,{color:theme.textMuted}]}>MINI-GAME / CHALLENGE</Text><MaterialCommunityIcons name="gamepad-variant-outline" size={29} color={theme.accent}/><Text style={[s.panelTitle,{color:theme.textPrimary}]}>{miniGame}</Text><Text style={[s.panelBody,{color:theme.textSecondary}]}>Character-specific challenge connected to progression and the canonical BUKLOD Points ledger.</Text><Pressable onPress={()=>Alert.alert(miniGame,'Game assignment is active in the character catalog; gameplay screen can open from its world station.')} style={[s.panelButton,{borderColor:theme.border}]}><Text style={[s.panelButtonText,{color:theme.accent}]}>VIEW GAME ASSIGNMENT</Text></Pressable></View>
            </View>

            <View style={[s.collection,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}><View style={s.collectionHead}><View><Text style={[s.section,{color:theme.textMuted,marginBottom:0}]}>COLLECTIBLES</Text><Text style={[s.hint,{color:theme.textSecondary}]}>Requirement-driven · automatic award design · no duplicate claim.</Text></View>{isSystemAdmin?<Pressable onPress={()=>setQaAchievementPreview(v=>!v)} style={[s.qaButton,{borderColor:theme.accent}]}><Text style={[s.qaButtonText,{color:theme.accent}]}>{qaAchievementPreview?'RESET QA STATE':'PREVIEW EARNED'}</Text></Pressable>:null}</View><View style={s.collectGrid}>{collectibleList.map((item,index)=>{const earned=isSystemAdmin&&qaAchievementPreview?index<Math.max(1,Math.ceil(previewLevel/2)):state?.active_character_id===previewId&&index<Math.max(1,Math.ceil(state.character_level/2));return <View key={`${item}-${index}`} style={[s.collectCard,{borderColor:earned?theme.accent:theme.border,backgroundColor:theme.surface}]}><MaterialCommunityIcons name={earned?'star-circle':'star-circle-outline'} size={22} color={earned?theme.accent:theme.textMuted}/><Text style={[s.collectText,{color:theme.textPrimary}]}>{item}</Text><Text style={[s.collectState,{color:earned?theme.accent:theme.textMuted}]}>{earned?'EARNED':'LOCKED'}</Text></View>;})}</View></View>

            <View style={[s.collection,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}><Text style={[s.section,{color:theme.textMuted}]}>BADGES & MASTERY</Text><View style={s.badgeGrid}>{badgeList.map((badge,index)=>{const milestone=[4,8,12,16,20][index]??20;const earned=earnedLevel>=milestone;return <View key={badge} style={[s.badgeCard,{borderColor:earned?theme.accent:theme.border}]}><MaterialCommunityIcons name={earned?'medal':'medal-outline'} size={24} color={earned?theme.accent:theme.textMuted}/><Text style={[s.badgeText,{color:theme.textPrimary}]}>{badge}</Text><Text style={[s.badgeMeta,{color:theme.textMuted}]}>Milestone L{milestone}</Text></View>;})}</View></View>

            {specialProfile ? <View style={[s.lockPanel,{backgroundColor:theme.surfaceElevated,borderColor:theme.border}]}><MaterialCommunityIcons name={serverUnlocked.has(previewId as BuklodSpecialCharacterId)?'lock-open-check-outline':'lock-outline'} size={24} color={theme.accent}/><View style={{flex:1}}><Text style={[s.section,{color:theme.textMuted,marginBottom:2}]}>SPECIAL UNLOCK</Text><Text style={[s.lockText,{color:theme.textPrimary}]}>Circle Rank #{specialProfile.unlockRank}</Text><Text style={[s.hint,{color:theme.textSecondary,marginBottom:0}]}>Current server rank: #{state?.circle_rank_order??1}. {isSystemAdmin?'System Admin can preview all Specials for QA.':''}</Text></View></View> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.55)'}, sheet:{height:'96%',borderTopLeftRadius:25,borderTopRightRadius:25,overflow:'hidden'}, header:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,borderBottomWidth:StyleSheet.hairlineWidth}, title:{fontSize:19,fontWeight:'900'}, sub:{marginTop:3,fontSize:10}, content:{padding:14,paddingBottom:40}, loading:{minHeight:80,alignItems:'center',justifyContent:'center'}, admin:{padding:13,borderRadius:16,borderWidth:1,flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}, adminTitle:{fontSize:9,fontWeight:'900',letterSpacing:.8}, adminCopy:{marginTop:3,fontSize:9.5,lineHeight:14}, status:{padding:13,borderRadius:16,borderWidth:1,marginBottom:12}, eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:.8}, statusName:{marginTop:4,fontSize:17,fontWeight:'900'}, meta:{marginTop:3,fontSize:10,fontWeight:'700'},
  hero:{borderRadius:20,borderWidth:1,padding:13,flexDirection:'row',gap:13,marginBottom:18}, heroArt:{width:190,height:202,borderRadius:17,borderWidth:1,overflow:'hidden',alignItems:'center',justifyContent:'center'}, heroCopy:{flex:1,minWidth:0,justifyContent:'center'}, heroName:{fontSize:26,fontWeight:'900'}, themeTitle:{marginTop:3,fontSize:10,fontWeight:'900',letterSpacing:.6}, motto:{marginTop:6,fontSize:10,fontWeight:'800',fontStyle:'italic',lineHeight:14}, heroStage:{marginTop:8,fontSize:13,fontWeight:'900'}, heroBody:{marginTop:4,fontSize:9.5,lineHeight:14}, tags:{marginTop:8,flexDirection:'row',flexWrap:'wrap',gap:5}, tag:{paddingHorizontal:7,paddingVertical:5,borderRadius:999,borderWidth:1}, tagText:{fontSize:8,fontWeight:'800'},
  section:{fontSize:10,fontWeight:'900',letterSpacing:.9,marginBottom:5}, hint:{fontSize:9.5,lineHeight:14,marginTop:3,marginBottom:7}, sectionRow:{marginTop:18,marginBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}, qaText:{fontSize:9,fontWeight:'900'}, characterRail:{gap:9,paddingRight:8}, characterCard:{width:116,minHeight:154,borderWidth:1.5,borderRadius:15,padding:8,alignItems:'center'}, smallArt:{width:90,height:102,overflow:'hidden',alignItems:'center',justifyContent:'center'}, concealed:{borderWidth:1,borderRadius:12}, characterName:{marginTop:5,fontSize:11,fontWeight:'900'}, characterMeta:{marginTop:2,fontSize:7.5,fontWeight:'900'},
  levelRail:{gap:7,paddingRight:8}, levelCard:{width:96,minHeight:104,borderRadius:13,borderWidth:1,padding:9,justifyContent:'space-between'}, levelNumber:{fontSize:12,fontWeight:'900'}, levelTitle:{fontSize:8.5,fontWeight:'700',lineHeight:11}, twoCol:{marginTop:18,flexDirection:'row',gap:9,flexWrap:'wrap'}, panel:{width:'48.5%',flexGrow:1,borderRadius:17,borderWidth:1,padding:12}, panelTitle:{marginTop:7,fontSize:13,fontWeight:'900'}, panelBody:{marginTop:4,fontSize:9,lineHeight:13}, panelButton:{marginTop:10,minHeight:34,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'}, panelButtonText:{fontSize:8,fontWeight:'900'},
  collection:{marginTop:12,borderRadius:18,borderWidth:1,padding:12}, collectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8}, qaButton:{minHeight:32,paddingHorizontal:10,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'}, qaButtonText:{fontSize:8,fontWeight:'900'}, collectGrid:{marginTop:8,flexDirection:'row',flexWrap:'wrap',gap:7}, collectCard:{width:'31.5%',minHeight:92,borderRadius:12,borderWidth:1,padding:8,alignItems:'center',justifyContent:'center'}, collectText:{marginTop:5,fontSize:8.5,fontWeight:'800',textAlign:'center'}, collectState:{marginTop:4,fontSize:7,fontWeight:'900'}, badgeGrid:{flexDirection:'row',flexWrap:'wrap',gap:7}, badgeCard:{width:'31.5%',minHeight:96,borderWidth:1,borderRadius:12,padding:8,alignItems:'center',justifyContent:'center'}, badgeText:{marginTop:5,fontSize:8.5,fontWeight:'900',textAlign:'center'}, badgeMeta:{marginTop:3,fontSize:7}, lockPanel:{marginTop:12,padding:12,borderRadius:16,borderWidth:1,flexDirection:'row',alignItems:'center',gap:10}, lockText:{fontSize:13,fontWeight:'900'},
});
