import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

const GAME_ID = 'mitch-restore-mural';
const SIZE = 8;
type Shape = { name: string; cells: [number, number][] };
const SHAPES: Shape[] = [
  { name: 'Square', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: 'Line', cells: [[0, 0], [1, 0], [2, 0]] },
  { name: 'Corner', cells: [[0, 0], [1, 0], [0, 1]] },
  { name: 'Tall', cells: [[0, 0], [0, 1], [0, 2]] },
  { name: 'Zigzag', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: 'Single', cells: [[0, 0]] },
  { name: 'Hook', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
];
const EMPTY = (): boolean[][] => Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
const HAND = (round: number): number[] =>
  [SHAPES[(round * 3) % SHAPES.length], SHAPES[(round * 3 + 2) % SHAPES.length], SHAPES[(round * 3 + 4) % SHAPES.length]]
    .map((shape) => SHAPES.indexOf(shape));

function canPlace(board: boolean[][], shape: Shape, row: number, col: number): boolean {
  return shape.cells.every(([dx, dy]) => {
    const x = col + dx;
    const y = row + dy;
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE && !board[y][x];
  });
}

function hasLegalMove(board: boolean[][], pieces: number[]): boolean {
  return pieces.some((piece) =>
    board.some((line, row) =>
      line.some((_, col) => canPlace(board, SHAPES[piece], row, col)),
    ),
  );
}

function clearCompleted(board: boolean[][]): { board: boolean[][]; count: number } {
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    if (board[row].every(Boolean)) fullRows.push(row);
  }
  for (let col = 0; col < SIZE; col += 1) {
    if (board.every((line) => line[col])) fullCols.push(col);
  }
  const next = board.map((line) => [...line]);
  fullRows.forEach((row) => next[row].fill(false));
  fullCols.forEach((col) => next.forEach((line) => { line[col] = false; }));
  return { board: next, count: fullRows.length + fullCols.length };
}

