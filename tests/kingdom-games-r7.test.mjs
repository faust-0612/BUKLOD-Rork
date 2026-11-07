import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  createMazeRun, makeMazeLevel, mazeNeighbors, mazeReachable, moveMaze, MAZE_SPECS,
} from '../src/features/games/jawo/trailMazeRules.ts';
import {
  PAIR_LEVELS, createPairRound, flipPair, settlePairMismatch,
} from '../src/features/games/trudice/picturePairsRules.ts';
import {
  VAULT_LEVELS, vaultHasSolution, vaultCombine, createVaultRound, applyVaultMove,
} from '../src/features/games/angel/numberVaultRules.ts';

const positionKey = ({ row, col }) => row + ':' + col;

function route(board, start, destination) {
  const queue = [start];
  const seen = new Set([positionKey(start)]);
  const back = new Map();
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    if (positionKey(from) === positionKey(destination)) break;
    for (const cell of mazeNeighbors(board, from)) {
      const id = positionKey(cell);
      if (!seen.has(id)) {
        seen.add(id);
        back.set(id, from);
        queue.push(cell);
      }
    }
  }
  assert.ok(seen.has(positionKey(destination)), 'path must exist');
  const result = [destination];
  while (positionKey(result[0]) !== positionKey(start)) {
    result.unshift(back.get(positionKey(result[0])));
  }
  return result;
}

test('Jawo Maze: 3 reproducible connected mazes with reachable exit/relics and wall boundary safety', () => {
  assert.equal(MAZE_SPECS.length, 3);
  for (let level = 0; level < MAZE_SPECS.length; level++) {
    const board = makeMazeLevel(level);
    assert.deepEqual(makeMazeLevel(level), board);
    assert.equal(board.grid.length, MAZE_SPECS[level].size);
    assert.ok(board.grid.every(line => line.length === board.size));
    assert.equal(board.grid[1][1], 0);
    assert.equal(board.grid[board.exit.row][board.exit.col], 0);
    const reachable = mazeReachable(board);
    assert.ok(reachable.has(positionKey(board.exit)));
    assert.equal(board.relics.length, MAZE_SPECS[level].relics);
    assert.equal(new Set(board.relics.map(positionKey)).size, board.relics.length);
    for (const cell of board.relics) assert.ok(reachable.has(positionKey(cell)));
    assert.ok(board.grid[0].every(value => value === 1), 'outer boundary walls');
  }
  assert.throws(() => createMazeRun(-1), /Invalid/);
  assert.throws(() => createMazeRun(3), /Invalid/);
});

test('Jawo Maze: actually collect every relic and exit using legal moves, never mutate source', () => {
  for (let index = 0; index < MAZE_SPECS.length; index++) {
    let run = createMazeRun(index);
    let moves = 0;
    for (const destination of [...run.board.relics, run.board.exit]) {
      const steps = route(run.board, run.position, destination);
      for (let i = 1; i < steps.length; i++) {
        const prior = run;
        const from = steps[i - 1], to = steps[i];
        const dr = to.row - from.row, dc = to.col - from.col;
        const direction = dr === 1 ? 'down' : dr === -1 ? 'up' : dc === 1 ? 'right' : 'left';
        run = moveMaze(prior, direction);
        assert.equal(prior.position.row, from.row, 'old state unchanged');
        assert.equal(prior.position.col, from.col, 'old state unchanged');
        assert.notEqual(run, prior, 'move must be legal');
        moves++;
      }
    }
    assert.equal(run.status, 'won');
    assert.equal(run.found.length, run.board.relics.length);
    assert.equal(run.moves, moves);
    assert.ok(run.score > 0);
    assert.throws(() => moveMaze(run, 'up'), /finished/);
  }
});

test('Trudice Picture Pairs: seeded shuffle, exact pairs, mismatch delay-safe and no double-awards', () => {
  assert.equal(PAIR_LEVELS.length, 3);
  for (let level = 0; level < PAIR_LEVELS.length; level++) {
    let game = createPairRound(level);
    assert.deepEqual(createPairRound(level), game);
    assert.equal(game.deck.length, PAIR_LEVELS[level].pairs * 2);
    assert.equal(new Set(game.deck.map(x => x.id)).size, game.deck.length);
    const symbols = new Map();
    for (const card of game.deck) symbols.set(card.symbol, (symbols.get(card.symbol) ?? 0) + 1);
    assert.equal(symbols.size, PAIR_LEVELS[level].pairs);
    assert.ok([...symbols.values()].every(count => count === 2));
    const a = game.deck[0], b = game.deck.find(card => card.symbol !== a.symbol);
    const started = flipPair(game, a.id);
    const mismatch = flipPair(started, b.id);
    assert.equal(mismatch.misses, 1);
    assert.equal(mismatch.turns, 1);
    assert.deepEqual(mismatch.up, [a.id, b.id]);
    assert.equal(flipPair(mismatch, game.deck[1].id), mismatch, 'locked while mismatch flips');
    assert.equal(settlePairMismatch(mismatch, [a.id, -1]), mismatch, 'stale settle cannot flip new cards');
    game = settlePairMismatch(mismatch, mismatch.up);
    assert.deepEqual(game.up, []);
    for (const symbol of symbols.keys()) {
      const matches = game.deck.filter(card => card.symbol === symbol);
      const before = game;
      game = flipPair(flipPair(game, matches[0].id), matches[1].id);
      assert.equal(before.matched.length + 2, game.matched.length);
      assert.equal(before.matched.includes(matches[0].id), false);
    }
    assert.equal(game.status, 'won');
    assert.equal(game.matched.length, game.deck.length);
    assert.ok(game.score > 0);
    assert.equal(flipPair(game, a.id), game);
  }
});

