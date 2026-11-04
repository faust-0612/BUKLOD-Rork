const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');

test('shared dashboard header is compact but preserves status-bar safe area and actions', () => {
  const source = read('src/app/(tabs)/_layout.tsx');
  assert.match(source, /paddingTop: insets\.top/);
  assert.match(source, /minHeight: 44 \+ insets\.top/);
  assert.match(source, /fontSize: 23/);
  assert.match(source, /BuklodHeaderSponsor/);
  assert.match(source, /accessibilityLabel=\{\s*unreadCount > 0/);
  assert.match(source, /router\.push\(\s*'\/notifications'/);
});

test('Daily Encouragement strip reduces vertical footprint without dropping message or reference', () => {
  const source = read('src/components/BuklodPublicDailyMessageBar.tsx');
  assert.match(source, /paddingVertical: 5/);
  assert.match(source, /width: 30,[\s\S]*?height: 30/);
  assert.match(source, /TODAY'S ENCOURAGEMENT/);
  assert.match(source, /verse\.text/);
  assert.match(source, /verse\.reference/);
  assert.match(source, /buklodLanguageLabel/);
});
