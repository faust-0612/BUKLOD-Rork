import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Native-first game release remains staging-only and never exposes an OTA-only ABI swap',()=>{
 const config=read('app.config.js');
 const eas=JSON.parse(read('eas.json'));
 const arena=read('src/app/games/empire-arena.tsx');
 const manifest=read('modules/buklod-genesis-godot/android/src/main/AndroidManifest.xml');
 assert.match(config,/godotLaunchRecoveryPreview = libraryArenaNativePreview/);
 assert.match(config,/runtimeVersion: '2\.0\.5-genesis-godot-launch'/);
 assert.match(config,/versionCode: isStaging \? \(godotLaunchRecoveryPreview \? 17 : undefined\)/);
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build['season2-genesis-library-staging'].channel,'season2-genesis-library-preview');
 assert.equal(eas.build['season2-genesis-launch-recovery-staging'].channel,
  'season2-genesis-library-205-preview');
 assert.equal(eas.build['season2-genesis-launch-recovery-staging'].env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
 assert.match(manifest,/android:exported="false"/);
 assert.match(arena,/pending === 'pending' && !explicitRetry/);
});
