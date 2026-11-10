import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { buildKingdomOfflineLevel, KINGDOM_OFFLINE_MAX_LEVEL } from './kingdomOfflineGenerator.mjs';
import { emptyKingdomShards, getCachedKingdomShards, getMyKingdomShards,
  hasKingdomPower, type KingdomShardsSnapshot } from '@/lib/buklodKingdomShards';

const LIMIT = KINGDOM_OFFLINE_MAX_LEVEL;

type Phase = 'loading' | 'ready' | 'playing' | 'saving' | 'complete';

export function KingdomOfflineContinuation({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { t } = useBuklodGameLanguage();
  const key = userId ? `buklod:kingdom:offline:v1:${userId}:${gameId}` : '';
  const [completed, setCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<Phase>('loading');
  const [answers, setAnswers] = useState([-1,-1,-1]);
  const [notice, setNotice] = useState('');
  const [powerState, setPowerState] = useState<KingdomShardsSnapshot>(emptyKingdomShards);
  const [wisdomHintIndex, setWisdomHintIndex] = useState<number | null>(null);
  const [compassActive, setCompassActive] = useState(false);
  const keyRef = useRef(key);
  keyRef.current = key;
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    setPhase('loading'); setCompleted(0); setLevel(1); setAnswers([-1,-1,-1]); setNotice('');
    setWisdomHintIndex(null); setCompassActive(false); setPowerState(emptyKingdomShards());
    if (!key) { setPhase('ready'); return () => { alive = false; }; }
    void AsyncStorage.getItem(key).then(value => {
      if (!alive || keyRef.current !== key) return;
      const progress = Number(value ?? '0');
      const saved = Number.isInteger(progress) ? Math.max(0, Math.min(LIMIT, progress)) : 0;
      setCompleted(saved); setLevel(Math.min(LIMIT,saved+1)); setPhase('ready');
    }).catch(() => {
      if (alive && keyRef.current === key) { setPhase('ready'); setNotice(t(
        'Local progress could not be restored; offline practice is still available.',
        'Hindi na-load ang local progress; maaari pa ring mag-practice.')); }
    });
    return () => { alive = false; };
  // Language switches should not reset an active offline level or its answers.
  }, [key]);

  // Refresh entitlements on return from Treasury. Cached proof keeps practice
  // functional offline; no local state can change a server wallet or BP.
  useFocusEffect(useCallback(() => {
    let active = true;
    setPowerState(emptyKingdomShards());
    if (!userId) return () => { active=false; };
    void getCachedKingdomShards(userId).then(value => {
      if (active && keyRef.current===key) setPowerState(value);
    });
    void getMyKingdomShards(userId).then(value => {
      if (active && keyRef.current===key) setPowerState(value);
    });
    return () => { active=false; };
  }, [userId, key]));

  const hasWisdom = hasKingdomPower(powerState,'wisdom_lens');
  const hasShield = hasKingdomPower(powerState,'guardian_shield');
  const hasCompass = hasKingdomPower(powerState,'explorer_compass');
  const hasAura = hasKingdomPower(powerState,'aura_emerald');

  const items = useMemo(() => userId ? buildKingdomOfflineLevel(gameId, level, userId) : [],
    [gameId, level, userId]);
  const allAnswered = answers.every(index => index >= 0);
  const score = items.reduce((count,item,index) =>
    count + (item.answer_index === answers[index] ? 1 : 0),0);

  const save = async () => {
    if (busy.current || phase !== 'playing' || !allAnswered || !key) return;
    busy.current = true;
    if (score !== 3) {
      if (hasShield) {
        // Shield is a permanent noncredit practice convenience, not a grant.
        // Keep correct answers and allow another attempt on the incorrect ones.
        setAnswers(current => current.map((value,index) =>
          items[index]?.answer_index === value ? value : -1));
        setNotice(t('Guardian Shield kept correct answers. Retry the remaining questions.',
          'Iningatan ng Guardian Shield ang tamang sagot. Ulitin ang natitira.'));
        busy.current=false;
        void playBuklodGameFeedback('collect');
        return;
      }
      setPhase('complete');
      setNotice(t('Score 3/3 to advance. Review your answers and retry.', 'Kailangan ng 3/3. Tingnan ang sagot at ulitin.'));
      busy.current = false;
      void playBuklodGameFeedback('failure');
      return;
    }
    setPhase('saving'); setNotice('');
    try {
      const saved = Math.max(completed,level);
      await AsyncStorage.setItem(key,String(saved));
      if (keyRef.current !== key) return;
      setCompleted(saved);
      setPhase('complete');
      void playBuklodGameFeedback('success');
    } catch {
      if (keyRef.current === key) { setPhase('playing'); setNotice(t(
        'Could not save this offline level. Try again; nothing was lost.',
        'Hindi ma-save ang level. Subukan muli; walang nawalang sagot.')); }
    } finally { busy.current = false; }
  };

  if (!userId) return null;
  return <View style={[styles.box,hasAura&&styles.aura]}>
    <Text style={styles.eyebrow}>KINGDOM • OFFLINE AUTO-BUILT ADVENTURE</Text>
    <Text style={styles.heading}>{t('Next levels — even without internet',
      'May susunod na levels kahit walang internet')}</Text>
    <Text style={styles.help}>{t(
      'Procedurally built, account-isolated practice levels with fresh numbers and scenarios. No AI charges, BP, character XP or cash rewards.',
      'Automatically nabubuong practice levels, hiwalay bawat account. Walang AI charges, BP, character XP o cash rewards.'
    )}</Text>
    <Text style={styles.progress}>{t('Completed', 'Natapos')}: {completed}/{LIMIT}</Text>
    <Pressable accessibilityRole="button" onPress={()=>router.push('/games/rewards' as any)}
      style={styles.powerShop}>
      <MaterialCommunityIcons name="diamond-stone" size={20} color="#f6dfaa"/>
      <View style={{flex:1,gap:3}}>
        <Text style={styles.powerTitle}>KINGDOM SHARD TREASURY & POWERS</Text>
        <Text style={styles.powerHint}>{powerState.source==='unavailable'
          ? 'Shop unlocks require a verified server sync'
          : powerState.source==='cached'?'Powers cached for offline practice'
            : 'Server-verified game-only upgrades'}</Text>
      </View>
      <Text style={styles.powerCount}>{powerState.source==='unavailable'?'—':powerState.balance}</Text>
    </Pressable>
    {(hasWisdom||hasShield||hasCompass||hasAura)?<Text style={styles.notice}>
      OWNED: {[hasWisdom&&'Wisdom Lens',hasShield&&'Guardian Shield',
        hasCompass&&'Explorer Compass',hasAura&&'Emerald Aura'].filter(Boolean).join(' • ')}
    </Text>:null}
    {phase === 'loading' ? <Text style={styles.notice}>Loading local practice…</Text> : null}
    {phase === 'ready' && completed < LIMIT ? <Pressable accessibilityRole="button" style={styles.button}
      onPress={() => { setLevel(completed+1); setAnswers([-1,-1,-1]); setWisdomHintIndex(null); setCompassActive(false); setPhase('playing'); setNotice(''); }}>
      <Text style={styles.buttonText}>{t('PLAY NEXT LEVEL', 'LARUIN ANG SUSUNOD NA LEVEL')} {completed+1} →</Text>
    </Pressable> : null}
    {phase === 'ready' && completed >= LIMIT ? <Text style={styles.notice}>
      {t('All offline practice levels completed.', 'Natapos ang lahat ng offline practice levels.')}
    </Text> : null}
    {phase === 'playing' || phase === 'saving' || phase === 'complete' ? <View style={styles.level}>
      {phase==='playing' && hasCompass ? <Pressable accessibilityRole="button"
        onPress={()=>setCompassActive(value=>!value)} style={styles.powerToggle}>
        <MaterialCommunityIcons name="compass-rose" size={20} color="#d1eebf"/>
        <Text style={styles.powerToggleText}>{compassActive?'HIDE COMPASS GUIDE':'USE EXPLORER COMPASS'}</Text>
      </Pressable>:null}
      <Text style={styles.levelTitle}>LEVEL {level} {phase === 'complete' ? `• ${score}/3` : ''}</Text>
      {items.map((item,i)=>{
        const eliminated = item.choices.map((_choice,index)=>index)
          .filter(index=>index!==item.answer_index).slice(0,2);
        return <View key={i} style={styles.question}>
        <Text style={styles.questionText}>{item.prompt}</Text>
        {phase==='playing' && hasWisdom && wisdomHintIndex===null ?
          <Pressable accessibilityRole="button" onPress={()=>setWisdomHintIndex(i)}
            style={styles.hintButton}><MaterialCommunityIcons name="lightbulb-on-outline"
              color="#ffe7ad" size={18}/><Text style={styles.hintText}>USE WISDOM LENS (ONE HINT)</Text>
          </Pressable>:null}
        {wisdomHintIndex===i ? <Text style={styles.hintText}>Wisdom Lens: {item.explanation}</Text>:null}
        {compassActive && hasCompass && phase==='playing' ?
          <Text style={styles.hintText}>Explorer Compass: rule out choices {eliminated.map(j=>String.fromCharCode(65+j)).join(' and ')}.</Text>:null}
        {item.choices.map((option,j)=><Pressable key={j} accessibilityRole="button"
          disabled={phase !== 'playing'||(compassActive&&hasCompass&&eliminated.includes(j))}
          accessibilityState={{ selected: answers[i] === j }}
          style={[styles.choice, answers[i]===j&&styles.selected,
            compassActive&&hasCompass&&eliminated.includes(j)&&styles.eliminated,
            phase==='complete'&&item.answer_index===j&&styles.correct]}
          onPress={()=>setAnswers(current=>current.map((value,index)=>index===i?j:value))}>
          <Text style={styles.choiceText}>{String.fromCharCode(65+j)}. {option}</Text>
        </Pressable>)}
        {phase==='complete'?<Text style={styles.notice}>{item.explanation}</Text>:null}
      </View>})}
      {phase==='playing' ? <Pressable accessibilityRole="button"
        disabled={!allAnswered} style={[styles.button,!allAnswered&&styles.disabled]}
        onPress={()=>{void save();}}><Text style={styles.buttonText}>SAVE PRACTICE RESULT</Text></Pressable>:null}
      {phase==='saving'?<Text style={styles.notice}>Saving locally…</Text>:null}
      {phase==='complete' && score===3 && level<LIMIT?<Pressable accessibilityRole="button"
        style={styles.button} onPress={()=>{setLevel(completed+1);setAnswers([-1,-1,-1]);setWisdomHintIndex(null);setCompassActive(false);setPhase('playing');}}>
        <Text style={styles.buttonText}>NEXT LEVEL {completed+1} →</Text>
      </Pressable>:null}
      {phase==='complete' && score<3 ? <Pressable accessibilityRole="button" style={styles.button}
        onPress={()=>{setAnswers([-1,-1,-1]);setNotice('');setPhase('playing');}}>
        <Text style={styles.buttonText}>RETRY THIS LEVEL</Text>
      </Pressable>:null}
    </View>:null}
    {!!notice?<Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
  box:{padding:13,gap:10,borderRadius:14,borderColor:'#c5ba89',borderWidth:1,
    backgroundColor:'#264f51'},
  aura:{borderColor:'#8affbd',borderWidth:2,backgroundColor:'#235b49'},
  powerShop:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#173c4b',
    borderWidth:1,borderColor:'#dabb84',padding:12,borderRadius:12,minHeight:62},
  powerTitle:{color:'#ffe3a7',fontWeight:'900',fontSize:12},
  powerHint:{color:'#d4ebe8',fontSize:11},
  powerCount:{color:'#fff0cd',fontWeight:'900',fontSize:20},
  powerToggle:{minHeight:44,padding:11,borderRadius:10,backgroundColor:'#183c48',
    borderWidth:1,borderColor:'#a0c68c',flexDirection:'row',alignItems:'center',gap:9},
  powerToggleText:{color:'#e9f7df',fontSize:12,fontWeight:'900'},
  hintButton:{flexDirection:'row',gap:8,alignItems:'center',padding:7},
  hintText:{color:'#ffe6b0',fontSize:12,lineHeight:19},
  eliminated:{opacity:.33},
  eyebrow:{fontSize:11,letterSpacing:1,color:'#ffe7aa',fontWeight:'900'},
  heading:{color:'#ffffff',fontWeight:'900',fontSize:18},
  help:{color:'#d6e7e0',fontSize:12,lineHeight:18},
  progress:{color:'#f7d58d',fontSize:13,fontWeight:'800'},
  notice:{color:'#e6e5d3',fontSize:12,lineHeight:19},
  level:{gap:12},
  levelTitle:{color:'#ffe1a3',fontSize:16,fontWeight:'900'},
  question:{backgroundColor:'#375d61',borderRadius:10,padding:10,gap:7},
  questionText:{color:'#fff',fontSize:14,fontWeight:'800',lineHeight:20},
  choice:{padding:11,borderRadius:8,backgroundColor:'#487274',borderWidth:1,
    borderColor:'#92a9a5'},
  selected:{borderWidth:2,borderColor:'#ffdfa4'},
  correct:{borderColor:'#a6efb6',backgroundColor:'#386b54'},
  choiceText:{color:'#fff',fontSize:14,lineHeight:20},
  button:{borderRadius:10,backgroundColor:'#ebce88',padding:13,alignItems:'center'},
  buttonText:{color:'#253b3d',fontSize:12,fontWeight:'900'},
  disabled:{opacity:.48},
});
