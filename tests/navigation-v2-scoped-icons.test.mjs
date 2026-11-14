import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Cluster and Organization 3-tab top nav retains icons, labels, and 48dp targets',()=>{
  const s=read('src/app/scope/index.tsx');
  assert.match(s,/accessibleRole="tab"|accessibilityRole="tab"/);
  assert.match(s,/accessibilityState=\{\{ selected: active \}\}/);
  assert.match(s,/size=\{blueWorkspaceTabs \? 16 : 18\}/);
  assert.match(s,/blueWorkspaceTabs && \{ minHeight: 48, borderRadius: 0,/);
  assert.match(s,/blueWorkspaceTabs && \{ color: active \? '#0874DE' : '#486E9E', fontSize: 13 \}/);
  assert.doesNotMatch(s,/!blueWorkspaceTabs && <MaterialCommunityIcons/);
});
test('scope access and onBack remain bound to existing authorized workspace',()=>{
  const s=read('src/app/scope/index.tsx');
  assert.match(s,/onBack=\{handleWorkspaceBack\}/);
  assert.match(s,/resolution.access !== 'authorized'/);
  assert.match(s,/visibleSections.map/);
  assert.match(s,/openSection\(/);
});
