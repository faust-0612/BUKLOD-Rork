import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/word/index.tsx', import.meta.url), 'utf8');

test('The Word screen reserves the device top safe area', () => {
  assert.match(source, /import\s*\{\s*useSafeAreaInsets\s*\}\s*from\s*['"]react-native-safe-area-context['"]/);
  assert.match(source, /const insets = useSafeAreaInsets\(\);/);
  assert.match(source, /paddingTop:\s*insets\.top/);
});

test('The weekly empty state distinguishes no current-week publication from the archive', () => {
  assert.match(source, /No Word published this week yet/);
  assert.match(source, /Previous published Words remain below/);
});