type Props = { onFinish?: (result: BuklodGameResult) => void };
export function KingdomBlocksGameR1({ onFinish }: Props) {
  const [board, setBoard] = useState<boolean[][]>(EMPTY);
  const [hand, setHand] = useState<(number | null)[]>(() => HAND(0));
  const [selected, setSelected] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready');
  const [notice, setNotice] = useState('Choose a shape, then tap where its top-left corner should land.');
  const target = 900;
  const active = hand[selected] == null ? null : SHAPES[hand[selected] as number];

  const start = useCallback(() => {
    setBoard(EMPTY());
    setHand(HAND(0));
    setSelected(0);
    setRound(0);
    setScore(0);
    setLines(0);
    setNotice('Complete rows or columns to clear the board. Make room for the next blocks!');
    setPhase('playing');
    void playBuklodGameFeedback('move');
  }, []);

  const finish = useCallback((status: 'won' | 'lost', finalScore: number, cleared: number) => {
    setPhase(status);
    setNotice(status === 'won' ? 'Block Forge mastered! Your Kingdom mosaic is restored.' : 'No shape fits. Try a fresh board.');
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
    onFinish?.({
      gameId: GAME_ID,
      status,
      score: finalScore,
      stars: status === 'lost' ? 0 : finalScore >= 1500 ? 3 : cleared >= 5 ? 2 : 1,
      reward: { xp: 0, kingdomXp: 0 },
    });
  }, [onFinish]);

  const put = useCallback((row: number, col: number) => {
    if (phase !== 'playing' || !active || !canPlace(board, active, row, col)) {
      void playBuklodGameFeedback('impact');
      setNotice('That shape does not fit there. Choose a different clear space.');
      return;
    }
    const placed = board.map((line) => [...line]);
    active.cells.forEach(([dx, dy]) => { placed[row + dy][col + dx] = true; });
    const cleared = clearCompleted(placed);
    const newLines = lines + cleared.count;
    const newScore = score + active.cells.length * 25 + cleared.count * cleared.count * 170;
    let newHand = [...hand];
    newHand[selected] = null;
    let nextRound = round;
    if (newHand.every((piece) => piece === null)) {
      nextRound += 1;
      newHand = HAND(nextRound);
    }
    setBoard(cleared.board);
    setHand(newHand);
    setSelected(Math.max(0, newHand.findIndex((piece) => piece !== null)));
    setLines(newLines);
    setScore(newScore);
    setRound(nextRound);
    void playBuklodGameFeedback(cleared.count > 0 ? 'collect' : 'move');
    if (newScore >= target) {
      finish('won', newScore, newLines);
    } else if (!hasLegalMove(cleared.board, newHand.filter((piece): piece is number => piece !== null))) {
      finish('lost', newScore, newLines);
    } else {
      setNotice(cleared.count > 0 ? 'Great clear! Keep creating space.' : 'Good placement. Plan your next shape.');
    }
  }, [active, board, finish, hand, lines, phase, round, score, selected]);

  return (
    <View style={styles.shell}>
      <Text style={styles.kicker}>MITCH • ART VILLAGE</Text>
      <Text style={styles.title}>BLOCK FORGE</Text>
      <Text style={styles.sub}>Build a beautiful mosaic by clearing complete rows and columns.</Text>
      <View style={styles.stats}>
        <Text style={styles.stat}>SCORE {score} / {target}</Text>
        <Text style={styles.stat}>LINES {lines}</Text>
      </View>
      <Text style={styles.notice}>{notice}</Text>
      {phase === 'ready' || phase === 'won' || phase === 'lost' ? (
        <Pressable accessibilityRole="button" onPress={start} style={styles.action}>
          <Text style={styles.actionText}>{phase === 'ready' ? 'START BLOCKS' : 'PLAY AGAIN'}</Text>
        </Pressable>
      ) : null}
      <View style={styles.board}>
        {board.map((line, row) => (
          <View key={row} style={styles.boardRow}>
            {line.map((filled, col) => (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityLabel={'Row ' + (row + 1) + ', column ' + (col + 1) + (filled ? ', filled' : ', empty')}
                disabled={phase !== 'playing'}
                onPress={() => put(row, col)}
                style={[styles.cell, filled && styles.filled]}
              />
            ))}
          </View>
        ))}
      </View>
      <Text style={styles.hint}>SELECT SHAPE — tap a board cell to place it</Text>
      <View style={styles.pieceRow}>
        {hand.map((piece, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={piece == null ? 'Shape used' : SHAPES[piece].name}
            disabled={phase !== 'playing' || piece === null}
            onPress={() => { setSelected(index); void playBuklodGameFeedback('move'); }}
            style={[styles.piece, selected === index && styles.pieceSelected]}
          >
            <Text style={styles.pieceName}>{piece === null ? 'USED' : SHAPES[piece].name}</Text>
            {piece !== null ? (
              <View style={styles.shapePreview}>
                {Array.from({ length: 3 }, (_, y) => (
                  <View key={y} style={styles.shapePreviewRow}>
                    {Array.from({ length: 3 }, (_, x) => (
                      <View
                        key={x}
                        style={[
                          styles.shapePreviewCell,
                          SHAPES[piece].cells.some(([dx, dy]) => dx === x && dy === y) && styles.shapePreviewFilled,
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      <Text style={styles.footer}>No BUKLOD Points required or awarded. This is an optional Kingdom challenge.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  kicker: { color: '#f2ca91', letterSpacing: 2, fontWeight: '800', fontSize: 11 },
  title: { color: '#fff2d3', fontWeight: '900', fontSize: 27, marginTop: 5 },
  sub: { color: '#d3c1af', fontSize: 12, marginTop: 6, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 16, paddingTop: 15, paddingBottom: 10 },
  stat: { color: '#fff1c4', fontWeight: '800', fontSize: 13 },
  notice: { color: '#d4dde1', fontSize: 12, textAlign: 'center', minHeight: 32, maxWidth: 360 },
  board: { aspectRatio: 1, width: '100%', maxWidth: 360, borderWidth: 2, borderColor: '#c6a16b', borderRadius: 12, padding: 3, backgroundColor: '#231e28' },
  boardRow: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, margin: 2, borderRadius: 4, backgroundColor: '#575263', borderWidth: 1, borderColor: '#746a74' },
  filled: { backgroundColor: '#f3b659', borderColor: '#fff2b6' },
  hint: { color: '#fff0cc', fontWeight: '800', fontSize: 11, marginTop: 14, marginBottom: 8 },
  pieceRow: { flexDirection: 'row', gap: 8, maxWidth: 360 },
  piece: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 64, backgroundColor: '#342a3d', borderRadius: 10, borderWidth: 2, borderColor: '#68556a' },
  pieceSelected: { borderColor: '#ffcf74', backgroundColor: '#68415e' },
  pieceName: { fontSize: 12, fontWeight: '800', color: '#f8e6c7' },
  shapePreview: { marginTop: 5, padding: 3 },
  shapePreviewRow: { flexDirection: 'row' },
  shapePreviewCell: { width: 9, height: 9, margin: 1, borderRadius: 2, backgroundColor: 'transparent' },
  shapePreviewFilled: { backgroundColor: '#ffcd75', borderWidth: 1, borderColor: '#ffeab8' },
  action: { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#bb7a36', marginVertical: 12 },
  actionText: { color: '#fff', fontWeight: '900' },
  footer: { color: '#c7a999', fontSize: 10, textAlign: 'center', marginTop: 14 },
});
