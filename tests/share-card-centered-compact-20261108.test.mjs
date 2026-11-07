import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/components/BuklodPostInternalShare.tsx',import.meta.url),'utf8');

test('Share post opens a centered compact card, not a full-width bottom sheet',()=>{
  const backdrop=source.slice(source.indexOf('    backdrop: {'),source.indexOf('    sheet: {'));
  assert.match(backdrop,/justifyContent: 'center'/);
  assert.match(backdrop,/alignItems: 'center'/);
  assert.match(backdrop,/paddingHorizontal: 16/);
  const sheet=source.slice(source.indexOf('    sheet: {'),source.indexOf('    handle: {'));
  assert.match(sheet,/width: '100%'/);
  assert.match(sheet,/maxWidth: 460/);
  assert.match(sheet,/maxHeight: '72%'/);
  assert.match(sheet,/borderRadius: 20/);
  assert.doesNotMatch(sheet,/borderTopRightRadius/);
});

test('Many recipients scroll inside the centered dialog without hiding the controls',()=>{
  const list=source.slice(source.indexOf('    list: {'),source.indexOf('    listContent: {'));
  assert.match(list,/flexShrink: 1/);
  assert.match(list,/minHeight: 0/);
  assert.match(source,/keyboardShouldPersistTaps="handled"/);
  assert.match(source,/visibleTargets\.map\(/);
});

test('Tap-outside dismissal and existing real share server call are retained',()=>{
  assert.match(source,/onRequestClose=\{\s*closeSheet/);
  assert.match(source,/onPress=\{\s*closeSheet/);
  assert.match(source,/event\s*\.stopPropagation\(\)/);
  assert.match(source,/buklod_internal_share_post_v2/);
  assert.match(source,/Shared successfully to/);
  assert.match(source,/setOpen\(\s*true/);
});
