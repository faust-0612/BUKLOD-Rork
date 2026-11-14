import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('direct and scoped Connect composer follows Android font scale with keyboard controls intact',()=>{
  const c=read('src/components/connect/ConnectComposer.tsx');
  assert.match(c, /const \{ fontScale, height \} = useWindowDimensions\(\)/);
  assert.match(c, /buklodComposerHeightLimits\(fontScale, height, 'message'\)/);
  assert.match(c, /<TextInput\s+allowFontScaling/);
  assert.match(c, /style=\{\[styles\.input, inputSize\]\}/);
  assert.match(c, /onOpenComposerPicker/);
  assert.match(c, /onSend/);
});
test('Wall/Cluster/Organization comments share responsive real text field and keep animated GIF preview',()=>{
  const c=read('src/components/BuklodCommunityCommentComposer.tsx');
  const field=read('src/components/BuklodMentionField.tsx');
  assert.match(c, /buklodComposerHeightLimits\(fontScale, height, 'comment'\)/);
  assert.match(c, /style=\{\[styles\.input, inputSize\]\}/);
  assert.match(field, /multiline\s+allowFontScaling/);
  assert.match(c, /<ExpoImage[\s\S]*?source=\{\{ uri: previewUri \}\}/);
  assert.match(c, /accessibilityLabel="Remove attachment"/);
  assert.match(c, /accessibilityLabel=\{busy \? 'Posting comment' : 'Send comment'\}/);
});
