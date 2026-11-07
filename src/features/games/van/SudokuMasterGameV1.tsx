import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import {
  SUDOKU_LEVELS, createSudokuEntry, enterSudokuDigit,
  makeSudokuPuzzle, type SudokuEntry,
} from './sudokuRules';

const GAME_ID = 'van-sudoku-master';
const MAX_MISTAKES = 3;
type Phase = 'ready' | 'playing' | 'paused' | 'levelClear' | 'won' | 'lost';
type Cell = { row: number; col: number };
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
const keyOf = (cell: Cell) => cell.row + ':' + cell.col;

export function SudokuMasterGameV1({ onFinish }: Props) {
  const { t, language } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const puzzle = useMemo(() => makeSudokuPuzzle(level), [level]);
  const [entry, setEntry] = useState<SudokuEntry>(() => createSudokuEntry(makeSudokuPuzzle(0)));
  const entryRef = useRef(entry);
  const [selected, setSelected] = useState<Cell | null>(null);
  const selectedRef = useRef<Cell | null>(null);
  const [pencil, setPencil] = useState(false);
  const [notes, setNotes] = useState<Record<string, number[]>>({});
  const [undoCount, setUndoCount] = useState(0);
  const undoRef = useRef<SudokuEntry[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const hintRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const scoreRef = useRef(0);
  const totalErrorsRef = useRef(0);
  const hintsRef = useRef(0);
  const finishedRef = useRef(false);
  const sessionRef = useRef('');

  const changePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const resetLevel = useCallback((nextLevel: number) => {
    const nextEntry = createSudokuEntry(makeSudokuPuzzle(nextLevel));
    entryRef.current = nextEntry;
    setEntry(nextEntry);
    undoRef.current = [];
    setUndoCount(0);
    selectedRef.current = null;
    setSelected(null);
    setNotes({});
    setPencil(false);
    hintRef.current = false;
    setHintUsed(false);
    setLevel(nextLevel);
    phaseRef.current = 'playing';
    setPhase('playing');
    setNotice(t('Choose an empty square, then a number. Pencil mode stores notes.', 'Pumili ng bakanteng kahon at numero. Ang Pencil mode ay para sa notes.'));
    void playBuklodGameFeedback('move');
  }, [t]);

  const start = useCallback(() => {
    sessionRef.current = 'su-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    finishedRef.current = false;
    scoreRef.current = 0;
    setCumulativeScore(0);
    hintsRef.current = 0;
    totalErrorsRef.current = 0;
    resetLevel(0);
  }, [resetLevel]);

  const finish = useCallback((status: 'won' | 'lost', total: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    changePhase(status);
    const stars = status === 'lost' ? 0 : totalErrorsRef.current === 0 && hintsRef.current === 0 ? 3 :
      totalErrorsRef.current <= 2 && hintsRef.current <= 1 ? 2 : 1;
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
    onFinish?.({
      gameId: GAME_ID, status, score: total,
      stars: stars as 0 | 1 | 2 | 3,
      reward: { xp: 0, kingdomXp: 0 },
    }, sessionRef.current);
  }, [onFinish]);

  const accept = useCallback((next: SudokuEntry, prior: SudokuEntry) => {
    entryRef.current = next; // Synchronous guard for double taps.
    setEntry(next);
    if (next.completed) {
      const total = scoreRef.current + next.score;
      scoreRef.current = total;
      setCumulativeScore(total);
      if (level + 1 === SUDOKU_LEVELS.length) finish('won', total);
      else changePhase('levelClear');
    } else if (next.mistakes >= MAX_MISTAKES) {
      finish('lost', scoreRef.current + next.score);
    }
  }, [finish, level]);

  const numberPress = useCallback((digit: number) => {
    const cell = selectedRef.current;
    if (phaseRef.current !== 'playing' || !cell) return;
    if (puzzle.starting[cell.row][cell.col] !== 0 ||
        entryRef.current.board[cell.row][cell.col] !== 0) return;
    if (pencil) {
      const key = keyOf(cell);
      setNotes(prev => {
        const old = prev[key] ?? [];
        const updated = old.includes(digit) ? old.filter(n => n !== digit) : [...old, digit].sort();
        return { ...prev, [key]: updated };
      });
      void playBuklodGameFeedback('move');
      return;
    }
    const prior = entryRef.current;
    const { next, effect } = enterSudokuDigit(puzzle, prior, cell.row, cell.col, digit);
    if (effect === 'ignored') return;
    if (effect === 'correct' || effect === 'complete') {
      undoRef.current = [...undoRef.current.slice(-35), prior];
      setUndoCount(undoRef.current.length);
      const key = keyOf(cell);
      setNotes(prev => ({ ...prev, [key]: [] }));
      setNotice(t('Correct placement!', 'Tamang puwesto!'));
      void playBuklodGameFeedback('collect');
    } else {
      totalErrorsRef.current++;
      setNotice(t('That number does not fit the solution. No change to the grid.', 'Hindi tugma ang numero. Walang nabago sa grid.'));
      void playBuklodGameFeedback('impact');
    }
    accept(next, prior);
  }, [accept, pencil, puzzle, t]);

  const undo = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const prior = undoRef.current.pop();
    if (!prior) return;
    entryRef.current = prior;
    setEntry(prior);
    setUndoCount(undoRef.current.length);
    setNotice(t('Last correct entry undone.', 'Binawi ang huling tamang entry.'));
    void playBuklodGameFeedback('move');
  }, [t]);

  const hint = useCallback(() => {
    if (phaseRef.current !== 'playing' || hintRef.current) return;
    const empty = entryRef.current.board.flatMap((line, row) =>
      line.map((value, col) => value === 0 ? { row, col } : null)).find(Boolean);
    if (!empty) return;
    hintRef.current = true;
    setHintUsed(true);
    hintsRef.current++;
    const { next } = enterSudokuDigit(puzzle, entryRef.current, empty.row, empty.col, puzzle.solution[empty.row][empty.col]);
    // A hint never adds score.
    const neutral = { ...next, score: entryRef.current.score };
    selectedRef.current = empty;
    setSelected(empty);
    setNotes(prev => ({ ...prev, [keyOf(empty)]: [] }));
    setNotice(t('One cell revealed, with no score bonus.', 'Isang cell ang ipinakita; walang dagdag na score.'));
    void playBuklodGameFeedback('move');
    accept(neutral, entryRef.current);
  }, [accept, puzzle, t]);

  const completed = phase === 'won' || phase === 'lost';
  const currentNumber = selected ? entry.board[selected.row][selected.col] : null;
  const filled = entry.board.flat().filter(v => v > 0).length;

  return (
    <View style={s.shell}>
      <View style={s.top}>
        <View>
          <Text style={s.kicker}>VAN • MIND CITY</Text>
          <Text style={s.title}>SUDOKU MASTER</Text>
          <Text style={s.sub}>{t('One solution. Every number counts.', 'Iisang solusyon. Mahalaga ang bawat numero.')}</Text>
        </View>
        <View style={s.scoreCard}><Text style={s.score}>{cumulativeScore + (completed ? 0 : entry.score)}</Text>
          <Text style={s.scoreLabel}>{t('MASTER SCORE', 'MASTER SCORE')}</Text></View>
      </View>
      {phase === 'ready' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Train your mind in three stages', 'Sanayin ang isip sa tatlong yugto')}</Text>
          <Text style={s.body}>{t('Fill rows, columns, and 3×3 boxes with numbers 1–9 without repeats. Each puzzle has exactly one solution. Tap a blank cell, then choose a number. Use Pencil for candidates, Undo for confirmed entries, and one free reveal per level. Three wrong guesses end the level.', 'Punan ang bawat hanay, kolum, at 3×3 kahon ng 1–9 nang walang inuulit. Iisa lamang ang solusyon ng bawat puzzle. Pumili ng bakanteng cell, saka numero. May Pencil notes, Undo, at isang reveal bawat level. Tatlong mali ay magtatapos sa round.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('START SUDOKU', 'SIMULAN ANG SUDOKU')}</Text></Pressable>
        </View>
      ) : completed ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{phase === 'won' ? t('ALL THREE PUZZLES SOLVED!', 'KUMPLETO ANG TATLONG PUZZLE!') : t('NO MISTAKES LEFT', 'UBOS NA ANG MGA TSANSA')}</Text>
          <Text style={s.finalScore}>{cumulativeScore + (phase === 'lost' ? entry.score : 0)}</Text>
          <Text style={s.body}>{t('Your mastery score is saved locally only. It does not increase BUKLOD Character Points.', 'Ang mastery score ay sa device lamang at hindi nagdaragdag ng BUKLOD Character Points.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : phase === 'paused' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
          <Text style={s.body}>{t('Your grid is preserved while the game remains open.', 'Nananatili ang grid habang bukas ang laro.')}</Text>
          <Pressable style={s.primary} onPress={() => changePhase('playing')}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : phase === 'levelClear' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('LEVEL COMPLETE!', 'KUMPLETO ANG LEVEL!')}</Text>
          <Text style={s.body}>{t('A unique solution found. Carry your score into the next puzzle.', 'Natapos ang puzzle na may iisang solusyon. Dalhin ang score sa susunod na level.')}</Text>
          <Pressable style={s.primary} onPress={() => resetLevel(level + 1)}><Text style={s.primaryText}>{t('NEXT PUZZLE', 'SUSUNOD NA PUZZLE')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.statusBar}>
            <Text style={s.statusText}>{t('LEVEL', 'LEVEL')} {level + 1}/3 • {language === 'tl' ? SUDOKU_LEVELS[level].tl : SUDOKU_LEVELS[level].en}</Text>
            <Text style={s.statusText}>{filled}/81 • {t('MISSES', 'MALI')} {entry.mistakes}/{MAX_MISTAKES}</Text>
          </View>
          <View style={s.board}>
            {entry.board.map((line, row) => <View key={row} style={s.row}>
              {line.map((number, col) => {
                const startNumber = puzzle.starting[row][col] > 0;
                const isSelected = selected?.row === row && selected?.col === col;
                const related = selected && (selected.row === row || selected.col === col ||
                  Math.floor(selected.row / 3) === Math.floor(row / 3) && Math.floor(selected.col / 3) === Math.floor(col / 3));
                const notesForCell = notes[row + ':' + col] ?? [];
                return <Pressable
                  key={col} accessibilityRole="button"
                  accessibilityLabel={t('Row', 'Hanay') + ' ' + (row + 1) + ', ' + t('column', 'kolum') + ' ' + (col + 1) + ', ' + (number || t('empty', 'walang laman'))}
                  onPress={() => { selectedRef.current = { row, col }; setSelected({ row, col }); }}
                  style={[
                    s.cell, col % 3 === 2 && col !== 8 && s.boxRight,
                    row % 3 === 2 && row !== 8 && s.boxBottom,
                    related && s.related, isSelected && s.selected,
                  ]}
                >
                  {number ? <Text style={[s.digit, startNumber && s.fixedDigit, isSelected && s.selectedDigit]}>{number}</Text> :
                    <Text numberOfLines={2} style={s.pencilText}>{notesForCell.join(' ')}</Text>}
                </Pressable>;
              })}
            </View>)}
          </View>
          <View style={s.numberPad}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map(digit => <Pressable key={digit} onPress={() => numberPress(digit)}
              style={[s.numberButton, currentNumber === digit && s.numberCurrent]}>
              <Text style={s.numberText}>{digit}</Text>
            </Pressable>)}
          </View>
          <View style={s.controls}>
            <Pressable style={[s.control, pencil && s.controlActive]} onPress={() => setPencil(v => !v)}><Text style={s.controlText}>{t('PENCIL', 'NOTES')} {pencil ? '✓' : ''}</Text></Pressable>
            <Pressable disabled={!undoCount} style={[s.control, !undoCount && s.faded]} onPress={undo}><Text style={s.controlText}>{t('UNDO', 'Bawi')} ({undoCount})</Text></Pressable>
            <Pressable disabled={hintUsed} style={[s.control, hintUsed && s.faded]} onPress={hint}><Text style={s.controlText}>{t('HINT', 'TULONG')} {hintUsed ? '✓' : ''}</Text></Pressable>
            <Pressable style={s.control} onPress={() => changePhase('paused')}><Text style={s.controlText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
          </View>
          {!!notice && <Text style={s.notice}>{notice}</Text>}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { maxWidth: 780, width: '100%', alignSelf: 'center', paddingHorizontal: 11, paddingVertical: 15, gap: 13 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 11, alignItems: 'flex-start' },
  kicker: { color: '#b5e7ed', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#e0f9ff', fontWeight: '900', fontSize: 26 },
  sub: { color: '#cbd8ee', fontSize: 12, marginTop: 4 },
  scoreCard: { backgroundColor: '#194057', borderRadius: 12, padding: 11, alignItems: 'center', borderColor: '#6faabb', borderWidth: 1 },
  score: { color: '#c3f5e7', fontSize: 22, fontWeight: '900' },
  scoreLabel: { color: '#a4c6cf', fontSize: 9, fontWeight: '900' },
  panel: { backgroundColor: '#19314e', borderColor: '#59899a', borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 },
  panelTitle: { color: '#eff8fa', fontSize: 22, fontWeight: '900' },
  body: { color: '#d2e4ec', fontSize: 13, lineHeight: 21 },
  primary: { backgroundColor: '#79d5da', padding: 14, alignItems: 'center', borderRadius: 12 },
  primaryText: { color: '#123c51', fontSize: 12, fontWeight: '900' },
  finalScore: { color: '#bbefcf', fontSize: 40, fontWeight: '900' },
  statusBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  statusText: { color: '#d5f5fd', fontSize: 11, fontWeight: '900' },
  board: { width: '100%', maxWidth: 469, alignSelf: 'center', padding: 3, backgroundColor: '#a6c6d0', borderRadius: 10, borderWidth: 2, borderColor: '#e1f5f5', gap: 1 },
  row: { flexDirection: 'row', gap: 1 },
  cell: { flex: 1, aspectRatio: 1, backgroundColor: '#213d5a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1, paddingVertical: 0 },
  boxRight: { borderRightWidth: 2, borderRightColor: '#d4eef0' },
  boxBottom: { borderBottomWidth: 2, borderBottomColor: '#d4eef0' },
  related: { backgroundColor: '#345675' },
  selected: { backgroundColor: '#71c7d9' },
  digit: { fontSize: 16, color: '#a1f2d5', fontWeight: '900' },
  fixedDigit: { color: '#f3f6fd' },
  selectedDigit: { color: '#13304f' },
  pencilText: { fontSize: 8, color: '#c3dae6', lineHeight: 10, textAlign: 'center' },
  numberPad: { flexDirection: 'row', gap: 4, justifyContent: 'space-between', maxWidth: 500, width: '100%', alignSelf: 'center' },
  numberButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#71b9c5', borderRadius: 7, backgroundColor: '#2b5875', paddingVertical: 12 },
  numberCurrent: { backgroundColor: '#397b8d' },
  numberText: { color: '#e8ffff', fontSize: 19, fontWeight: '900' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  control: { backgroundColor: '#244359', borderRadius: 9, borderWidth: 1, borderColor: '#77b2bd', paddingVertical: 10, paddingHorizontal: 12 },
  controlActive: { backgroundColor: '#39797c' },
  faded: { opacity: .42 },
  controlText: { color: '#e6f5fe', fontSize: 11, fontWeight: '900' },
  notice: { color: '#c7ebf4', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
