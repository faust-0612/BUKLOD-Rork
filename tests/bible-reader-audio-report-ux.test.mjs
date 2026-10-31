import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseBibleNarrationVoice } from '../src/lib/buklodBibleVoiceLocale.ts';
import { bibleReportErrorMessage } from '../src/lib/bibleReportErrors.ts';

const reader = readFileSync('src/app/bible/read.tsx', 'utf8');
const report = readFileSync('src/app/bible/report.tsx', 'utf8');
const engine = readFileSync('src/lib/buklodBibleNarrationEngine.ts', 'utf8');

test('ASD Filipino never silently falls back to an English voice', () => {
  assert.equal(chooseBibleNarrationVoice([{ language: 'en-US', identifier: 'en' }], 'fil-PH').available, false);
  const tagalog = chooseBibleNarrationVoice([{ language: 'en-US', identifier: 'en' }, { language: 'tl-PH', identifier: 'tagalog' }], 'fil-PH');
  assert.equal(tagalog.available, true);
  assert.equal(tagalog.voice?.identifier, 'tagalog');
  assert.equal(tagalog.language, 'tl-PH');
  assert.equal(chooseBibleNarrationVoice([{ language: 'en-US', identifier: 'en' }], 'en-US').available, true);
  assert.match(engine, /Filipino voice unavailable/);
  assert.match(engine, /language: this\.speechLanguage \|\| this\.snapshot\.language/);
});

test('My Bible one-tap listen, pause and resume keep advanced settings optional', () => {
  assert.match(reader, /key:'listen'.*title:bibleNarration\.status/s);
  assert.match(reader, /void playBibleNarration\(\{/);
  assert.match(reader, /void pauseBibleNarration\(\)/);
  assert.match(reader, /void resumeBibleNarration\(\)/);
  assert.match(reader, /onLongPress=\{item\.key === 'listen'/);
  assert.match(reader, /\(!isMyBibleMode \|\| showBibleAudio\)/);
  assert.doesNotMatch(reader, /showBibleAudio \|\| bibleNarration\.status !== 'idle'/);
});

test('Bible verses expand fully and move actions to long-press menu', () => {
  assert.match(reader, /onLongPress=\{isMyBibleMode \? \(\) => openBibleAnnotation/);
  assert.match(reader, /flexGrow: 0,\s+flexShrink: 0,\s+width: '100%'/);
  assert.doesNotMatch(reader, /accessibilityLabel=\{\`Komento sa talata/);
  assert.match(reader, /accessibilityLabel="I-share ang napiling talata"/);
  assert.match(reader, /<BuklodKjvStrongText/);
  assert.match(reader, /setHenryVerse\(Number\(verse\.verse_no\)\)/);
});

test('Bible report handles SSL errors without fake zeros or cross-account saved data', () => {
  assert.match(report, /getOfflineCache</);
  assert.match(report, /userId, allowStale: true/);
  assert.match(report, /reportError && !report\) \? null/);
  assert.match(report, /onPress=\{\(\) => void load\(\)\}/);
  const warning = bibleReportErrorMessage(new Error('javax.net.ssl.SSLHandshakeException: Trust anchor for certification path not found.'));
  assert.match(warning, /SSL\/certificate/);
  assert.match(warning, /Hindi ligtas na i-disable/);
  assert.match(bibleReportErrorMessage(new Error('fetch failed')), /Hindi makontak/);
});
