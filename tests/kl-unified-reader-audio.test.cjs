const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const reader = readFileSync('src/components/kabihasnang-ligaw/KlReaderScreen.tsx', 'utf8');
const audio = readFileSync('src/components/kabihasnang-ligaw/KlChapterAudio.tsx', 'utf8');
const copy = readFileSync('src/lib/kabihasnang-ligaw/copy.ts', 'utf8');
test('KL library has one catalog with server titles and no parallel chapter list', () => {
  assert.doesNotMatch(reader, /<KlDynamicLibrary\s*\/>/);
  assert.match(reader, /setReleasedChapters\(data as ReleasedChapter\[\]\)/);
  assert.match(reader, /displayChapterTitle\(episode, releasedChapters\.find/);
  assert.doesNotMatch(copy, /Sarado ang susunod hanggang maaprubahan/);
});
test('KL journey uses authenticated server completion instead of hardcoded zero', () => {
  assert.match(reader, /rpc\('kl_my_story_journey_v1'\)/);
  assert.match(reader, /journeySummary\(completedChapters \?\? 0, 30\)/);
  assert.doesNotMatch(reader, /journeySummary\(0, 30\)/);
});
test('KL chapter music autoplays once, loops, pauses on background and releases safely', () => {
  assert.match(reader, /<KlChapterAudio key=\{selected\.id\}[^>]*autoPlay/);
  assert.match(audio, /autoAttemptedRef\.current = true/);
  assert.match(audio, /player\.loop = true/);
  assert.match(audio, /AppState\.addEventListener\('change'/);
  assert.match(audio, /closeKlAudioPlayer\(player\)/);
});
test('KL chapter titles and screen avoid system bar overlap', () => {
  assert.match(reader, /paddingTop: 18 \+ insets\.top/);
  assert.match(reader, /Kabanata \$\{episode\.episodeNumber\}: \$\{name\}/);
  assert.match(reader, /const liveReleased = Boolean\(selected &&/);
  assert.match(reader, /<KlLiveDiscussion episodeId=\{selectedDbId \?\? klDatabaseId\(selected\.episodeNumber\)\}/);
  assert.match(reader, /const databaseIdForEpisode = \(episodeNumber: number\)/);
  assert.match(reader, /releasedNumbers\.has\(selected\.episodeNumber\)/);
});
