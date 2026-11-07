/**
 * Kingdom Draw Dominoes — complete double-six tile/chain/stock turn rules.
 * Exactly 28 tiles; each player is dealt 7; highest held double starts.
 * Pure and deterministic for offline play. No authority over BUKLOD Points.
 */
export type DominoPlayer = 0 | 1;
export type DominoSide = 'left' | 'right';
export type DominoWinner = 'human' | 'ai' | 'draw';
export type DominoTile = { id: number; a: number; b: number };
export type DominoPlaced = { id: number; left: number; right: number; player: DominoPlayer };
export type DominoRound = {
  round: number;
  hands: [number[], number[]];
  stock: number[];
  chain: DominoPlaced[];
  turn: DominoPlayer;
  winner: DominoWinner | null;
  award: { human: number; ai: number };
  lastAction: string;
};

export const DOMINO_TILES: readonly DominoTile[] = Array.from({ length: 7 }, (_, a) =>
  Array.from({ length: 7 - a }, (_, offset) => ({
    a, b: a + offset,
  }))).flat().map((tile, id) => ({ ...tile, id }));
export const DOMINO_ROUNDS = 3;

function rng(seed: number): () => number {
  let x = (seed | 0) || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function shuffled(seed: number): number[] {
  const rand = rng(seed);
  const items = DOMINO_TILES.map(t => t.id);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const other = (player: DominoPlayer): DominoPlayer => player === 0 ? 1 : 0;
export const dominoPipSum = (ids: readonly number[]): number =>
  ids.reduce((score, id) => score + DOMINO_TILES[id].a + DOMINO_TILES[id].b, 0);

function starterFor(hands: readonly (readonly number[])[]): { player: DominoPlayer; id: number } {
  let chosen = { player: 0 as DominoPlayer, id: hands[0][0] };
  let rank = -1;
  for (const player of [0, 1] as const) for (const id of hands[player]) {
    const tile = DOMINO_TILES[id];
    const score = tile.a === tile.b ? 100 + tile.a : tile.a + tile.b;
    if (score > rank) { rank = score; chosen = { player, id }; }
  }
  return chosen;
}

export function createDominoRound(round: number): DominoRound {
  if (!Number.isInteger(round) || round < 0) throw new Error('Invalid domino round');
  const deck = shuffled(0x31ab17 + round * 7919);
  const hands: [number[], number[]] = [deck.slice(0, 7), deck.slice(7, 14)];
  const { player, id } = starterFor(hands);
  const tile = DOMINO_TILES[id];
  hands[player] = hands[player].filter(item => item !== id);
  return {
    round, hands, stock: deck.slice(14),
    chain: [{ id, left: tile.a, right: tile.b, player }],
    turn: other(player), winner: null, award: { human: 0, ai: 0 },
    lastAction: player === 0 ? 'You opened with the highest tile.' : 'The village opponent opened with the highest tile.',
  };
}

function oriented(round: DominoRound, id: number, side: DominoSide): DominoPlaced | null {
  const tile = DOMINO_TILES[id];
  if (!tile) return null;
  const leftEnd = round.chain[0]?.left;
  const rightEnd = round.chain[round.chain.length - 1]?.right;
  if (leftEnd == null || rightEnd == null) return null;
  if (side === 'left') {
    if (tile.a === leftEnd) return { id, left: tile.b, right: tile.a, player: round.turn };
    if (tile.b === leftEnd) return { id, left: tile.a, right: tile.b, player: round.turn };
    return null;
  }
  if (tile.a === rightEnd) return { id, left: tile.a, right: tile.b, player: round.turn };
  if (tile.b === rightEnd) return { id, left: tile.b, right: tile.a, player: round.turn };
  return null;
}

export function dominoLegalMoves(round: DominoRound, player: DominoPlayer): { id: number; side: DominoSide }[] {
  if (round.winner !== null) return [];
  const temporary = { ...round, turn: player };
  return round.hands[player].flatMap(id =>
    (['left', 'right'] as const)
      .filter(side => oriented(temporary, id, side) !== null)
      .map(side => ({ id, side })));
}

function settle(winner: DominoWinner, round: DominoRound): DominoRound {
  const human = dominoPipSum(round.hands[0]);
  const ai = dominoPipSum(round.hands[1]);
  const points = winner === 'human' ? ai : winner === 'ai' ? human : 0;
  return {
    ...round,
    winner, award: { human: winner === 'human' ? points : 0, ai: winner === 'ai' ? points : 0 },
    lastAction: winner === 'draw' ? 'Blocked round tied on remaining pips.'
      : winner === 'human' ? 'You won the village round!' : 'The village opponent won the round.',
  };
}

function resolveBlocked(round: DominoRound): DominoRound {
  if (round.stock.length > 0 || dominoLegalMoves(round, 0).length ||
      dominoLegalMoves(round, 1).length) return round;
  const human = dominoPipSum(round.hands[0]), ai = dominoPipSum(round.hands[1]);
  return settle(human === ai ? 'draw' : human < ai ? 'human' : 'ai', round);
}

export function playDomino(round: DominoRound, player: DominoPlayer, id: number, side: DominoSide): DominoRound {
  if (round.winner !== null || round.turn !== player || !round.hands[player].includes(id)) {
    throw new Error('Domino move not permitted');
  }
  const piece = oriented(round, id, side);
  if (!piece) throw new Error('Illegal domino endpoint');
  const hands = [
    player === 0 ? round.hands[0].filter(item => item !== id) : [...round.hands[0]],
    player === 1 ? round.hands[1].filter(item => item !== id) : [...round.hands[1]],
  ] as [number[], number[]];
  const chain = side === 'left' ? [piece, ...round.chain] : [...round.chain, piece];
  let next: DominoRound = {
    ...round, hands, chain, turn: other(player),
    lastAction: player === 0 ? 'Placed a village domino.' : 'Opponent placed a domino.',
  };
  if (hands[player].length === 0) return settle(player === 0 ? 'human' : 'ai', next);
  next = resolveBlocked(next);
  return next;
}

export function drawDomino(round: DominoRound, player: DominoPlayer): DominoRound {
  if (round.winner !== null || round.turn !== player || round.stock.length === 0 ||
      dominoLegalMoves(round, player).length !== 0) throw new Error('Cannot draw domino');
  const drawn = round.stock[0];
  const hands = [
    player === 0 ? [...round.hands[0], drawn] : [...round.hands[0]],
    player === 1 ? [...round.hands[1], drawn] : [...round.hands[1]],
  ] as [number[], number[]];
  return {
    ...round, hands, stock: round.stock.slice(1),
    lastAction: player === 0 ? 'Drew one tile from stock.' : 'Opponent drew one tile from stock.',
  };
}

export function passDomino(round: DominoRound, player: DominoPlayer): DominoRound {
  if (round.winner !== null || round.turn !== player || round.stock.length > 0 ||
      dominoLegalMoves(round, player).length > 0) throw new Error('Pass not allowed');
  return resolveBlocked({ ...round, turn: other(player),
    lastAction: player === 0 ? 'You passed.' : 'Opponent passed.' });
}

export function takeDominoAiTurn(start: DominoRound): DominoRound {
  let round = start;
  if (round.winner !== null || round.turn !== 1) return round;
  // Strict bound: at most 14 stock draws plus one AI placement/pass.
  for (let step = 0; step <= DOMINO_TILES.length; step++) {
    const moves = dominoLegalMoves(round, 1);
    if (moves.length) {
      moves.sort((a, b) => {
        const x = DOMINO_TILES[a.id], y = DOMINO_TILES[b.id];
        return (y.a + y.b + (y.a === y.b ? 2 : 0)) -
          (x.a + x.b + (x.a === x.b ? 2 : 0)) || a.id - b.id;
      });
      return playDomino(round, 1, moves[0].id, moves[0].side);
    }
    if (round.stock.length === 0) return passDomino(round, 1);
    round = drawDomino(round, 1);
  }
  throw new Error('Domino AI failed bounded turn');
}

export function dominoChainValid(round: DominoRound): boolean {
  return round.chain.length > 0 && round.chain.every((tile, index) =>
    DOMINO_TILES[tile.id] !== undefined &&
    [tile.left, tile.right].sort().join(',') ===
      [DOMINO_TILES[tile.id].a, DOMINO_TILES[tile.id].b].sort().join(',') &&
    (index === 0 || round.chain[index - 1].right === tile.left));
}
