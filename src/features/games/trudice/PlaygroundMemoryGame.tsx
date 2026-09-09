import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BuklodGameResult } from '../types';

type Card = {
  id: string;
  pairKey: string;
  symbol: string;
};

const GAME_ID = 'trudice-playground-memory';

const makeDeck = (): Card[] => {
  const cards: Card[] = [
    { id: 'sun-a', pairKey: 'sun', symbol: '☀️' },
    { id: 'book-a', pairKey: 'book', symbol: '📖' },
    { id: 'heart-a', pairKey: 'heart', symbol: '💛' },
    { id: 'heart-b', pairKey: 'heart', symbol: '💛' },
    { id: 'sun-b', pairKey: 'sun', symbol: '☀️' },
    { id: 'book-b', pairKey: 'book', symbol: '📖' },
  ];

  return cards;
};

const starsForMoves = (moves: number): 1 | 2 | 3 => {
  if (moves <= 4) return 3;
  if (moves <= 6) return 2;
  return 1;
};

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function PlaygroundMemoryGame({ onFinish }: Props) {
  const deck = useMemo(makeDeck, []);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [matchedKeys, setMatchedKeys] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('Find the three matching pairs.');

  const reset = () => {
    setOpenIds([]);
    setMatchedKeys([]);
    setMoves(0);
    setLocked(false);
    setFinished(false);
    setMessage('Find the three matching pairs.');
  };

  const finish = (finalMoves: number) => {
    const stars = starsForMoves(finalMoves);
    const score = Math.max(300, 1000 - finalMoves * 80);
    setFinished(true);
    setMessage('Playground Memory cleared!');
    onFinish?.({
      gameId: GAME_ID,
      status: 'won',
      score,
      stars,
      reward: {
        xp: 100 + stars * 35,
        kingdomXp: 45 + stars * 15,
        collectibleKey: stars === 3 ? 'trudice-bright-memory-star' : undefined,
      },
    });
  };

  const chooseCard = (card: Card) => {
    if (locked || finished || matchedKeys.includes(card.pairKey) || openIds.includes(card.id)) return;

    if (openIds.length === 0) {
      setOpenIds([card.id]);
      setMessage('Choose one more card.');
      return;
    }

    const firstCard = deck.find((item) => item.id === openIds[0]);
    if (!firstCard) {
      setOpenIds([card.id]);
      return;
    }

    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setOpenIds([firstCard.id, card.id]);

    if (firstCard.pairKey === card.pairKey) {
      const nextMatched = [...matchedKeys, card.pairKey];
      setMatchedKeys(nextMatched);
      setMessage('Match found!');
      setOpenIds([]);
      if (nextMatched.length === 3) finish(nextMoves);
      return;
    }

    setLocked(true);
    setMessage('Not a match. Watch the cards, then try again.');
    setTimeout(() => {
      setOpenIds([]);
      setLocked(false);
    }, 700);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TRUDICE • CHILDREN'S HAVEN</Text>
          <Text style={styles.title}>Playground Memory</Text>
        </View>
        <View style={styles.hud}>
          <Text style={styles.hudText}>Moves {moves}</Text>
          <Text style={styles.hudText}>Pairs {matchedKeys.length}/3</Text>
        </View>
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.playground}>
        <Text style={styles.sky}>☁️  🎈  ☀️  🎈  ☁️</Text>
        <View style={styles.grid}>
          {deck.map((card) => {
            const revealed = openIds.includes(card.id) || matchedKeys.includes(card.pairKey);
            return (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                accessibilityLabel={revealed ? `Revealed ${card.pairKey}` : 'Hidden memory card'}
                onPress={() => chooseCard(card)}
                style={({ pressed }) => [
                  styles.card,
                  revealed && styles.cardOpen,
                  matchedKeys.includes(card.pairKey) && styles.cardMatched,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.cardText}>{revealed ? card.symbol : '★'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.ground}>🛝   🌼   ⚽   🌼   🎠</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.tip}>Goal: finish with fewer moves for a higher star rating.</Text>
        {finished ? (
          <Pressable style={styles.primaryButton} onPress={reset}>
            <Text style={styles.primaryText}>PLAY AGAIN</Text>
          </Pressable>
        ) : null}
      </View>

      {finished ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>MEMORY CLEARED</Text>
          <Text style={styles.resultText}>{'★'.repeat(starsForMoves(moves))} • {moves} moves</Text>
          <Text style={styles.resultHint}>
            Later this result can unlock Trudice XP, a Playground station, and a collectible without changing the memory engine.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    backgroundColor: '#fff6da',
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  eyebrow: {
    color: '#9a5b20',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: '#512e67',
    fontSize: 30,
    fontWeight: '900',
  },
  hud: {
    alignItems: 'flex-end',
    gap: 4,
  },
  hudText: {
    color: '#7d4b22',
    fontWeight: '900',
  },
  message: {
    color: '#644c32',
    fontSize: 15,
  },
  playground: {
    backgroundColor: '#bcecff',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 2,
    borderColor: '#72cce9',
  },
  sky: {
    textAlign: 'center',
    fontSize: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  card: {
    width: 112,
    height: 132,
    borderRadius: 18,
    backgroundColor: '#ff8f91',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOpen: {
    backgroundColor: '#ffffff',
    borderColor: '#f1c453',
  },
  cardMatched: {
    backgroundColor: '#fff8b8',
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  cardText: {
    fontSize: 46,
  },
  ground: {
    textAlign: 'center',
    fontSize: 28,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tip: {
    color: '#715637',
    flexShrink: 1,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: '#6f3a86',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  resultCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9c65d',
    gap: 6,
  },
  resultTitle: {
    color: '#6f3a86',
    fontSize: 20,
    fontWeight: '900',
  },
  resultText: {
    color: '#5f462c',
    fontWeight: '900',
  },
  resultHint: {
    color: '#725e48',
    lineHeight: 20,
  },
});
