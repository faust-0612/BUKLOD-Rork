import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import {
  BLOCK_SHAPES, BLOCK_SIZE, BLOCK_TARGET,
  canPlaceBlock, createBlockState, placeBlock, type BlockState,
} from './blockForgeRules';

type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
const GAME_ID = 'mitch-block-forge';

export function BlockForgeGameV1({ onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const [game, setGame] = useState<BlockState | null>(null);
  const gameRef = useRef<BlockState | null>(null);
  const completedRef = useRef(false);
  const sessionRef = useRef('');
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState('');

  const start = useCallback(() => {
    const initial = createBlockState();
    gameRef.current = initial;
    completedRef.current = false;
    sessionRef.current = 'bf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 13);
    setGame(initial);
    setSelected(0);
    setPaused(false);
    setNotice(t('Fill an entire row or column to clear it. Place each shape wisely.', 'Punuin ang isang hanay o kolum upang ma-clear. Planuhin ang bawat piraso.'));
    void playBuklodGameFeedback('move');
  }, [t]);

  const put = useCallback((row: number, col: number) => {
    const current = gameRef.current;
    if (!current || paused || current.status !== 'playing') return;
    if (!canPlaceBlock(current.board, current.hand[selected] ?? -1, row, col)) {
      setNotice(t('That shape cannot fit there. Pick another cell or piece.', 'Hindi kasya ang piraso roon. Pumili ng ibang puwesto o piraso.'));
      void playBuklodGameFeedback('impact');
      return;
    }
    try {
      const next = placeBlock(current, selected, row, col);
      gameRef.current = next; // Synchronous guard against multi-tap double placement.
      setGame(next);
      const nextSlot = next.hand.findIndex(id => id !== null);
      setSelected(nextSlot < 0 ? 0 : nextSlot);
      const delta = next.cleared - current.cleared;
      setNotice(delta
        ? t('Beautiful clear! Your mosaic glows brighter.', 'Magaling! Mas maliwanag na ang mosaic.')
        : t('Good placement. Look for a line to complete.', 'Ayos! Kumpletuhin ang susunod na hanay.'));
      void playBuklodGameFeedback(delta ? 'collect' : 'move');
      if (next.status !== 'playing' && !completedRef.current) {
        completedRef.current = true;
        const stars = next.status === 'lost' ? 0 : next.score >= 1800 ? 3 : next.cleared >= 4 ? 2 : 1;
        const result: BuklodGameResult = {
          gameId: GAME_ID, status: next.status, score: next.score,
          stars: stars as 0 | 1 | 2 | 3, reward: { xp: 0, kingdomXp: 0 },
        };
        void playBuklodGameFeedback(next.status === 'won' ? 'success' : 'failure');
        onFinish?.(result, sessionRef.current);
      }
    } catch {
      setNotice(t('Invalid move. Choose a free position.', 'Hindi puwedeng ilagay roon.'));
      void playBuklodGameFeedback('impact');
    }
  }, [onFinish, paused, selected, t]);

  const activeId = game?.hand[selected];
  const selectedShape = activeId == null ? null : BLOCK_SHAPES[activeId];
  const isFinished = game?.status === 'won' || game?.status === 'lost';

  return (
    <View style={s.shell}>
      <View style={s.header}>
        <View>
          <Text style={s.kicker}>MITCH • ART VILLAGE</Text>
          <Text style={s.title}>BLOCK FORGE</Text>
          <Text style={s.subtitle}>{t('Shape the mosaic. Clear lines. Build your best score.', 'Bumuo ng mosaic, mag-clear ng linya, at mag-ipon ng score.')}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statValue}>{game?.score ?? 0}</Text>
          <Text style={s.statLabel}>/ {BLOCK_TARGET}</Text>
        </View>
      </View>
      {game && (
        <View style={s.stats}>
          <Text style={s.statText}>{t('LINES', 'LINYA')}: {game.cleared}</Text>
          <Text style={s.statText}>{t('MOVES', 'GALAW')}: {game.moves}</Text>
          <Text style={s.statText}>{t('ROUND', 'ROUND')}: {game.round + 1}</Text>
          {!isFinished && <Pressable style={s.smallButton} onPress={() => setPaused(v => !v)}>
            <Text style={s.smallButtonText}>{paused ? t('RESUME', 'ITULOY') : t('PAUSE', 'IHINTO')}</Text>
          </Pressable>}
        </View>
      )}
      {!game ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Restore the kingdom mosaic', 'Ayusin ang mosaic ng kaharian')}</Text>
          <Text style={s.body}>{t('Choose from three shapes and tap the board to place one. Complete rows or columns for bonus points. Reach 1,200 before your board runs out of legal moves.', 'Pumili sa tatlong piraso at i-tap ang board. Kumpletuhin ang hanay o kolum para sa bonus. Umabot sa 1,200 bago maubos ang mga legal na galaw.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('START BLOCK FORGE', 'SIMULAN ANG BLOCK FORGE')}</Text></Pressable>
        </View>
      ) : isFinished ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{game.status === 'won' ? t('MOSAIC RESTORED!', 'NAIBALIK ANG MOSAIC!') : t('NO MOVES LEFT', 'WALA NANG GALAW')}</Text>
          <Text style={s.bigResult}>{game.score.toLocaleString()}</Text>
          <Text style={s.body}>{t('Your score is for this game only. There are no automatic BUKLOD Character Point awards.', 'Para lamang sa larong ito ang score. Walang awtomatikong BUKLOD Character Points.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : paused ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
          <Text style={s.body}>{t('Your board is safe while this screen is open.', 'Nananatili ang board habang bukas ang screen.')}</Text>
          <Pressable style={s.primary} onPress={() => setPaused(false)}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.board} accessibilityLabel={t('Eight by eight block board', 'Walong hanay at walong kolum na board')}>
            {game.board.map((line, row) => (
              <View style={s.boardRow} key={row}>
                {line.map((cell, col) => {
                  const canPlace = selectedShape && canPlaceBlock(game.board, activeId as number, row, col);
                  return (
                    <Pressable key={col} onPress={() => put(row, col)}
                      accessibilityRole="button"
                      accessibilityLabel={t('Row', 'Hanay') + ' ' + (row + 1) + ', ' + t('column', 'kolum') + ' ' + (col + 1) + (cell ? ', filled' : ', empty')}
                      style={[s.cell, cell && s.cellFilled, canPlace && !cell && s.cellLegal]}>
                      <View style={[s.cellCore, cell && s.cellCoreFilled]} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <Text style={s.helper}>{t('CHOOSE A SHAPE — TAP ITS TOP-LEFT POSITION', 'PUMILI NG PIRASO — I-TAP ANG KALIWANG ITAAS NA PUWESTO')}</Text>
          <View style={s.hand}>
            {game.hand.map((id, i) => {
              const shape = id == null ? null : BLOCK_SHAPES[id];
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={shape?.id ?? 'Used'}
                  key={i} disabled={!shape} onPress={() => { setSelected(i); void playBuklodGameFeedback('move'); }}
                  style={[s.shapeSlot, selected === i && s.shapeSelected, !shape && s.shapeUsed]}>
                  {shape ? <View style={s.shapePreview}>
                    {Array.from({ length: 3 }, (_, r) => (
                      <View key={r} style={s.previewRow}>{Array.from({ length: 3 }, (_, c) => (
                        <View key={c} style={[s.previewCell, shape.cells.some(([dr, dc]) => dr === r && dc === c) && s.previewFilled]}/>
                      ))}</View>
                    ))}
                  </View> : <Text style={s.usedText}>{t('USED', 'GAMIT')}</Text>}
                  <Text style={s.shapeLabel}>{shape?.id.toUpperCase() ?? '—'}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      {!!notice && !isFinished && <Text style={s.notice}>{notice}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 9 },
  kicker: { color: '#f9cca0', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#fff1d6', fontSize: 28, fontWeight: '900', letterSpacing: .6 },
  subtitle: { color: '#e1caba', fontSize: 12, lineHeight: 17, maxWidth: 260 },
  statBox: { alignItems: 'flex-end', backgroundColor: '#402d3b', padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#aa7f7e' },
  statValue: { color: '#ffe0a6', fontWeight: '900', fontSize: 23 },
  statLabel: { color: '#cdb8ab', fontWeight: '700', fontSize: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statText: { color: '#fff0e0', fontWeight: '900', fontSize: 11 },
  smallButton: { borderColor: '#e6baa0', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  smallButtonText: { color: '#fff0e0', fontSize: 10, fontWeight: '900' },
  board: { width: '100%', maxWidth: 450, alignSelf: 'center', backgroundColor: '#34232f', padding: 5, borderRadius: 16, borderWidth: 2, borderColor: '#bd937b', gap: 3 },
  boardRow: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, aspectRatio: 1, backgroundColor: '#573d4b', borderRadius: 5, justifyContent: 'center', alignItems: 'center', padding: 2 },
  cellFilled: { backgroundColor: '#e5a96c' },
  cellLegal: { borderWidth: 1, borderColor: '#a07866' },
  cellCore: { flex: 1, width: '100%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.03)' },
  cellCoreFilled: { backgroundColor: '#f4cf93', borderColor: '#ffedc0', borderWidth: 1 },
  helper: { color: '#e8d3c9', textAlign: 'center', fontWeight: '900', fontSize: 10, letterSpacing: .5 },
  hand: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  shapeSlot: { width: '29%', maxWidth: 126, minHeight: 107, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: '#8a7381', backgroundColor: '#44313f', alignItems: 'center', justifyContent: 'center', gap: 5 },
  shapeSelected: { borderWidth: 2, borderColor: '#ffe9a4', backgroundColor: '#62424e' },
  shapeUsed: { opacity: .4 },
  shapePreview: { gap: 3 },
  previewRow: { flexDirection: 'row', gap: 3 },
  previewCell: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#302632' },
  previewFilled: { backgroundColor: '#f5c88d', borderWidth: 1, borderColor: '#ffead0' },
  shapeLabel: { color: '#fce7d3', fontWeight: '900', fontSize: 10 },
  usedText: { color: '#d9beb3', fontWeight: '900', fontSize: 11 },
  panel: { borderColor: '#a47977', borderWidth: 1, borderRadius: 18, backgroundColor: '#342b3a', padding: 18, gap: 13 },
  panelTitle: { color: '#fff2db', fontWeight: '900', fontSize: 22 },
  body: { color: '#e4d1c3', fontSize: 14, lineHeight: 22 },
  bigResult: { color: '#ffe09d', fontSize: 42, fontWeight: '900' },
  primary: { padding: 14, backgroundColor: '#f1c890', alignItems: 'center', borderRadius: 12 },
  primaryText: { color: '#3b2531', fontSize: 13, fontWeight: '900' },
  notice: { color: '#f7dfc7', fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
});
