import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

type Mode = 'bible' | 'logic' | 'guess';
type Challenge = {
  prompt: string;
  answers: readonly [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explain: string;
  reference?: string;
};
type Props = { mode: Mode; onFinish?: (result: BuklodGameResult) => void };
const QUESTIONS: Record<Mode, readonly Challenge[]> = {
  bible: [
    { prompt: 'Who built the ark before the great flood?', answers: ['Moses', 'Noah', 'Joseph', 'David'], correct: 1, explain: 'Noah obeyed God and built the ark.', reference: 'Genesis 6:13–22' },
    { prompt: 'Who led the Israelites through the Red Sea?', answers: ['Moses', 'Joshua', 'Elijah', 'Solomon'], correct: 0, explain: 'God made a path through the sea as Moses led the people.', reference: 'Exodus 14:21–22' },
    { prompt: 'Who defeated Goliath with a sling and a stone?', answers: ['Saul', 'Samuel', 'David', 'Jonathan'], correct: 2, explain: 'David trusted God in the battle against Goliath.', reference: '1 Samuel 17:49–50' },
    { prompt: 'Where was Jesus born?', answers: ['Nazareth', 'Jerusalem', 'Jericho', 'Bethlehem'], correct: 3, explain: 'The birth of Jesus happened in Bethlehem.', reference: 'Luke 2:4–7' },
    { prompt: 'Who was swallowed by a great fish?', answers: ['Jonah', 'Peter', 'Paul', 'Isaiah'], correct: 0, explain: 'Jonah prayed to God from inside the great fish.', reference: 'Jonah 1:17–2:1' },
    { prompt: 'Which disciple walked on the water toward Jesus?', answers: ['John', 'Thomas', 'Peter', 'James'], correct: 2, explain: 'Peter stepped out of the boat at Jesus’s invitation.', reference: 'Matthew 14:28–31' },
    { prompt: 'What is the first book of the Bible?', answers: ['Exodus', 'Genesis', 'Psalms', 'Matthew'], correct: 1, explain: 'Genesis opens with the account of creation.', reference: 'Genesis 1:1' },
    { prompt: 'Who interpreted Pharaoh’s dreams in Egypt?', answers: ['Aaron', 'Daniel', 'Samuel', 'Joseph'], correct: 3, explain: 'Joseph explained that the dreams warned about years of plenty and famine.', reference: 'Genesis 41:25–32' },
    { prompt: 'What did the good Samaritan do for the injured traveler?', answers: ['Ignored him', 'Helped and cared for him', 'Sent him away', 'Only watched'], correct: 1, explain: 'The Samaritan showed mercy through practical care.', reference: 'Luke 10:33–35' },
    { prompt: 'Who was with Paul in prison when they sang hymns?', answers: ['Silas', 'Peter', 'Barnabas', 'Timothy'], correct: 0, explain: 'Paul and Silas prayed and sang to God in prison.', reference: 'Acts 16:25' },
  ],
  logic: [
    { prompt: '2, 4, 8, 16, ?', answers: ['18', '24', '32', '30'], correct: 2, explain: 'Each number doubles.' },
    { prompt: '1, 1, 2, 3, 5, ?', answers: ['6', '8', '9', '10'], correct: 1, explain: 'Each number adds the two before it.' },
    { prompt: 'A, C, F, J, ?', answers: ['L', 'M', 'N', 'O'], correct: 3, explain: 'The letter jumps increase by one: +2, +3, +4, +5.' },
    { prompt: 'Which does not belong: triangle, square, circle, rectangle?', answers: ['Triangle', 'Square', 'Circle', 'Rectangle'], correct: 2, explain: 'A circle has no straight sides.' },
    { prompt: 'You have 3 groups with 4 blocks each. How many blocks?', answers: ['7', '12', '9', '16'], correct: 1, explain: '3 multiplied by 4 equals 12.' },
    { prompt: 'North, East, South, ?', answers: ['West', 'North', 'East', 'Up'], correct: 0, explain: 'The directions move clockwise.' },
    { prompt: '9, 7, 5, 3, ?', answers: ['0', '2', '1', '4'], correct: 2, explain: 'Subtract 2 each time.' },
    { prompt: 'A farmer has 5 baskets of 6 mangoes. 8 are sold. How many remain?', answers: ['30', '22', '18', '24'], correct: 1, explain: '5 × 6 − 8 = 22.' },
    { prompt: 'Which shape has exactly three corners?', answers: ['Triangle', 'Hexagon', 'Circle', 'Square'], correct: 0, explain: 'A triangle has three vertices.' },
    { prompt: 'If yesterday was Monday, what day is tomorrow?', answers: ['Tuesday', 'Thursday', 'Sunday', 'Wednesday'], correct: 3, explain: 'Today is Tuesday, so tomorrow is Wednesday.' },
  ],
  guess: [
    { prompt: 'CLUE: I protected Noah’s family and the animals from the flood. What am I?', answers: ['Tower', 'Ark', 'Temple', 'Cave'], correct: 1, explain: 'The ark was the vessel Noah built.', reference: 'Genesis 6' },
    { prompt: 'CLUE: I was a gift placed in a manger. Who am I?', answers: ['Samuel', 'Moses', 'Jesus', 'John'], correct: 2, explain: 'The newborn Jesus was laid in a manger.', reference: 'Luke 2:7' },
    { prompt: 'CLUE: I can show you the direction north without a phone. What am I?', answers: ['Compass', 'Shovel', 'Telescope', 'Lantern'], correct: 0, explain: 'A compass points to magnetic north.' },
    { prompt: 'CLUE: I need water, sunlight and soil. I grow food for a village.', answers: ['Bridge', 'Bell', 'Wall', 'Crop'], correct: 3, explain: 'Crops grow and supply food to the village.' },
    { prompt: 'CLUE: I have keys, but no locks, and I can play music.', answers: ['Gate', 'Piano', 'Map', 'Chest'], correct: 1, explain: 'A piano has musical keys.' },
    { prompt: 'CLUE: David used me against Goliath.', answers: ['Sling', 'Spear', 'Bow', 'Shield'], correct: 0, explain: 'David used a sling and a stone.', reference: '1 Samuel 17:49' },
    { prompt: 'CLUE: I connect two sides of a river and help travelers cross.', answers: ['Watchtower', 'Tunnel', 'Bridge', 'Granary'], correct: 2, explain: 'A bridge spans a gap or river.' },
    { prompt: 'CLUE: I hold grain so it can be used later. What building am I?', answers: ['Barn door', 'Castle', 'Dock', 'Granary'], correct: 3, explain: 'Granaries store grain for future use.' },
    { prompt: 'CLUE: Jesus fed a large crowd using me, along with fish.', answers: ['Bread loaves', 'Olives', 'Grapes', 'Dates'], correct: 0, explain: 'Five loaves and two fish were shared among the crowd.', reference: 'John 6:9–13' },
    { prompt: 'CLUE: I become smaller as I give light in the dark.', answers: ['Stone', 'Candle', 'Mirror', 'Key'], correct: 1, explain: 'A candle burns wax as it lights a room.' },
  ],
};
const INFO: Record<Mode, { gameId: string; title: string; place: string; help: string }> = {
  bible: { gameId: 'christian-civic-leadership', title: 'BIBLE QUEST', place: 'CHRISTIAN • CIVIC ACADEMY', help: 'Explore Bible stories and learn the reference after every answer.' },
  logic: { gameId: 'van-living-city-dispatch', title: 'MIND CHALLENGE', place: 'VAN • LIVING CITY', help: 'Solve logical sequences, patterns and number puzzles.' },
  guess: { gameId: 'quin-discovery-expedition', title: 'GUESSING QUEST', place: 'QUIN • DISCOVERY WORLD', help: 'Discover a hidden answer using clues and deduction.' },
};
export function KingdomQuestionArcadeR1({ mode, onFinish }: Props) {
  const info = INFO[mode];
  const questions = QUESTIONS[mode];
  const [phase, setPhase] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const question = questions[index];
  const isCorrect = selected === question.correct;
  const finalCount = questions.length;
  const start = useCallback(() => {
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setScore(0);
    setStreak(0);
    setPhase('playing');
    void playBuklodGameFeedback('move');
  }, []);

  const choose = useCallback((answer: number) => {
    if (phase !== 'playing' || selected !== null) return;
    setSelected(answer);
    const ok = answer === question.correct;
    setCorrectCount((value) => value + (ok ? 1 : 0));
    setStreak((value) => ok ? value + 1 : 0);
    setScore((value) => value + (ok ? 100 + Math.min(100, streak * 15) : 0));
    void playBuklodGameFeedback(ok ? 'collect' : 'impact');
  }, [phase, question, selected, streak]);

  const next = useCallback(() => {
    if (phase !== 'playing' || selected === null) return;
    if (index + 1 < questions.length) {
      setIndex((current) => current + 1);
      setSelected(null);
      return;
    }
    const won = correctCount >= Math.ceil(questions.length * 0.6);
    const status = won ? 'won' : 'lost';
    setPhase(status);
    void playBuklodGameFeedback(won ? 'success' : 'failure');
    onFinish?.({
      gameId: info.gameId,
      status,
      score,
      stars: won ? correctCount === questions.length ? 3 : correctCount >= questions.length - 2 ? 2 : 1 : 0,
      reward: { xp: 0, kingdomXp: 0 },
    });
  }, [correctCount, index, info.gameId, onFinish, phase, questions.length, score, selected]);

  const progress = useMemo(() => Math.round((index / finalCount) * 100), [finalCount, index]);
  return (
    <View style={styles.shell}>
      <Text style={styles.place}>{info.place}</Text>
      <Text style={styles.title}>{info.title}</Text>
      <Text style={styles.help}>{info.help}</Text>
      <View style={styles.statRow}>
        <Text style={styles.stat}>ROUND {Math.min(index + 1, finalCount)} / {finalCount}</Text>
        <Text style={styles.stat}>CORRECT {correctCount}</Text>
        <Text style={styles.stat}>SCORE {score}</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: progress + '%' }]} /></View>
      {phase === 'ready' ? (
        <View style={styles.panel}>
          <Text style={styles.head}>Every answer teaches something.</Text>
          <Text style={styles.detail}>Choose from four answers. Learn from the explanation, then continue. Pass by answering at least 6 of 10 correctly.</Text>
          <Pressable accessibilityRole="button" onPress={start} style={styles.primary}><Text style={styles.primaryText}>START CHALLENGE</Text></Pressable>
        </View>
      ) : phase === 'playing' ? (
        <View style={styles.panel}>
          <Text style={styles.question}>{question.prompt}</Text>
          {question.answers.map((answer, option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              disabled={selected !== null}
              onPress={() => choose(option)}
              style={[
                styles.answer,
                selected !== null && option === question.correct && styles.rightAnswer,
                selected === option && !isCorrect && styles.wrongAnswer,
              ]}
            >
              <Text style={styles.answerText}>{String.fromCharCode(65 + option)}. {answer}</Text>
            </Pressable>
          ))}
          {selected !== null ? (
            <View style={styles.feedback}>
              <Text style={styles.feedbackTitle}>{isCorrect ? 'CORRECT ANSWER' : 'LEARN & TRY AGAIN NEXT ROUND'}</Text>
              <Text style={styles.feedbackCopy}>{question.explain}</Text>
              {question.reference ? <Text style={styles.scripture}>{question.reference}</Text> : null}
              <Pressable accessibilityRole="button" onPress={next} style={styles.primary}>
                <Text style={styles.primaryText}>{index + 1 === questions.length ? 'SEE RESULTS' : 'NEXT CHALLENGE'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.head}>{phase === 'won' ? 'CHALLENGE COMPLETED!' : 'KEEP LEARNING!'}</Text>
          <Text style={styles.detail}>{correctCount} of {finalCount} solved • {score} game score</Text>
          <Pressable accessibilityRole="button" onPress={start} style={styles.primary}><Text style={styles.primaryText}>PLAY AGAIN</Text></Pressable>
        </View>
      )}
      <Text style={styles.foot}>Game score is for achievements only. No BUKLOD Points, purchases or rank requirement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32, alignItems: 'center', width: '100%', maxWidth: 580, alignSelf: 'center' },
  place: { color: '#f1ca89', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff3d5', fontSize: 29, fontWeight: '900', marginTop: 5, textAlign: 'center' },
  help: { color: '#d4dfeb', fontSize: 13, marginVertical: 10, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 12, marginVertical: 8, flexWrap: 'wrap', justifyContent: 'center' },
  stat: { color: '#fbe0aa', fontSize: 11, fontWeight: '800' },
  progressTrack: { width: '100%', height: 7, backgroundColor: '#34485c', borderRadius: 7, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: 7, backgroundColor: '#efc271' },
  panel: { width: '100%', backgroundColor: 'rgba(10,24,42,0.87)', borderRadius: 17, borderWidth: 1, borderColor: '#947d5f', padding: 16 },
  head: { fontSize: 22, color: '#ffedc9', textAlign: 'center', fontWeight: '900' },
  detail: { color: '#d7dfeb', lineHeight: 22, textAlign: 'center', marginVertical: 14 },
  question: { color: '#ffffff', fontSize: 19, fontWeight: '800', marginBottom: 18, lineHeight: 28 },
  answer: { backgroundColor: '#293c53', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 15, marginBottom: 9, borderWidth: 1, borderColor: '#57718a', minHeight: 48, justifyContent: 'center' },
  rightAnswer: { backgroundColor: '#226048', borderColor: '#94dba0' },
  wrongAnswer: { backgroundColor: '#703a41', borderColor: '#e8998c' },
  answerText: { color: '#fff7e9', fontSize: 15, fontWeight: '700' },
  feedback: { marginTop: 10, borderTopWidth: 1, borderColor: '#5a6a78', paddingTop: 12 },
  feedbackTitle: { color: '#f1c987', fontWeight: '900', letterSpacing: 0.8, marginBottom: 5 },
  feedbackCopy: { color: '#e9e4d5', fontSize: 14, lineHeight: 21 },
  scripture: { color: '#b8d8f8', fontSize: 12, marginTop: 7, fontWeight: '800' },
  primary: { marginTop: 16, backgroundColor: '#b38640', borderRadius: 12, padding: 15, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900', letterSpacing: 0.6 },
  foot: { color: '#bdc5d0', fontSize: 11, textAlign: 'center', marginTop: 18, maxWidth: 360 },
});
