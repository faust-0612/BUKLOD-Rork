import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const release=read('.github/workflows/buklod-nov17-remaining-fixes-staging-ota.yml');
const manifest=JSON.parse(read('.buklod/scopes/nov17-remaining-fixes-staging-release.json'));
test('pin latest approved source and five merged PRs',()=>{
  assert.equal(manifest.baseRef,'66614852ea3163b6cb9eafdad2db3c02a8f7558a');
  assert.ok(release.includes('RELEASE_MAIN_SHA: 66614852ea3163b6cb9eafdad2db3c02a8f7558a'));
  assert.ok(release.includes('refs/heads/main | cut -f1'));
  for(const number of [900,905,906,910,912])assert.ok(release.includes('number:'+number+',head:'),String(number));
  assert.ok(release.includes('const target=index>=0?wallVideoPosts[index]:tappedPost;'));
  for(const name of ['wall-video-fullscreen-navigation-20261117','wall-network-feedback-20261117','wall-network-navigation-20261117','offline-global-sync-quiet-20261117'])assert.ok(release.includes(name));
});
test('Android staging isolation, idempotent publish and exact readback',()=>{
  assert.ok(release.includes('--channel staging-user --platform android'));
  assert.ok(release.includes('--environment preview'));
  assert.ok(release.includes("a.equal(app.runtimeVersion,'1.3.2')"));
  assert.ok(release.includes("a.equal(app.android.package,'org.mzbministry.buklod.staging')"));
  assert.ok(release.includes('assert.equal(production.id,pre.productionUpdateId'));
  assert.ok(release.includes('assert.equal(liveStage.id.toLowerCase(),u.id.toLowerCase())'));
  assert.ok(!release.includes('update --channel production'));
  assert.ok(!release.includes('eas submit'));
});
test('release branch has only source-unmodified declarative files',()=>{
  assert.deepEqual(manifest.allowedPaths.slice().sort(),['.buklod/scopes/nov17-remaining-fixes-staging-release.json','tests/nov17-remaining-fixes-staging-release.test.mjs','.github/workflows/buklod-nov17-remaining-fixes-staging-ota.yml'].sort());
  assert.ok(release.includes('assert.deepEqual(changed,requiredChanged'));
  assert.ok(release.includes('git diff --exit-code "$RELEASE_MAIN_SHA" "$GITHUB_SHA" -- src/ assets/ supabase/'));
  assert.ok(release.includes('git diff --exit-code "$APK_SOURCE" "$GITHUB_SHA"'));
  assert.ok(release.includes('EXPO_MAX_WORKERS=2 npx expo export --platform android'));
});