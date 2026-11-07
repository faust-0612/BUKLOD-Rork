import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import QUESTIONS from './BibleCrownQuestions.json';

type Phase = 'ready' | 'playing' | 'feedback' | 'won' | 'lost';
type Props = {
  onFinish?: (result: BuklodGameResult, sessionId: string) => void;
};
const GAME_ID = 'christian-bible-crown';
const LADDER = [100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 10000, 14000, 19000, 25000] as const;
const checkpointScore = (correctCount: number) =>
  correctCount >= 10 ? LADDER[9] : correctCount >= 5 ? LADDER[4] : 0;

export function BibleCrownGameV1({ onFinish }: Props) {
  const { language, t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [rejected, setRejected] = useState<number[]>([]);
  const [halfUsed, setHalfUsed] = useState(false);
  const [mentorUsed, setMentorUsed] = useState(false);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState('');
  const finishedRef = useRef(false);
  const inputGuard = useRef(false);
  const sessionRef = useRef('');

  const question = QUESTIONS[Math.min(index, QUESTIONS.length - 1)];
  const total = QUESTIONS.length;
  const completed = phase === 'won' || phase === 'lost';

  const begin = useCallback(() => {
    sessionRef.current = 'bc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 13);
    finishedRef.current = false;
    inputGuard.current = false;
    setPhase('playing');
    setIndex(0);
    setScore(0);
    setSelected(null);
    setHidden([]);
    setRejected([]);
    setHalfUsed(false);
    setMentorUsed(false);
    setSecondChanceUsed(false);
    setPaused(false);
    setMessage('');
    void playBuklodGameFeedback('move');
  }, []);

  const finish = useCallback((status: 'won' | 'lost', finalScore: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setScore(finalScore);
    setPhase(status);
    setPaused(false);
    const used = Number(halfUsed) + Number(mentorUsed) + Number(secondChanceUsed);
    const stars = status === 'won' ? (used === 0 ? 3 : used === 1 ? 2 : 1) : 0;
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
    onFinish?.({
      gameId: GAME_ID,
      status,
      score: finalScore,
      stars: stars as 0 | 1 | 2 | 3,
      // Preview game scores are NOT transferable Character or Economy points.
      reward: { xp: 0, kingdomXp: 0 },
    }, sessionRef.current);
  }, [halfUsed, mentorUsed, onFinish, secondChanceUsed]);

  const choose = useCallback((choice: number) => {
    if (phase !== 'playing' || paused || inputGuard.current ||
        hidden.includes(choice) || rejected.includes(choice)) return;
    inputGuard.current = true;
    if (choice === question.correct) {
      const next = LADDER[index];
      setScore(next);
      setSelected(choice);
      setMessage(t('Correct! Read the source before continuing.', 'Tama! Basahin ang sanggunian bago magpatuloy.'));
      setPhase('feedback');
      void playBuklodGameFeedback('collect');
      return;
    }
    void playBuklodGameFeedback('impact');
    if (!secondChanceUsed) {
      setSecondChanceUsed(true);
      setRejected((prev) => [...prev, choice]);
      setMessage(t('Second Chance used. Try a different answer.', 'Nagamit ang Second Chance. Pumili ng ibang sagot.'));
      inputGuard.current = false;
      return;
    }
    setSelected(choice);
    setMessage(t('The round ends at your last guaranteed milestone.', 'Natapos ang round sa huling garantisadong milestone.'));
    finish('lost', checkpointScore(index));
  }, [finish, hidden, index, paused, phase, question.correct, rejected, secondChanceUsed, t]);

  const advance = useCallback(() => {
    if (phase !== 'feedback') return;
    if (index + 1 === total) {
      finish('won', LADDER[LADDER.length - 1]);
      return;
    }
    inputGuard.current = false;
    setIndex((i) => i + 1);
    setSelected(null);
    setHidden([]);
    setRejected([]);
    setMessage('');
    setPhase('playing');
    void playBuklodGameFeedback('move');
  }, [finish, index, phase, total]);

  const useHalf = useCallback(() => {
    if (phase !== 'playing' || paused || halfUsed) return;
    const wrong = [0, 1, 2, 3].filter((i) => i !== question.correct && !rejected.includes(i));
    setHidden(wrong.slice(0, 2));
    setHalfUsed(true);
    void playBuklodGameFeedback('move');
  }, [halfUsed, paused, phase, question.correct, rejected]);

  const useMentor = useCallback(() => {
    if (phase !== 'playing' || paused || mentorUsed) return;
    setMentorUsed(true);
    void playBuklodGameFeedback('move');
  }, [mentorUsed, paused, phase]);

  return (
    <View style={s.shell}>
      <View style={s.top}>
        <View>
          <Text style={s.eyebrow}>CHRISTIAN • BIBLE ACADEMY</Text>
          <Text style={s.title}>BIBLE CROWN</Text>
        </View>
        <View style={s.scoreBox}>
          <Text style={s.score}>{score.toLocaleString()}</Text>
          <Text style={s.scoreCaption}>{t('GAME SCORE', 'GAME SCORE')}</Text>
        </View>
      </View>
      <Text style={s.subtitle}>{t('15 Bible challenges • verified references • three one-use aids', '15 hamon sa Biblia • may sanggunian • tatlong tulong na minsan lang magagamit')}</Text>
      {phase === 'ready' ? (
        <View style={s.intro}>
          <Text style={s.introTitle}>{t('Climb the Bible Crown ladder', 'Umakyat sa Bible Crown ladder')}</Text>
          <Text style={s.copy}>{t('Each correct answer advances you. Wrong answers use your one Second Chance first; a later wrong answer ends the round. Questions 5 and 10 secure milestone scores. All scores are for this game only.', 'Bawat tamang sagot ay umaangat sa ladder. Sa unang mali, awtomatikong gagamitin ang Second Chance; sa susunod na mali, matatapos ang round. May garantisadong score sa ika-5 at ika-10 tanong. Para sa larong ito lamang ang score.')}</Text>
          <Pressable style={s.primary} onPress={begin}><Text style={s.primaryText}>{t('START GAME', 'SIMULAN')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.progressHeader}>
            <Text style={s.progressText}>{t('QUESTION', 'TANONG')} {Math.min(index + 1, total)} / {total}</Text>
            {!completed && <Pressable onPress={() => setPaused((v) => !v)} style={s.miniButton}><Text style={s.miniText}>{paused ? t('RESUME', 'ITULOY') : t('PAUSE', 'IHINTO')}</Text></Pressable>}
          </View>
          <View style={s.progress}>
            {QUESTIONS.map((q, i) => <View key={q.id} style={[s.step, i < index && s.stepComplete, i === index && s.stepCurrent]} />)}
          </View>
          {paused ? (
            <View style={s.intro}>
              <Text style={s.introTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
              <Text style={s.copy}>{t('Your current question is preserved while this game stays open.', 'Napanatili ang tanong habang bukas ang laro.')}</Text>
              <Pressable style={s.primary} onPress={() => setPaused(false)}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
            </View>
          ) : completed ? (
            <View style={s.intro}>
              <Text style={s.introTitle}>{phase === 'won' ? t('BIBLE CROWN COMPLETE', 'TAPOS ANG BIBLE CROWN') : t('ROUND COMPLETE', 'TAPOS ANG ROUND')}</Text>
              <Text style={s.bigScore}>{score.toLocaleString()}</Text>
              <Text style={s.copy}>{phase === 'won' ? t('All fifteen questions cleared. Your local game result is ready.', 'Nasagutan nang tama ang lahat ng 15 tanong. Handa na ang local game result.') : t('You may try again. A wrong answer never deducts BUKLOD Character Points.', 'Maaari kang sumubok ulit. Walang bawas sa BUKLOD Character Points kapag mali.')}</Text>
              <Pressable onPress={begin} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
            </View>
          ) : (
            <View style={s.questionPanel}>
              <Text style={s.reference}>{t('STAGE', 'YUGTO')} {Math.min(5, Math.ceil((index + 1) / 3))} / 5</Text>
              <Text style={s.prompt}>{question.prompt[language]}</Text>
              <View style={s.choices}>
                {question.choices[language].map((label, i) => (
                  <Pressable
                    key={i}
                    disabled={phase !== 'playing' || hidden.includes(i) || rejected.includes(i)}
                    accessibilityRole="button"
                    accessibilityLabel={String.fromCharCode(65 + i) + '. ' + label}
                    onPress={() => choose(i)}
                    style={[
                      s.choice,
                      (hidden.includes(i) || rejected.includes(i)) && s.choiceDisabled,
                      selected === i && (i === question.correct ? s.choiceCorrect : s.choiceWrong),
                    ]}
                  >
                    <Text style={s.choiceText}>{String.fromCharCode(65 + i)}. {hidden.includes(i) ? '—' : label}</Text>
                  </Pressable>
                ))}
              </View>
              {phase === 'playing' ? (
                <View style={s.aids}>
                  <Pressable disabled={halfUsed} onPress={useHalf} style={[s.aid, halfUsed && s.aidUsed]}><Text style={s.aidText}>50/50 {halfUsed ? '✓' : ''}</Text></Pressable>
                  <Pressable disabled={mentorUsed} onPress={useMentor} style={[s.aid, mentorUsed && s.aidUsed]}><Text style={s.aidText}>{t('ASK MENTOR', 'TANONG SA GABAY')} {mentorUsed ? '✓' : ''}</Text></Pressable>
                  <View style={[s.aid, secondChanceUsed && s.aidUsed]}><Text style={s.aidText}>{t('SECOND CHANCE', 'IKALAWANG TSANSA')} {secondChanceUsed ? '✓' : '●'}</Text></View>
                </View>
              ) : null}
              {mentorUsed && <Text style={s.hint}>💡 {question.mentor[language]}</Text>}
              {!!message && <Text style={s.message}>{message}</Text>}
              {phase === 'feedback' && (
                <View style={s.explanation}>
                  <Text style={s.explanationText}>{question.explanation[language]}</Text>
                  <Text style={s.reference}>{question.reference}</Text>
                  <Pressable style={s.primary} onPress={advance}><Text style={s.primaryText}>{index + 1 === total ? t('FINISH GAME', 'TAPUSIN') : t('NEXT QUESTION', 'SUSUNOD')}</Text></Pressable>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 20, gap: 13 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  eyebrow: { color: '#f5d898', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#fff2cd', fontSize: 29, fontWeight: '900', marginTop: 4 },
  scoreBox: { alignItems: 'flex-end' },
  score: { color: '#f9d987', fontSize: 24, fontWeight: '900' },
  scoreCaption: { color: '#adbacf', fontWeight: '800', fontSize: 9, marginTop: 2 },
  subtitle: { color: '#c4d2e9', fontSize: 12, lineHeight: 18 },
  intro: { borderRadius: 20, padding: 20, gap: 14, backgroundColor: 'rgba(8,25,53,.91)', borderWidth: 1, borderColor: '#536581' },
  introTitle: { color: '#fff6df', fontSize: 22, fontWeight: '900' },
  copy: { color: '#d1dff3', fontSize: 14, lineHeight: 22 },
  primary: { backgroundColor: '#e9c573', borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 5 },
  primaryText: { color: '#162038', fontWeight: '900', letterSpacing: .5, fontSize: 13 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { color: '#dce6fc', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  progress: { flexDirection: 'row', gap: 3 },
  step: { flex: 1, height: 6, borderRadius: 4, backgroundColor: '#3d4d68' },
  stepComplete: { backgroundColor: '#c6a256' },
  stepCurrent: { backgroundColor: '#fff3cb' },
  miniButton: { paddingHorizontal: 12, paddingVertical: 7, borderColor: '#687b9a', borderWidth: 1, borderRadius: 9 },
  miniText: { fontSize: 10, fontWeight: '900', color: '#e4eeff' },
  questionPanel: { borderRadius: 20, padding: 16, gap: 15, backgroundColor: 'rgba(8,25,53,.91)', borderWidth: 1, borderColor: '#536581' },
  reference: { color: '#e7cb83', fontSize: 11, fontWeight: '900', letterSpacing: .5 },
  prompt: { color: '#fff', fontSize: 21, fontWeight: '900', lineHeight: 30, textAlign: 'center', paddingVertical: 7 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  choice: { width: '47%', minWidth: 140, flexGrow: 1, minHeight: 62, borderWidth: 1, borderColor: '#687b9a', borderRadius: 13, backgroundColor: '#243957', padding: 13, justifyContent: 'center' },
  choiceDisabled: { opacity: .27 },
  choiceCorrect: { backgroundColor: '#23634f', borderColor: '#82dfb0' },
  choiceWrong: { backgroundColor: '#7c313d', borderColor: '#eb8393' },
  choiceText: { color: '#fff', fontWeight: '800', fontSize: 13, lineHeight: 19 },
  aids: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  aid: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 999, backgroundColor: '#344c6d', borderWidth: 1, borderColor: '#7891b4' },
  aidUsed: { opacity: .36 },
  aidText: { color: '#eaf1fe', fontSize: 10, fontWeight: '900' },
  hint: { color: '#f7e3af', lineHeight: 20, fontSize: 13 },
  message: { color: '#d2e2fd', fontWeight: '800', fontSize: 13, lineHeight: 19 },
  explanation: { padding: 14, backgroundColor: '#20324d', borderRadius: 12, gap: 9 },
  explanationText: { color: '#e0eafe', fontSize: 13, lineHeight: 21 },
  bigScore: { fontSize: 46, color: '#f3d187', fontWeight: '900' },
});
