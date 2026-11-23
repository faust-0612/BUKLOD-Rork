import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('New game runtime navigates directly to native Godot with a persistent restart safety gate',()=>{
 const route=read('src/app/games/empire-arena.tsx');
 const cfg=read('app.config.js');
 const eas=JSON.parse(read('eas.json'));
 assert.match(route,/return Platform\.OS === 'android' &&\s*process\.env\.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 === 'true'/);
 assert.match(route,/GODOT_ARENA_PENDING_KEY/);
 assert.match(route,/pending === 'pending' && !explicitRetry/);
 assert.match(route,/onPress=\{\(\) => setShowPractice\(true\)\}/);
 assert.match(cfg,/runtimeVersion: '2\.0\.5-genesis-godot-launch'/);
 assert.match(cfg,/versionCode: isStaging \? \(godotLaunchRecoveryPreview \? 17 : undefined\)/);
 assert.equal(eas.build['season2-genesis-launch-recovery-staging'].channel,
  'season2-genesis-library-205-preview');
 assert.equal(eas.build.production.channel,'production');
});
