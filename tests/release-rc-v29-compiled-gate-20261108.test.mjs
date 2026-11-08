import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const flow=read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
const config=read('app.config.js');
const navHarness=read('scripts/test-bottom-nav-concurrency.cjs');
const nav=read('src/components/BuklodPersistentBottomNav.tsx');

test('V30 production uses runtime 1.3.2 and AAB code 30',()=>{
 assert.match(config,/version: isClassroom \|\| isStaging \? '1\.3\.4' : '1\.3\.6'/);
 assert.match(config,/versionCode: isStaging \? undefined : \(isClassroom \? 28 : 30\)/);
 assert.match(config,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
 assert.match(config,/org\.mzbministry\.buklod/);
});
test('compiled RC workflow checks exact branch, version, runtime and Android/web exports but never publishes',()=>{
 assert.match(flow,/github\.head_ref == 'dev\/wall-audio-gif-sponsor-nav-neon-20261108'/);
 assert.match(flow,/assert\.equal\(c\.android\.versionCode,30\)/);
 assert.match(flow,/assert\.equal\(c\.runtimeVersion,'1\.3\.2'\)/);
 assert.match(flow,/npx tsc --noEmit/);
 assert.match(flow,/npx expo export --platform android/);
 assert.match(flow,/npx expo export --platform web/);
 assert.doesNotMatch(flow,/eas update --branch|eas submit|eas build --platform/);
});
test('native nav concurrency harness mocks router.navigate, not obsolete replace',()=>{
 assert.match(nav,/buklodInstantNavigate\(/);
 assert.match(navHarness,/buklodInstantNavigate: route => events\.push/);
 assert.doesNotMatch(navHarness,/buklodInstantReplace: route/);
 assert.match(navHarness,/duplicate taps are suppressed/);
 assert.match(navHarness,/scope failure must not navigate/);
});
