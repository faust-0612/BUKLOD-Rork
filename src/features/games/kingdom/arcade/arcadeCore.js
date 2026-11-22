'use strict';
// Pure, offline arcade mechanics. All rewards remain game-only: never mint BP, XP or cash.
const MODES = Object.freeze(['catch','lane','runner','rhythm','defend','tap','search','stack']);
function rand(s, max) {
  s.seed = ((Math.imul(s.seed, 1664525) + 1013904223) >>> 0);
  return s.seed % max;
}
function goalFor(stage) { return 8 + Math.floor(stage * 1.2); }
function startArcade(mode, seed, stage = 1, total = 0, lives = 3) {
  if (!MODES.includes(mode)) throw new Error('Unknown arcade mode');
  const s = {
    mode, seed: seed >>> 0, stage, score: total, stageHits: 0, goal: goalFor(stage),
    lives, combo: 0, lane: 1, jumpUntil: 0, jumpCooldownUntil: 0, lastActionTick: -20, ticks: 0, remaining: Math.max(170, 280 - stage * 4),
    entities: [], entitySeq: 0, marker: 0, markerDirection: 1, target: 2,
    cell: 0, flashUntil: 4, deadline: 13, eventSeq: 0, outcome: 'move', status: 'playing',
  };
  s.cell = rand(s, 9);
  return s;
}
function award(s, perfect = false) {
  s.combo = Math.min(30, s.combo + 1);
  s.score += (perfect ? 15 : 10) + Math.min(30, s.combo * 2);
  s.stageHits += 1;
  s.outcome = 'collect';
  s.eventSeq += 1;
}
function hurt(s) {
  s.lives = Math.max(0, s.lives - 1);
  s.combo = 0;
  s.outcome = 'impact';
  s.eventSeq += 1;
}
function check(s) {
  if (s.lives <= 0 || s.remaining <= 0) s.status = 'lost';
  else if (s.stageHits >= s.goal) s.status = 'clear';
  return s;
}
function nextCell(s) {
  const old = s.cell;
  const increment = 1 + rand(s, 8);
  s.cell = (old + increment) % 9;
  s.flashUntil = s.ticks + 4;
  s.deadline = s.ticks + Math.max(7, 13 - Math.floor(s.stage / 3));
}
function tickArcade(previous) {
  if (previous.status !== 'playing') return previous;
  const s = { ...previous, ticks: previous.ticks + 1, remaining: previous.remaining - 1,
    entities: previous.entities.map(e => ({ ...e })) };
  if (s.mode === 'tap' || s.mode === 'search') {
    if (s.ticks >= s.deadline) { hurt(s); nextCell(s); }
  } else if (s.mode === 'stack') {
    if (s.ticks % Math.max(1, 4 - Math.floor(s.stage / 3)) === 0) {
      const position = s.marker + s.markerDirection;
      if (position < 0 || position > 4) {
        s.markerDirection *= -1;
        s.marker += s.markerDirection;
      } else s.marker = position;
    }
  } else {
    const interval = Math.max(3, 8 - Math.floor(s.stage / 3));
    if (s.ticks % interval === 0 && s.entities.length < 9) {
      const lane = rand(s, 3);
      const good = s.mode === 'rhythm' ? true
        : s.mode === 'defend' ? false
        : rand(s, 5) !== 0;
      s.entities.push({ id: ++s.entitySeq, lane, y: 0, good, variant: rand(s, 3) });
    }
    const speed = Math.min(0.85, 0.19 + s.stage * 0.045);
    const kept = [];
    for (const e of s.entities) {
      e.y += speed;
      if (s.mode === 'rhythm' && e.y >= 6) { hurt(s); continue; }
      if (s.mode === 'defend' && e.y >= 6) { hurt(s); continue; }
      if (e.y >= 5.3) {
        if (e.lane === s.lane) {
          if (e.good) award(s);
          else if (!(s.mode === 'runner' && s.jumpUntil >= s.ticks)) hurt(s);
        }
        continue;
      }
      kept.push(e);
    }
    s.entities = kept;
  }
  return check(s);
}
function actArcade(previous, action, value) {
  if (previous.status !== 'playing') return previous;
  const s = { ...previous, entities: previous.entities.map(e => ({ ...e })) };
  if (action === 'left' && ['catch','lane','runner'].includes(s.mode)) {
    s.lane = Math.max(0, s.lane - 1); s.outcome = 'move'; s.eventSeq++; return s;
  }
  if (action === 'right' && ['catch','lane','runner'].includes(s.mode)) {
    s.lane = Math.min(2, s.lane + 1); s.outcome = 'move'; s.eventSeq++; return s;
  }
  if (action === 'jump' && s.mode === 'runner') {
    if (s.ticks < s.jumpCooldownUntil) return previous;
    s.jumpUntil = s.ticks + 5; s.jumpCooldownUntil = s.ticks + 13;
    s.outcome = 'move'; s.eventSeq++; return s;
  }
  if ((s.mode === 'tap' || s.mode === 'search') && action === 'cell') {
    if (!Number.isInteger(value) || value < 0 || value > 8 || s.ticks - s.lastActionTick < 3) return previous;
    s.lastActionTick = s.ticks;
    if (value === s.cell) award(s, true);
    else hurt(s);
    nextCell(s); return check(s);
  }
  if (s.mode === 'stack' && action === 'drop') {
    if (s.ticks - s.lastActionTick < 3) return previous;
    s.lastActionTick = s.ticks;
    const distance = Math.abs(s.marker - s.target);
    if (distance <= 1) award(s, distance === 0); else hurt(s);
    s.target = rand(s, 3) + 1;
    return check(s);
  }
  if ((s.mode === 'rhythm' || s.mode === 'defend') && action === 'lane') {
    if (!Number.isInteger(value) || value < 0 || value > 2) return s;
    const eligible = s.entities
      .filter(e => e.lane === value && e.y >= (s.mode === 'rhythm' ? 3.5 : 1.5) &&
        e.y <= 5.9)
      .sort((a, b) => b.y - a.y);
    if (eligible.length > 0) {
      const hit = eligible[0];
      s.entities = s.entities.filter(e => e.id !== hit.id);
      award(s, s.mode === 'rhythm' && hit.y > 4.4 && hit.y < 5.3);
    } else if (s.mode === 'rhythm') {
      // Early rhythm taps lose combo but not a life; beginners can learn by doing.
      s.combo = 0;
      s.outcome = 'move';
      s.eventSeq++;
    }
    return check(s);
  }
  return previous;
}
function nextArcadeStage(previous) {
  if (previous.status !== 'clear') return previous;
  return startArcade(previous.mode, previous.seed, previous.stage + 1,
    previous.score, Math.min(4, previous.lives + 1));
}
module.exports = { MODES, startArcade, tickArcade, actArcade, nextArcadeStage };
