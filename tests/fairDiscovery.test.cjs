const test = require('node:test');
const assert = require('node:assert/strict');
const { arrangeCommunityForFairDiscovery } = require('../src/lib/buklodFairDiscovery.ts');

function makePost(id, author, following = false, reactions = 4) {
  return { id, user_id: author, is_following_author: following,
    total_reactions: reactions, comment_count: 0 };
}

test('reorders a page without dropping or duplicating a post', () => {
  const input = Array.from({ length: 40 }, (_, i) =>
    makePost(`p${i}`, `a${i % 13}`, i % 4 === 0, i % 3 === 0 ? 0 : 8));
  const ordered = arrangeCommunityForFairDiscovery(input);
  assert.equal(ordered.length, input.length);
  assert.deepEqual(ordered.map(p => p.id).sort(), input.map(p => p.id).sort());
  assert.deepEqual(arrangeCommunityForFairDiscovery(input), ordered);
  assert.deepEqual(input.map(p => p.id), Array.from({ length: 40 }, (_, i) => `p${i}`));
});

test('gives low-engagement posts and followed authors early opportunities', () => {
  const input = Array.from({ length: 20 }, (_, i) =>
    makePost(`p${i}`, `author${i}`, i >= 12 && i < 17, i >= 17 ? 0 : 20));
  const firstTen = arrangeCommunityForFairDiscovery(input).slice(0, 10);
  assert.ok(firstTen.some(p => p.is_following_author));
  assert.ok(firstTen.some(p => p.total_reactions === 0));
});

test('spreads authors when alternatives exist', () => {
  const input = [
    ...Array.from({ length: 6 }, (_, i) => makePost(`a${i}`, 'same')),
    ...Array.from({ length: 10 }, (_, i) => makePost(`b${i}`, `other${i}`)),
  ];
  const ordered = arrangeCommunityForFairDiscovery(input);
  // Toward the tail, repeated authors are unavoidable once alternatives run out.
  for (let i = 0; i < 9; i++) {
    if (ordered[i].user_id !== 'same') continue;
    assert.equal(ordered.slice(i + 1, i + 4).some(p => p.user_id === 'same'), false);
  }
});

test('handles empty and one-item pages', () => {
  assert.deepEqual(arrangeCommunityForFairDiscovery([]), []);
  assert.deepEqual(arrangeCommunityForFairDiscovery([makePost('1','a')]), [makePost('1','a')]);
});
