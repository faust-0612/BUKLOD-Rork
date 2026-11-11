import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const board = readFileSync('src/components/BuklodMaritesBoard.tsx', 'utf8');
const library = readFileSync('src/lib/buklodMaritesBoard.ts', 'utf8');
const audio = readFileSync('src/components/BuklodMaritesStoryAudio.tsx', 'utf8');

test('Marites feed and draft previews are silent', () => {
  assert.match(board, /<MaritesQuickVideo uri=\{story\.video_uri!\} autoPlay muted/);
  assert.match(board, /<MaritesQuickVideo uri=\{quickVideo\.uri\} muted/);
});
test('soundtrack loads for the opened story and is scoped to Full View', () => {
  assert.match(board, /loadBuklodPostCreatives\(\[postId\]\)/);
  assert.match(board, /active=\{playbackActive && !playbackBlocked && !composerOpen && !musicPickerOpen && viewerMusicEnabled/);
  assert.match(board, /viewerMusic\?\.storyId === viewStory\.id/);
  assert.match(board, /onInterrupted=\{\(\) => setViewerMusicEnabled\(false\)\}/);
});
test('story composer persists approved music on shared post and offline fallback', () => {
  assert.match(library, /music_track: input\.musicTrack \?\? null/);
  assert.match(library, /await saveBuklodPostCreative\(/);
  assert.match(library, /return \{ story: sharedStory, shared: true, musicError \}/);
});
test('music player is lazy, bounded, cancellable and releases its decoder', () => {
  assert.match(audio, /if \(!active \|\| !track\)/);
  assert.match(audio, /if \(disposed\) return/);
  assert.match(audio, /Date\.now\(\) - begin < 6500/);
  assert.match(audio, /player\.release\(\)/);
  assert.match(audio, /owner !== 'marites-story'/);
  assert.match(audio, /clipStart \+ 30/);
});
