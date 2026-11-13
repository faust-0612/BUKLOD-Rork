import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createMaritesVisibilityScheduler, resolveBuklodWallMaritesVideoPriority } from '../src/lib/buklodMaritesViewportMeasure.ts';

function fakeClock() {
  let time = 0;
  let serial = 0;
  const tasks = new Map();
  return {
    now: () => time,
    schedule(callback, delayMs) {
      const id = ++serial;
      tasks.set(id, { callback, at: time + delayMs });
      return id;
    },
    cancel(id) { tasks.delete(id); },
    advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].callback();
      }
      time = end;
    },
    pending: () => tasks.size,
  };
}

test('Wall 60Hz scroll burst coalesces Marites measurements without stalling visibility', () => {
  const clock = fakeClock();
  const calls = [];
  const scheduler = createMaritesVisibilityScheduler(() => calls.push(clock.now()), clock);
  for (let i = 0; i < 60; i++) {
    scheduler.request();
    clock.advance(16);
  }
  assert.equal(calls[0], 0, 'first visibility calculation is immediate');
  assert.ok(calls.length >= 9 && calls.length <= 11, '60 scroll frames should not mean 60 native measures');
  assert.ok(calls.every((at, i) => i === 0 || at - calls[i - 1] >= 96));
  scheduler.cancel();
  assert.equal(clock.pending(), 0);
});

test('Focus blur/overlay change flushes immediately and invalidates pending scroll work', () => {
  const clock = fakeClock();
  const calls = [];
  const scheduler = createMaritesVisibilityScheduler(() => calls.push(clock.now()), clock);
  scheduler.request();
  clock.advance(20);
  scheduler.request();
  assert.equal(clock.pending(), 1);
  scheduler.flush();
  assert.deepEqual(calls, [0, 20]);
  assert.equal(clock.pending(), 0);
  clock.advance(200);
  assert.deepEqual(calls, [0, 20], 'old pending work must not run');
});

test('Unmount and quick remount cancel delayed measurements; idempotent cleanup', () => {
  const clock = fakeClock();
  let calls = 0;
  const first = createMaritesVisibilityScheduler(() => calls++, clock);
  first.request();
  clock.advance(10);
  first.request();
  first.cancel();
  first.cancel();
  clock.advance(300);
  assert.equal(calls, 1);
  const second = createMaritesVisibilityScheduler(() => calls++, clock);
  second.request();
  assert.equal(calls, 2);
  second.cancel();
});

test('Wall navigation and player priority preserve video pause, ads and Marites behavior', () => {
  const wall = fs.readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
  const board = fs.readFileSync(new URL('../src/components/BuklodMaritesBoard.tsx', import.meta.url), 'utf8');
  assert.match(wall, /playbackBlocked=\{videoPriority\.maritesBlocked\}/);
  assert.match(wall, /onViewerVisibilityChange=\{setMaritesViewerOpen\}/);
  assert.match(wall, /visibleVideoPostId===postId &&\s*videoPriority\.wallVideoEligible/);
  assert.match(wall, /preloadVideoPostId===postId &&\s*videoPriority\.wallVideoEligible/);
  assert.match(wall, /maritesVisibilityRefreshRef\.current\?\.\(\)/, 'Wall scroll still requests visibility updates');
  assert.match(wall, /<FlashList/);
  assert.match(wall, /<BuklodCommunityInlineAd/);
  assert.match(board, /createMaritesVisibilityScheduler/);
  assert.match(board, /measurementSchedulerRef\.current\?\.flush\(\)/, 'focus state transitions must not be throttled');
  assert.match(board, /onLayout=\{requestVisibilityMeasurement\}/);
  assert.match(board, /setInterval\(requestVisibilityMeasurement, 750\)/);
  assert.match(board, /autoPlayVideo=\{canPlayInline && index === visibleVideoIndex\}/);
  assert.match(board, /measurementSchedulerRef\.current\?\.cancel\(\)/, 'unmount must cancel pending measurements');
  assert.match(board, /if \(autoPlay && active\) player\.play\(\)/);
  assert.match(board, /else player\.pause\(\)/);
});

test('fullscreen Marites viewer preempts Wall video and restores story sound', () => {
  const base = { wallFocused: true, wallVideoVisible: true, wallFullscreenOpen: false,
    commentOpen: false, maritesViewerOpen: false };
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority(base),
    { wallVideoEligible: true, maritesBlocked: true });
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({ ...base, maritesViewerOpen: true }),
    { wallVideoEligible: false, maritesBlocked: false });
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({ ...base, maritesViewerOpen: true, commentOpen: true }),
    { wallVideoEligible: false, maritesBlocked: true });
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({ ...base, maritesViewerOpen: true, wallFocused: false }),
    { wallVideoEligible: false, maritesBlocked: true });
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({ ...base, wallFullscreenOpen: true }),
    { wallVideoEligible: false, maritesBlocked: true });
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({ ...base, wallVideoVisible: false }),
    { wallVideoEligible: true, maritesBlocked: false });
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority(base),
    { wallVideoEligible: true, maritesBlocked: true }, 'closing viewer restores Wall eligibility');
});

test('viewer open/close/expiry/unmount coordinate playback and prevent Wall music resumption', () => {
  const wall = fs.readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
  const board = fs.readFileSync(new URL('../src/components/BuklodMaritesBoard.tsx', import.meta.url), 'utf8');
  assert.match(board, /onViewerVisibilityChange\?\.\(true\)/);
  assert.match(board, /onViewerVisibilityChange\?\.\(false\)/);
  assert.match(board, /onViewerVisibilityChange\?\.\(maritesViewerVisible\)/);
  assert.match(board, /useEffect\(\(\) => \(\) => onViewerVisibilityChange\?\.\(false\)/);
  assert.match(wall, /if\(maritesViewerOpen\)wallAudioForVisibility\.current\(\)/);
  assert.match(wall, /communityComposerOpen\|\|maritesViewerOpen\|\|visibleVideoPostId/);
  assert.match(wall, /peekDzasPlaying\(\)\|\|maritesViewerOpen/);
});
