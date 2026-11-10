import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { KingdomPracticeRewardedHint } from './KingdomPracticeRewardedHint';

type Question = {
  prompt: string; choices: string[]; answer_index: number; explanation: string;
};
type Response = {
  level?: number; questions?: Question[]; practice_only?: boolean;
  bp_awarded?: number; error?: string; retry_after_seconds?: number;
  session_id?: string; completed?: boolean; score?: number;
};
type Phase = 'ready' | 'loading' | 'playing' | 'complete';
const safeQuestions = (value: unknown): value is Question[] =>
  Array.isArray(value) && value.length === 3 &&
  value.every(q => typeof q?.prompt === 'string' && q.prompt.length >= 35 &&
    Array.isArray(q?.choices) && q.choices.length === 4 &&
    q.choices.every((v: unknown) => typeof v === 'string') &&
    Number.isInteger(q.answer_index) && q.answer_index >= 0 && q.answer_index <= 3 &&
    typeof q.explanation === 'string');

/**
 * AI-generated optional practice is not an authoritative game-clear or BP
 * event. The Edge Function authenticates the account, de-duplicates prompts,
 * rate-limits provider spend and supplies the next level only after prior
 * level completion. No ad or credit is granted by question generation.
 */
export function KingdomAIContinuation({ gameId }: { gameId: string }) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [resumeAfter, setResumeAfter] = useState(0);
  const [progressBusy, setProgressBusy] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([-1, -1, -1]);
  const [notice, setNotice] = useState('');
  const [hintRevealed, setHintRevealed] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    setProgressBusy(true);
    setPhase('ready');
    setResumeAfter(0);
    setSessionId('');
    void Promise.resolve(supabase.rpc('get_my_buklod_kingdom_ai_progress_v1',
      { p_game_id: gameId }))
      .then(({ data, error }) => {
        if (!mounted.current) return;
        if (!error && data && typeof data === 'object') {
          const saved = data as { completed_level?: number; unfinished_level?: number | null };
          const completed = Number(saved.completed_level ?? 0);
          const unfinished = saved.unfinished_level;
          const previous = unfinished && Number.isInteger(unfinished)
            ? Math.max(0, unfinished - 1) : completed;
          if (Number.isInteger(previous)) setResumeAfter(Math.max(0, Math.min(200, previous)));
        }
      }).catch(() => {
        // Offline/missing feature migration must not block verified Kingdom games.
      }).finally(() => { if (mounted.current) setProgressBusy(false); });
    return () => { mounted.current = false; };
  }, [gameId]);
  async function loadNext(afterLevel: number) {
    if (busy.current || !Number.isInteger(afterLevel) || afterLevel < 0 ||
      afterLevel >= 200) return;
    busy.current = true;
    setPhase('loading');
    setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke<Response>(
        'buklod-kingdom-ai-continuation-v1',
        { body: { gameId, afterLevel } },
      );
      if (error) throw error;
      if (!mounted.current) return;
      if (!safeQuestions(data?.questions) || data?.practice_only !== true ||
          data.bp_awarded !== 0 || typeof data.session_id !== 'string' ||
          !/^[a-f0-9-]{36}$/i.test(data.session_id) ||
          typeof data.level !== 'number' || !Number.isInteger(data.level) ||
          Number(data.level) !== afterLevel + 1) {
        throw new Error('Invalid AI practice level.');
      }
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setFinalScore(null);
      setLevel(Number(data.level));
      setAnswers([-1, -1, -1]);
      setHintRevealed(false);
      if (data.completed === true) {
        setFinalScore(Number.isInteger(data.score) ? Number(data.score) : null);
        setPhase('complete');
      } else {
        setPhase('playing');
      }
    } catch {
      if (!mounted.current) return;
      setPhase(afterLevel === 0 ? 'ready' : 'complete');
      setNotice(t('AI continuation is unavailable or its daily allowance was reached. Existing games and BP mastery still work.',
        'Hindi pa available ang AI continuation o naabot na ang daily limit. Gumagana pa rin ang normal na laro at BP mastery.'));
    } finally { busy.current = false; }
  }
  async function finishPractice() {
    if (busy.current || !sessionId || !answers.every(index => index >= 0 && index <= 3)) return;
    busy.current = true;
    setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke<Response>(
        'buklod-kingdom-ai-continuation-v1',
        { body: { action: 'finish', sessionId, answers } },
      );
      if (error || data?.completed !== true || data.practice_only !== true ||
          data.bp_awarded !== 0 || !Number.isInteger(data.score) ||
          data.level !== level) throw new Error('AI practice was not saved.');
      if (!mounted.current) return;
      setFinalScore(Number(data.score));
      setPhase('complete');
      setResumeAfter(level);
      void playBuklodGameFeedback(data.score === 3 ? 'success' : 'collect');
    } catch {
      if (mounted.current) setNotice(t(
        'Could not save the completed practice. Check the connection and retry. No BP is affected.',
        'Hindi ma-save ang practice. Suriin ang koneksyon at ulitin. Walang BP na maaapektuhan.'));
    } finally { busy.current = false; }
  }
  const allAnswered = answers.length === 3 && answers.every(index => index >= 0);
  const score = finalScore ?? questions.reduce(
    (sum, q, i) => sum + (answers[i] === q.answer_index ? 1 : 0), 0);
  return (
    <View style={styles.shell}>
      <Text style={styles.eyebrow}>KINGDOM • AI PRACTICE QUEST</Text>
      <Text style={styles.heading}>{t('Continue to new challenges', 'Magpatuloy sa bagong challenges')}</Text>
      <Text style={styles.summary}>{t(
        'Optional new practice levels with non-repeating questions. This is not a verified mastery check, and awards no BP, cash or character XP. Daily generation limits protect costs.',
        'Optional practice levels na may bagong mga tanong. Hindi ito verified mastery check at walang BP, pera, o character XP. May daily generation limit para kontrolado ang gastos.'
      )}</Text>
      {phase === 'ready' ? (
        <Pressable accessibilityRole="button" disabled={progressBusy || resumeAfter >= 200}
          style={[styles.primary, (progressBusy || resumeAfter >= 200) && styles.disabled]}
          onPress={() => void loadNext(resumeAfter)}>
          <Text style={styles.primaryText}>{progressBusy ? t('CHECKING PROGRESS…', 'KINUKUHA ANG PROGRESS…')
            : resumeAfter >= 200 ? t('ALL PRACTICE LEVELS COMPLETED', 'TAPOS NA ANG LAHAT NG PRACTICE')
            : resumeAfter > 0 ? t('RESUME AI PRACTICE', 'ITULOY ANG AI PRACTICE')
            : t('START AI PRACTICE LEVEL 1', 'SIMULAN ANG AI PRACTICE LEVEL 1')}</Text>
        </Pressable>
      ) : null}
      {phase === 'loading' ? <Text accessibilityRole="alert" style={styles.note}>
        {t('Preparing a fresh level...', 'Inihahanda ang bagong level...')}
      </Text> : null}
      {phase === 'playing' || phase === 'complete' ? (
        <View style={styles.level}>
          <Text style={styles.levelTitle}>{t('Practice level', 'Practice level')} {level} • {score}/{questions.length} {phase === 'complete' ? t('correct', 'tama') : ''}</Text>
          {questions.map((q, i) => (
            <View key={i} style={styles.question}>
              <Text style={styles.questionTitle}>{i + 1}. {q.prompt}</Text>
              {q.choices.map((choice, index) => (
                <Pressable key={index} accessibilityRole="button"
                  disabled={phase === 'complete'}
                  accessibilityState={{ selected: answers[i] === index }}
                  style={[styles.choice, answers[i] === index && styles.selected,
                    phase === 'complete' && index === q.answer_index && styles.correct]}
                  onPress={() => {
                    setAnswers(current => current.map((old, at) => at === i ? index : old));
                    void playBuklodGameFeedback('move');
                  }}>
                  <Text style={styles.choiceText}>{String.fromCharCode(65 + index)}. {choice}</Text>
                </Pressable>
              ))}
              {phase === 'complete' ? <Text style={styles.explanation}>
                {answers[i] === q.answer_index ? '✓ ' : '• '}{q.explanation}
              </Text> : null}
            </View>
          ))}
          {phase === 'playing' && !hintRevealed ? (
            <KingdomPracticeRewardedHint onHintEarned={() => setHintRevealed(true)} />
          ) : null}
          {phase === 'playing' && hintRevealed ? (
            <Text style={styles.explanation}>
              {t('Practice hint (no BP):', 'Practice hint (walang BP):')}{' '}
              {questions[0]?.choices[questions[0]?.answer_index]}
            </Text>
          ) : null}
          {phase === 'playing' ? <Pressable accessibilityRole="button"
            disabled={!allAnswered} style={[styles.primary, !allAnswered && styles.disabled]}
            onPress={() => { void finishPractice(); }}>
            <Text style={styles.primaryText}>{t('FINISH PRACTICE', 'TAPUSIN ANG PRACTICE')}</Text>
          </Pressable> : null}
          {phase === 'complete' && level < 200 ? <Pressable accessibilityRole="button" style={styles.primary}
            onPress={() => void loadNext(level)}>
            <Text style={styles.primaryText}>{t('NEXT AI PRACTICE LEVEL', 'SUSUNOD NA AI PRACTICE LEVEL')} →</Text>
          </Pressable> : null}
        </View>
      ) : null}
      {!!notice ? <Text accessibilityRole="alert" style={styles.note}>{notice}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { backgroundColor:'#1b3544',borderWidth:1,borderColor:'#9eaf9e',
    borderRadius:16,padding:14,gap:11 },
  eyebrow: { color:'#d0ddb2',fontSize:11,letterSpacing:1,fontWeight:'900' },
  heading: { color:'#fff2ce',fontSize:21,fontWeight:'900' },
  summary: { color:'#e3eaf0',fontSize:13,lineHeight:20 },
  level: { gap:12 },
  levelTitle: { fontSize:16,color:'#f9dc93',fontWeight:'900' },
  question: { padding:12,borderRadius:12,backgroundColor:'#274457',gap:8 },
  questionTitle: { color:'#fff2dc',fontSize:15,lineHeight:21,fontWeight:'800' },
  choice: { padding:12,borderRadius:9,borderWidth:1,borderColor:'#768fa2',backgroundColor:'#37576a' },
  selected: { borderColor:'#f8d894',borderWidth:2,backgroundColor:'#476c74' },
  correct: { borderColor:'#9fe3ae',backgroundColor:'#315d52' },
  choiceText: { color:'#fff',fontSize:14,lineHeight:20 },
  explanation: { color:'#d2ead3',fontSize:13,lineHeight:20 },
  primary: { backgroundColor:'#efcf88',padding:13,borderRadius:11,alignItems:'center' },
  primaryText: { fontSize:12,fontWeight:'900',color:'#25394a' },
  disabled: { opacity:.4 },
  note: { color:'#e8d9a5',fontSize:13,lineHeight:20 },
});
