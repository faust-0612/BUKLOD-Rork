import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectCurrentWeekWord,
  selectPreviousWords,
} from '../src/lib/buklodWordSchedule.ts';

const word = (id, publish_date, sort_order = 1) => ({
  id,
  title: id,
  bible_passage: null,
  publish_date,
  sort_order,
});

test('selects the latest published daily Word in the current week', () => {
  const selected = selectCurrentWeekWord([
    word('monday', '2026-11-02'),
    word('tuesday', '2026-11-03'),
    word('older-week', '2026-10-31'),
  ], '2026-11-02', '2026-11-03');
  assert.equal(selected?.id, 'tuesday');
});

test('does not fall back to a previous week when the current week has no Word', () => {
  const selected = selectCurrentWeekWord([
    word('last-week', '2026-10-31'),
  ], '2026-11-02', '2026-11-03');
  assert.equal(selected, null);
});

test('does not expose future-dated cached publications', () => {
  const selected = selectCurrentWeekWord([
    word('tomorrow', '2026-11-04'),
    word('today', '2026-11-03'),
  ], '2026-11-02', '2026-11-03');
  assert.equal(selected?.id, 'today');
});

test('uses the lowest lesson order when multiple rows share one date', () => {
  const selected = selectCurrentWeekWord([
    word('later-order', '2026-11-03', 2),
    word('first-order', '2026-11-03', 1),
  ], '2026-11-02', '2026-11-03');
  assert.equal(selected?.id, 'first-order');
});

test('keeps earlier daily Words newest-first without duplicate publication dates', () => {
  const archive = selectPreviousWords([
    word('today-featured-duplicate', '2026-11-03'),
    word('yesterday', '2026-11-02'),
    word('yesterday-duplicate', '2026-11-02', 2),
    word('sunday', '2026-11-01'),
    word('future', '2026-11-04'),
  ], word('featured', '2026-11-03'), '2026-11-03');
  assert.deepEqual(archive.map(item => item.id), ['yesterday', 'sunday']);
});

test('deduplicates repeated ids and respects the archive limit', () => {
  const archive = selectPreviousWords([
    word('one', '2026-11-02'),
    word('one', '2026-11-02'),
    word('two', '2026-11-01'),
  ], null, '2026-11-03', 1);
  assert.deepEqual(archive.map(item => item.id), ['one']);
});
