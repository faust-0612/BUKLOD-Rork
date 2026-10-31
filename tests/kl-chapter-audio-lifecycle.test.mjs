import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { closeKlAudioPlayer, runKlAudioCommand } from '../src/lib/kabihasnang-ligaw/audioPlayerLifecycle.ts';

const component = readFileSync(new URL('../src/components/kabihasnang-ligaw/KlChapterAudio.tsx', import.meta.url), 'utf8');

test('explicit Expo player cleanup pauses before releasing and preserves release on pause failures', () => {
  const actions = [];
  closeKlAudioPlayer({ pause() { actions.push('pause'); }, release() { actions.push('release'); } });
  assert.deepEqual(actions, ['pause', 'release']);
  const failureActions = [];
  assert.doesNotThrow(() => closeKlAudioPlayer({
    pause() { failureActions.push('pause'); throw new Error('native object missing'); },
    release() { failureActions.push('release'); },
  }));
  assert.deepEqual(failureActions, ['pause', 'release']);
  assert.doesNotThrow(() => closeKlAudioPlayer(null));
  assert.doesNotThrow(() => closeKlAudioPlayer({ pause() { throw Error('gone'); }, release() { throw Error('gone'); } }));
});

test('user-triggered native command failures are contained', () => {
  assert.equal(runKlAudioCommand(() => undefined), true);
  assert.equal(runKlAudioCommand(() => { throw Error('released'); }), false);
});

test('KL has scoped render fallback, no empty player, and no late hook cleanup', () => {
  assert.match(component, /if \(!music && !ambient\)/);
  assert.match(component, /<ChapterAudioBoundary>/);
  assert.match(component, /createAudioPlayer\(null\)/);
  assert.match(component, /closeKlAudioPlayer\(player\)/);
  assert.doesNotMatch(component, /useAudioPlayer\(/);
  assert.match(component, /BUKLOD_KL_AUDIO_RENDER_EXCEPTION/);
});
