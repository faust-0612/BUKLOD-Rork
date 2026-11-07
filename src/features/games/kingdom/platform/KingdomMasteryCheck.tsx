import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';

type Question = { id: string; prompt: string; choices: string[] };
type StartData = {
  challenge_id?: string; questions?: Question[]; already_earned?: boolean;
  reward_points?: number; expires_at?: string;
};
type FinishData = {
  verified?: boolean; already_processed?: boolean; correct?: number;
  points_awarded?: number; retry_allowed?: boolean; expired?: boolean;
};
type Phase = 'ready' | 'loading' | 'answering' | 'submitting' | 'complete';

/**
 * Server-scored, optional mastery check after a LOCAL game win.
 * The actual 39 game outcomes stay local; no score or client "won" bit
 * is ever accepted as a reward credential. The server owns the questions,
 * answer mapping, uniqueness, expiry, and the real Points ledger credit.
 */
export function KingdomMasteryCheck({ gameId }: { gameId: string }) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [challengeId, setChallengeId] = useState('');
  const [answers, setAnswers] = useState<number[]>([]);
  const [notice, setNotice] = useState('');
  const [hasCredit, setHasCredit] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function start() {
    if (busy.current || hasCredit) return;
    busy.current = true;
    setPhase('loading');
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('start_my_buklod_kingdom_mastery_v1', {
        p_game_id: gameId,
      });
      if (error) throw error;
      if (!mounted.current) return;
      const result = data as StartData | null;
      if (result?.already_earned) {
        setHasCredit(true);
        setPhase('complete');
        setNotice(t('Already earned for this game. Claim your available Points on the Points screen.',
          'Nakuha mo na ang mastery para rito. I-claim ang available Points sa Points screen.'));
        return;
      }
      if (!result?.challenge_id || !Array.isArray(result.questions) ||
          result.questions.length !== 3 ||
          !result.questions.every(q => q && typeof q.prompt === 'string' &&
            Array.isArray(q.choices) && q.choices.length === 4 &&
            q.choices.every(choice => typeof choice === 'string'))) {
        throw new Error('Mastery challenge could not be loaded.');
      }
      setChallengeId(result.challenge_id);
      setQuestions(result.questions);
      setAnswers([-1, -1, -1]);
      setPhase('answering');
    } catch (error) {
      if (!mounted.current) return;
      setPhase('ready');
      setNotice(error instanceof Error ? error.message : 'Mastery check unavailable.');
    } finally {
      busy.current = false;
    }
  }

  async function submit() {
    if (busy.current || phase !== 'answering' || !challengeId ||
        answers.length !== 3 || answers.some(choice => !Number.isInteger(choice) || choice < 0 || choice > 3)) {
      return;
    }
    busy.current = true;
    setPhase('submitting');
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('finish_my_buklod_kingdom_mastery_v1', {
        p_challenge_id: challengeId, p_answers: answers,
      });
      if (error) throw error;
      if (!mounted.current) return;
      const result = data as FinishData | null;
      if (result?.verified) {
        setHasCredit(true);
        setPhase('complete');
        setNotice((result.points_awarded ?? 0) > 0
          ? t('Verified! +2 real BUKLOD Points are available to claim.',
              'Verified! May +2 totoong BUKLOD Points na maaari nang i-claim.')
          : t('Mastery was already processed. No duplicate Points were created.',
              'Naitala na ang mastery. Walang nadobleng Points.'));
      } else {
        setPhase('ready');
        setNotice(result?.expired
          ? t('Challenge expired. Start another within the daily attempt limit.',
              'Nag-expire ang challenge. Puwedeng muling sumubok ayon sa daily limit.')
          : t('Not yet verified. All three answers must be correct. Try again.',
              'Hindi pa verified. Dapat tama ang tatlong sagot. Subukan muli.'));
      }
    } catch (error) {
      if (!mounted.current) return;
      setPhase('answering');
      setNotice(error instanceof Error ? error.message : 'Unable to submit the mastery check.');
    } finally {
      busy.current = false;
    }
  }

  return <View style={styles.shell}>
    <Text style={styles.heading}>{t('Earn verified BUKLOD Points', 'Kumita ng verified BUKLOD Points')}</Text>
    <Text style={styles.description}>{t(
      'Your game win is saved locally. To earn 2 real BUKLOD Points for this game (once per account), finish an optional 3-question, server-verified Mastery Check. This check verifies your answers—not your local game score. Three attempts per day.',
      'Ang panalo sa laro ay local na naka-save. Para sa 2 totoong BUKLOD Points (isang beses bawat account at laro), kumpletuhin ang optional na 3-question server-verified Mastery Check. Mga sagot ang vine-verify, hindi ang local score. Tatlong subok bawat araw.'
    )}</Text>
    {phase === 'ready' ? <Pressable accessibilityRole="button" style={styles.primary} onPress={() => void start()}>
      <Text style={styles.primaryText}>{t('BEGIN MASTERY CHECK', 'SIMULAN ANG MASTERY CHECK')}</Text>
    </Pressable> : null}
    {phase === 'loading' || phase === 'submitting' ?
      <Text style={styles.note}>{t('Verifying securely...', 'Ligtas na bine-verify...')}</Text> : null}
    {phase === 'answering' ? <View style={styles.questions}>{questions.map((q, index) =>
      <View key={q.id} style={styles.question}>
        <Text style={styles.questionTitle}>{index + 1}. {q.prompt}</Text>
        {q.choices.map((choice, value) =>
          <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: answers[index] === value }}
            style={[styles.choice, answers[index] === value && styles.choiceSelected]}
            onPress={() => setAnswers(current => current.map((old, i) => i === index ? value : old))}>
            <Text style={styles.choiceText}>{String.fromCharCode(65 + value)}. {choice}</Text>
          </Pressable>)}
      </View>)}
      <Pressable accessibilityRole="button" style={[styles.primary,
        answers.some(a => a < 0) && styles.disabled]} disabled={answers.some(a => a < 0)}
        onPress={() => void submit()}>
        <Text style={styles.primaryText}>{t('VERIFY 3 ANSWERS', 'I-VERIFY ANG 3 SAGOT')}</Text>
      </Pressable>
    </View> : null}
    {phase === 'complete' ? <Pressable accessibilityRole="button" style={styles.primary}
      onPress={() => router.push('/points' as any)}>
      <Text style={styles.primaryText}>{t('OPEN BUKLOD POINTS TO CLAIM', 'PUNTA SA BUKLOD POINTS PARA MAG-CLAIM')}</Text>
    </Pressable> : null}
    {!!notice ? <Text accessibilityRole="alert" style={styles.note}>{notice}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderColor: '#deb975', backgroundColor: '#273f53',
    borderRadius: 16, padding: 14, gap: 11 },
  heading: { color: '#ffebbd', fontSize: 17, fontWeight: '900' },
  description: { color: '#d7e4f2', fontSize: 12, lineHeight: 20 },
  questions: { gap: 12 },
  question: { backgroundColor: '#314d67', borderRadius: 10, padding: 11, gap: 7 },
  questionTitle: { color: '#fff3d3', fontSize: 13, fontWeight: '800' },
  choice: { padding: 10, borderRadius: 8, backgroundColor: '#415b73',
    borderWidth: 1, borderColor: '#738aa0' },
  choiceSelected: { backgroundColor: '#556d55', borderColor: '#e4c47d', borderWidth: 2 },
  choiceText: { color: '#f6f4ed', fontSize: 12 },
  primary: { alignItems: 'center', backgroundColor: '#f1d498', borderRadius: 9, padding: 12 },
  disabled: { opacity: 0.4 },
  primaryText: { color: '#263d56', fontSize: 11, fontWeight: '900' },
  note: { color: '#f8e7ae', fontSize: 12, lineHeight: 18 },
});
