import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import {
  SCRIPTURE_WORD_LEVELS, makeScriptureWordPuzzle, readScriptureWordLine, scriptureWordAt, type WordCell,
} from './scriptureWordRules';

const GAME_ID = 'christian-scripture-word-search';
const MAX_MISSES = 8;
type Phase = 'ready' | 'playing' | 'levelClear' | 'won' | 'lost';
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };

export function ScriptureWordSearchGameV1({ onFinish }: Props) {
  const { t, language } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [foundPaths, setFoundPaths] = useState<Record<string, WordCell[]>>({});
  const foundRef = useRef<string[]>([]);
  const [selected, setSelected] = useState<WordCell | null>(null);
  const selectedRef = useRef<WordCell | null>(null);
  const [misses, setMisses] = useState(0);
  const missesRef = useRef(0);
  const [hints, setHints] = useState(0);
  const hintsRef = useRef(0);
  const [levelHint, setLevelHint] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState('');
  const finishedRef = useRef(false);
  const sessionRef = useRef('');
  const puzzle = useMemo(() => makeScriptureWordPuzzle(level), [level]);
  const config = SCRIPTURE_WORD_LEVELS[level];

  const finish = useCallback((status: 'won' | 'lost', finalScore: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    phaseRef.current = status;
    setPhase(status);
    setPaused(false);
    const stars = status === 'lost' ? 0 : missesRef.current === 0 && hintsRef.current === 0 ? 3 :
      missesRef.current <= 3 && hintsRef.current <= 1 ? 2 : 1;
    const result: BuklodGameResult = {
      gameId: GAME_ID, status, score: finalScore,
      stars: stars as 0 | 1 | 2 | 3, reward: { xp: 0, kingdomXp: 0 },
    };
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
    onFinish?.(result, sessionRef.current);
  }, [onFinish]);

  const start = useCallback(() => {
    const session = 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 13);
    sessionRef.current = session;
    finishedRef.current = false;
    selectedRef.current = null;
    foundRef.current = [];
    missesRef.current = 0;
    hintsRef.current = 0;
    scoreRef.current = 0;
    phaseRef.current = 'playing';
    setPhase('playing');
    setLevel(0);
    setFound([]);
    setFoundPaths({});
    setSelected(null);
    setMisses(0);
    setHints(0);
    setScore(0);
    setLevelHint(null);
    setPaused(false);
    setMessage(t('Tap the first and last letter of each word. Lines may be diagonal or reversed.', 'I-tap ang una at huling titik ng bawat salita. Maaaring pahilis o pabaliktad ang linya.'));
    void playBuklodGameFeedback('move');
  }, [t]);

  const nextLevel = useCallback(() => {
    if (phaseRef.current !== 'levelClear' || level + 1 >= SCRIPTURE_WORD_LEVELS.length) return;
    foundRef.current = [];
    selectedRef.current = null;
    phaseRef.current = 'playing';
    setLevel(level + 1);
    setFound([]);
    setFoundPaths({});
    setSelected(null);
    setLevelHint(null);
    setPhase('playing');
    setMessage(t('New grid! Your previous score is preserved.', 'Bagong grid! Napanatili ang score mo.'));
    void playBuklodGameFeedback('move');
  }, [level, t]);

  const pick = useCallback((cell: WordCell) => {
    if (phaseRef.current !== 'playing' || paused) return;
    const first = selectedRef.current;
    if (!first) {
      selectedRef.current = cell;
      setSelected(cell);
      void playBuklodGameFeedback('move');
      return;
    }
    selectedRef.current = null;
    setSelected(null);
    if (first.row === cell.row && first.col === cell.col) return;
    const match = scriptureWordAt(puzzle, first, cell, foundRef.current);
    if (match) {
      const nextFound = [...foundRef.current, match.word];
      const nextScore = scoreRef.current + match.word.length * 45 + 120;
      foundRef.current = nextFound;
      scoreRef.current = nextScore;
      setFound(nextFound);
      // Highlight the player's exact winning path, including a reverse match.
      const matchedLine = readScriptureWordLine(puzzle.grid, first, cell);
      setFoundPaths(previous => ({ ...previous, [match.word]: matchedLine?.cells ?? [] }));
      setScore(nextScore);
      setMessage(t('Found', 'Nahanap') + ': ' + match.word + ' • ' + match.reference);
      void playBuklodGameFeedback('collect');
      if (nextFound.length === puzzle.words.length) {
        if (level + 1 >= SCRIPTURE_WORD_LEVELS.length) finish('won', nextScore);
        else {
          phaseRef.current = 'levelClear';
          setPhase('levelClear');
          void playBuklodGameFeedback('success');
        }
      }
      return;
    }
    missesRef.current += 1;
    setMisses(missesRef.current);
    setMessage(t('That line is not an unfinished target. Try again.', 'Hindi iyan ang hinahanap na natitirang salita. Subukan muli.'));
    void playBuklodGameFeedback('impact');
    if (missesRef.current >= MAX_MISSES) finish('lost', scoreRef.current);
  }, [finish, level, paused, puzzle, t]);

  const hint = useCallback(() => {
    if (phaseRef.current !== 'playing' || paused || levelHint !== null) return;
    const remaining = puzzle.words.find(w => !foundRef.current.includes(w.word));
    if (!remaining) return;
    const first = puzzle.placements[remaining.word][0];
    hintsRef.current += 1;
    setHints(hintsRef.current);
    setLevelHint(t('Start of ', 'Simula ng ') + remaining.word + ': ' + (first.row + 1) + ',' + (first.col + 1));
    void playBuklodGameFeedback('move');
  }, [levelHint, paused, puzzle, t]);

  const marked = useMemo(() => {
    const keys = new Set<string>();
    for (const path of Object.values(foundPaths)) {
      for (const cell of path) keys.add(cell.row + ':' + cell.col);
    }
    return keys;
  }, [foundPaths]);

  return (
    <View style={s.shell}>
      <View style={s.header}>
        <View>
          <Text style={s.kicker}>CHRISTIAN • BIBLE ACADEMY</Text>
          <Text style={s.title}>SCRIPTURE WORD SEARCH</Text>
          <Text style={s.subTitle}>{t('Discover Bible words across three complete puzzles.', 'Hanapin ang mga salitang mula sa Biblia sa tatlong puzzle.')}</Text>
        </View>
        <View style={s.scoreBox}><Text style={s.score}>{score}</Text><Text style={s.scoreLabel}>{t('GAME SCORE', 'SCORE')}</Text></View>
      </View>
      {phase === 'ready' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('A new way to explore Scripture', 'Isang bagong paraan ng pagtuklas sa Kasulatan')}</Text>
          <Text style={s.body}>{t('Choose a beginning and ending letter in one straight line. Words can be horizontal, vertical, diagonal, or backward. You have eight incorrect lines across all three levels; one starting-cell hint per level. Word spellings use the English Bible names shown in the list.', 'Piliin ang una at huling titik sa isang tuwid na linya. Puwedeng pahiga, patayo, pahilis o pabaliktad. May walong maling linya sa tatlong level at isang hint bawat level. Ang spelling ay batay sa English Bible names na nasa listahan.')}</Text>
          <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('START WORD SEARCH', 'SIMULAN ANG WORD SEARCH')}</Text></Pressable>
        </View>
      ) : phase === 'won' || phase === 'lost' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{phase === 'won' ? t('ALL THREE GRIDS COMPLETE!', 'TAPOS ANG TATLONG PUZZLE!') : t('ROUND ENDED', 'TAPOS ANG ROUND')}</Text>
          <Text style={s.result}>{score.toLocaleString()}</Text>
          <Text style={s.body}>{t('Game-only mastery score. No Character Points or transferable rewards have been awarded.', 'Game-only mastery score. Walang Character Points o cash rewards na naibigay.')}</Text>
          <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : phase === 'levelClear' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('LEVEL CLEARED!', 'NAKUMPLETO ANG LEVEL!')}</Text>
          <Text style={s.body}>{t('All words found. Your score is safe for the next puzzle.', 'Nahanap lahat ng salita. Dalhin ang score sa susunod na puzzle.')}</Text>
          <Pressable onPress={nextLevel} style={s.primary}><Text style={s.primaryText}>{t('NEXT LEVEL', 'SUSUNOD NA LEVEL')}</Text></Pressable>
        </View>
      ) : paused ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
          <Text style={s.body}>{t('Your progress is held until you resume.', 'Nananatili ang progreso mo hanggang ipagpatuloy.')}</Text>
          <Pressable style={s.primary} onPress={() => setPaused(false)}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.stats}>
            <Text style={s.statText}>{t('LEVEL', 'LEVEL')} {level + 1} / {SCRIPTURE_WORD_LEVELS.length}</Text>
            <Text style={s.statText}>{t('FOUND', 'NAHANAP')} {found.length} / {puzzle.words.length}</Text>
            <Text style={s.statText}>{t('MISSES', 'MALI')} {misses} / {MAX_MISSES}</Text>
            <Pressable onPress={() => setPaused(true)} style={s.smallButton}><Text style={s.smallText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
          </View>
          <Text style={s.levelTitle}>{language === 'tl' ? config.tl : config.en}</Text>
          <View style={s.grid} accessibilityLabel={t('Bible word-search letter grid', 'Grid ng Bible word search')}>
            {puzzle.grid.map((line, row) => (
              <View style={s.gridRow} key={row}>
                {line.map((letter, col) => {
                  const checked = marked.has(row + ':' + col);
                  const active = selected?.row === row && selected?.col === col;
                  return <Pressable
                    key={col}
                    accessibilityRole="button"
                    accessibilityLabel={t('Row', 'Hanay') + ' ' + (row + 1) + ' ' + t('column', 'kolum') + ' ' + (col + 1) + ', ' + letter}
                    style={[s.cell, checked && s.foundCell, active && s.activeCell]}
                    onPress={() => pick({ row, col })}
                  ><Text style={[s.letter, checked && s.foundLetter]}>{letter}</Text></Pressable>;
                })}
              </View>
            ))}
          </View>
          <Text style={s.instruction}>{t('TAP START • TAP END', 'TAP UNA • TAP HULI')}</Text>
          <View style={s.wordList}>
            {puzzle.words.map(entry => <View key={entry.word} style={[s.word, found.includes(entry.word) && s.wordFound]}>
              <Text style={[s.wordName, found.includes(entry.word) && s.wordDone]}>{entry.word}</Text>
              {found.includes(entry.word) && <Text style={s.wordRef}>{entry.reference}</Text>}
            </View>)}
          </View>
          <View style={s.actions}>
            <Pressable disabled={levelHint !== null} onPress={hint} style={[s.smallButton, levelHint !== null && s.disabled]}>
              <Text style={s.smallText}>{t('REVEAL START', 'PAKITA ANG SIMULA')} ({hints})</Text>
            </Pressable>
            {!!levelHint && <Text style={s.hint}>{levelHint}</Text>}
          </View>
        </>
      )}
      {!!message && phase === 'playing' && <Text style={s.message}>{message}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 11, paddingVertical: 12, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kicker: { color: '#f3d89d', fontSize: 10, fontWeight: '900' },
  title: { color: '#fff6e0', fontSize: 23, fontWeight: '900', maxWidth: 245 },
  subTitle: { color: '#cedbee', fontSize: 12, lineHeight: 19, maxWidth: 235 },
  scoreBox: { borderWidth: 1, borderColor: '#95845a', borderRadius: 12, padding: 8, backgroundColor: '#1d3049', alignItems: 'center', alignSelf: 'flex-start' },
  score: { fontSize: 22, fontWeight: '900', color: '#ffe5a9' },
  scoreLabel: { fontSize: 9, fontWeight: '900', color: '#d9c7a2' },
  panel: { borderRadius: 18, padding: 18, backgroundColor: '#1e3350', borderWidth: 1, borderColor: '#596a89', gap: 12 },
  panelTitle: { fontSize: 21, fontWeight: '900', color: '#fff0ce' },
  body: { color: '#d9e4f4', fontSize: 13, lineHeight: 21 },
  primary: { alignItems: 'center', padding: 14, borderRadius: 11, backgroundColor: '#eac778' },
  primaryText: { fontSize: 13, fontWeight: '900', color: '#132238' },
  result: { fontSize: 43, fontWeight: '900', color: '#ffe5a9' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  statText: { color: '#e1ecfc', fontSize: 11, fontWeight: '900' },
  levelTitle: { color: '#fde6b4', fontSize: 17, fontWeight: '900' },
  grid: { width: '100%', maxWidth: 465, alignSelf: 'center', padding: 4, gap: 2, borderRadius: 14, borderWidth: 1, borderColor: '#9b8a62', backgroundColor: '#18263d' },
  gridRow: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4, backgroundColor: '#304662', justifyContent: 'center', alignItems: 'center' },
  foundCell: { backgroundColor: '#327d65' },
  activeCell: { backgroundColor: '#e7be72' },
  letter: { color: '#f6f7ff', fontSize: 13, fontWeight: '900' },
  foundLetter: { color: '#fff7dc' },
  instruction: { color: '#e8d29d', textAlign: 'center', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  wordList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  word: { backgroundColor: '#243d57', padding: 8, borderRadius: 9, borderWidth: 1, borderColor: '#61718b', minWidth: 90, alignItems: 'center' },
  wordFound: { borderColor: '#58a68a', backgroundColor: '#22534c' },
  wordName: { color: '#f2e5ca', fontWeight: '900', fontSize: 12 },
  wordDone: { textDecorationLine: 'line-through' },
  wordRef: { fontSize: 10, color: '#c9e7d8', marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  smallButton: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#a5a9bc', backgroundColor: '#263c5c' },
  smallText: { color: '#fff3d8', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: .4 },
  hint: { color: '#f9dda4', fontSize: 11, fontWeight: '800' },
  message: { color: '#d9e5f5', fontSize: 12, fontWeight: '700', lineHeight: 18 },
});