test('Angel Number Vault: three authored target puzzles have actual whole-number solutions', () => {
  assert.equal(VAULT_LEVELS.length, 3);
  for (const { values, target } of VAULT_LEVELS) {
    assert.equal(vaultHasSolution(values, target), true, target + ' must be reachable');
  }
  assert.equal(vaultCombine(8, 4, '÷'), 2);
  assert.equal(vaultCombine(7, 2, '÷'), null);
  assert.equal(vaultCombine(3, 0, '÷'), null);
  assert.equal(vaultCombine(5, 4, '×'), 20);
  assert.equal(vaultCombine(1, 5, '-'), -4);
  assert.equal(vaultCombine(10000, 2, '×'), null);

  let one = createVaultRound(0);
  const first = one;
  one = applyVaultMove(one, 3, 2, '×'); // 5 × 4 = 20
  one = applyVaultMove(one, 4, 1, '-'); // 20 - 3 = 17
  one = applyVaultMove(one, 5, 0, '+'); // 17 + 2 = 19
  assert.equal(one.status, 'won');
  assert.equal(one.tiles[0].value, 19);
  assert.equal(first.tiles.length, 4, 'source unchanged');

  let two = createVaultRound(1);
  two = applyVaultMove(two, 2, 1, '×'); // 7*5=35
  two = applyVaultMove(two, 0, 3, '×'); // 3*2=6
  two = applyVaultMove(two, 4, 5, '-'); // 35-6=29
  assert.equal(two.status, 'won');

  let three = createVaultRound(2);
  three = applyVaultMove(three, 2, 1, '×'); // 8*6=48
  three = applyVaultMove(three, 0, 3, '+'); // 4+3=7
  three = applyVaultMove(three, 4, 5, '-'); // 48-7=41
  assert.equal(three.status, 'won');
  assert.throws(() => applyVaultMove(three, 4, 5, '+'), /already ended/);
  assert.throws(() => createVaultRound(3), /Invalid/);
  assert.throws(() => applyVaultMove(first, 0, 0, '+'), /distinct/);
  assert.throws(() => applyVaultMove(first, 0, 100, '+'), /Unavailable/);
});

test('Kingdom R7 stations preserve originals, preview isolation, same 13-position map and in-app route', () => {
  const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
  const sha = createHash('sha1').update('blob ' + Buffer.byteLength(map) + '\0').update(map).digest('hex');
  assert.equal(sha, '88a4b1b4a70fc4acd59579419058b47f21be2554');
  const cases = [
    ['src/app/games/jawo-forest-trail.tsx', 'ForestTrailGameV2', 'TrailMazeGameV1'],
    ['src/app/games/trudice-playground-memory.tsx', 'PlaygroundPathGameV2', 'PicturePairsGameV1'],
    ['src/app/games/angel-kingdom-treasury.tsx', 'KingdomTreasuryGameV1', 'NumberVaultGameV1'],
  ];
  for (const [path, original, added] of cases) {
    const source = read(path);
    assert.ok(source.includes(original) && source.includes(added));
    assert.ok(source.includes('KingdomInteriorCenter'));
    assert.ok(source.includes('BuklodGameStage'));
  }
  for (const path of [
    'src/features/games/jawo/TrailMazeGameV1.tsx',
    'src/features/games/trudice/PicturePairsGameV1.tsx',
    'src/features/games/angel/NumberVaultGameV1.tsx',
  ]) {
    const source = read(path);
    assert.ok(source.includes('reward: { xp: 0, kingdomXp: 0 }'));
    assert.ok(!source.includes('supabase.') && !source.includes('.rpc('));
  }
  const catalog = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
  const all = catalog.characters.flatMap(c => c.games);
  assert.equal(catalog.characters.length, 13);
  assert.equal(all.length, 39);
  assert.equal(all.filter(g => g.status === 'existing').length, 13);
  assert.equal(all.filter(g => g.status === 'pilot').length, 9);
  assert.equal(all.filter(g => g.status === 'planned').length, 17);
});
