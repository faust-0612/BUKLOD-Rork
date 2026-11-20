import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('native build must verify actual Expo resolver, not merely inventory strings',()=>{
 const script=read('scripts/genesis-assert-native-autolinking.mjs');
 for(const module of ['native-ime','play-updates','media3','godot','drive-auth'])
   assert.ok(script.includes('genesis-'+module),'module absent '+module);
 assert.match(script,/execFileSync\(bin,\['resolve','--platform','android','--json'\]/);
 assert.match(script,/found\.length!==1/);
 assert.match(script,/pkg==='@buklod\/genesis-native-ime' \? 'buklod-genesis-ime'/);
 assert.match(script,/Expo autolinking includes all five/);
 const smoke=read('.github/workflows/genesis-android-compile-smoke-20261120.yml');
 const signed=read('.github/workflows/genesis-season2-staging-release-apk-20261120.yml');
 for(const workflow of [smoke,signed]){
   assert.match(workflow,/node scripts\/genesis-assert-native-autolinking\.mjs/);
   assert.match(workflow,/npm ci --ignore-scripts --no-audit --no-fund/);
   assert.ok(workflow.indexOf('npm ci --ignore-scripts') < workflow.indexOf('node scripts/genesis-assert-native-autolinking.mjs'));
 }
});
