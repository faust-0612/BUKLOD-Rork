import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Empire independent native package, no MAIN overwrite or Expo',()=>{
 const gradle=read('apps/buklod-empire/app/build.gradle');
 assert.match(gradle,/applicationId 'org\.mzbministry\.buklod\.empire'/);
 assert.match(gradle,/org\.godotengine:godot:4\.7\.2\.stable/);
 assert.match(gradle,/arm64-v8a/);
 assert.doesNotMatch(gradle,/expo|react-native/i);
 const host=read('apps/buklod-empire/app/src/main/java/org/mzbministry/buklod/empire/EmpireActivity.java');
 assert.match(host,/return new ArrayList<>\(\)/);
 assert.doesNotMatch(host,/getIntent\(|add\("--main-pack"\)|add\("--scene"\)/);
 const m=read('apps/buklod-empire/app/src/main/AndroidManifest.xml');
 assert.match(m,/android.permission.INTERNET/);
 assert.match(m,/android:usesCleartextTraffic="false"/);
});
test('same game asset inventory and no local economic authority',()=>{
 const s=read('scripts/build-buklod-empire-standalone.mjs');
 for(const token of ['scripts/build-empire-godot-pack.mjs','m.models.length,22','audio.count,70','kingdom-items','liveRewards:false','backendProjectCreated:false'])assert.ok(s.includes(token),token);
 const session=read('apps/buklod-empire/game/empire_session.gd');
 for(const world of ['arena','kingdom','house','community'])assert.ok(session.includes('"'+world+'"'));
 assert.match(session,/await RenderingServer\.frame_post_draw/);
 assert.doesNotMatch(session,/HTTPRequest|supabase|service_role|grant_bp|wallet/);
});
