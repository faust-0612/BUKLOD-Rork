import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { buildKingdomOfflineLevel } from './kingdomOfflineGenerator.mjs';

const LIMIT = 200;

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
  const mounted = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    setPhase('loading'); setCompleted(0); setLevel(1); setAnswers([-1,-1,-1]); setNotice('');
    if (!key) { setPhase('ready'); return () => { mounted.current = false; }; }
    void AsyncStorage.getItem(key).then(value => {
      if (!mounted.current) return;
      const progress = Number(value ?? '0');
      const saved = Number.isInteger(progress) ? Math.max(0, Math.min(LIMIT, progress)) : 0;
      setCompleted(saved); setLevel(Math.min(LIMIT,saved+1)); setPhase('ready');
    }).catch(() => {
      if (mounted.current) { setPhase('ready'); setNotice(t(
        'Local progress could not be restored; offline practice is still available.',
        'Hindi na-load ang local progress; maaari pa ring mag-practice.')); }
    });
    return () => { mounted.current = false; };
  // Language switches should not reset an active offline level or its answers.
  }, [key]);

  const items = useMemo(() => userId ? buildKingdomOfflineLevel(gameId, level, userId) : [],
    [gameId, level, userId]);
  const allAnswered = answers.every(index => index >= 0);
  const score = items.reduce((count,item,index) =>
    count + (item.answer_index === answers[index] ? 1 : 0),0);

  const save = async () => {
    if (busy.current || phase !== 'playing' || !allAnswered || !key) return;
    busy.current = true; setPhase('saving'); setNotice('');
    try {
      const saved = Math.max(completed,level);
      await AsyncStorage.setItem(key,String(saved));
      if (!mounted.current) return;
      setCompleted(saved);
      setPhase('complete');
      void playBuklodGameFeedback(score === 3 ? 'success' : 'collect');
    } catch {
      if (mounted.current) { setPhase('playing'); setNotice(t(
        'Could not save this offline level. Try again; nothing was lost.',
        'Hindi ma-save ang level. Subukan muli; walang nawalang sagot.')); }
    } finally { busy.current = false; }
  };

  if (!userId) return null;
  return <View style={styles.box}>
    <Text style={styles.eyebrow}>KINGDOM • OFFLINE AUTO-BUILT ADVENTURE</Text>
    <Text style={styles.heading}>{t('Next levels — even without internet',
      'May susunod na levels kahit walang internet')}</Text>
    <Text style={styles.help}>{t(
      'Procedurally built, account-isolated practice levels with fresh numbers and scenarios. No AI charges, BP, character XP or cash rewards.',
      'Automatically nabubuong practice levels, hiwalay bawat account. Walang AI charges, BP, character XP o cash rewards.'
    )}</Text>
    <Text style={styles.progress}>{t('Completed', 'Natapos')}: {completed}/{LIMIT}</Text>
    {phase === 'loading' ? <Text style={styles.notice}>Loading local practice…</Text> : null}
    {phase === 'ready' && completed < LIMIT ? <Pressable accessibilityRole="button" style={styles.button}
      onPress={() => { setLevel(completed+1); setAnswers([-1,-1,-1]); setPhase('playing'); setNotice(''); }}>
      <Text style={styles.buttonText}>{t('PLAY NEXT LEVEL', 'LARUIN ANG SUSUNOD NA LEVEL')} {completed+1} →</Text>
    </Pressable> : null}
    {phase === 'ready' && completed >= LIMIT ? <Text style={styles.notice}>
      {t('All offline practice levels completed.', 'Natapos ang lahat ng offline practice levels.')}
    </Text> : null}
    {phase === 'playing' || phase === 'saving' || phase === 'complete' ? <View style={styles.level}>
      <Text style={styles.levelTitle}>LEVEL {level} {phase === 'complete' ? `• ${score}/3` : ''}</Text>
      {items.map((item,i)=><View key={i} style={styles.question}>
        <Text style={styles.questionText}>{item.prompt}</Text>
        {item.choices.map((option,j)=><Pressable key={j} accessibilityRole="button"
          disabled={phase !== 'playing'}
          accessibilityState={{ selected: answers[i] === j }}
          style={[styles.choice, answers[i]===j&&styles.selected,
            phase==='complete'&&item.answer_index===j&&styles.correct]}
          onPress={()=>setAnswers(current=>current.map((value,index)=>index===i?j:value))}>
          <Text style={styles.choiceText}>{String.fromCharCode(65+j)}. {option}</Text>
        </Pressable>)}
        {phase==='complete'?<Text style={styles.notice}>{item.explanation}</Text>:null}
      </View>)}
      {phase==='playing' ? <Pressable accessibilityRole="button"
        disabled={!allAnswered} style={[styles.button,!allAnswered&&styles.disabled]}
        onPress={()=>{void save();}}><Text style={styles.buttonText}>SAVE PRACTICE RESULT</Text></Pressable>:null}
      {phase==='saving'?<Text style={styles.notice}>Saving locally…</Text>:null}
      {phase==='complete' && level<LIMIT?<Pressable accessibilityRole="button"
        style={styles.button} onPress={()=>{setLevel(completed+1);setAnswers([-1,-1,-1]);setPhase('playing');}}>
        <Text style={styles.buttonText}>NEXT LEVEL {completed+1} →</Text>
      </Pressable>:null}
    </View>:null}
    {!!notice?<Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
  box:{padding:13,gap:10,borderRadius:14,borderColor:'#c5ba89',borderWidth:1,
    backgroundColor:'#264f51'},
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
