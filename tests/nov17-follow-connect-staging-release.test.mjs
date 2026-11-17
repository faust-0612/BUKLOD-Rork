import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const release=read('.github/workflows/buklod-nov17-follow-connect-staging-ota.yml');
const manifest=JSON.parse(read('.buklod/scopes/nov17-follow-connect-staging-release.json'));
test('pin latest approved source and seven merged PRs',()=>{
  assert.equal(manifest.baseRef,'0ee57887c991d23472cdf1f9b849bce945792910');
  assert.ok(release.includes('RELEASE_MAIN_SHA: 0ee57887c991d23472cdf1f9b849bce945792910'));
  assert.ok(release.includes('refs/heads/main | cut -f1'));
  for(const number of [900,905,906,910,912,913,914])assert.ok(release.includes('number:'+number+',head:'),String(number));
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
  assert.deepEqual(manifest.allowedPaths.slice().sort(),['.buklod/scopes/nov17-follow-connect-staging-release.json','tests/nov17-follow-connect-staging-release.test.mjs','.github/workflows/buklod-nov17-follow-connect-staging-ota.yml'].sort());
  assert.ok(release.includes('assert.deepEqual(changed,requiredChanged'));
  assert.ok(release.includes('git diff --exit-code "$RELEASE_MAIN_SHA" "$GITHUB_SHA" -- src/ assets/ supabase/'));
  assert.ok(release.includes('git diff --exit-code "$APK_SOURCE" "$GITHUB_SHA"'));
  assert.ok(release.includes('EXPO_MAX_WORKERS=2 npx expo export --platform android'));
});
test('both latest Wall/Connect fixes appear in the final source and frozen staging tests',()=>{
  const wall=read('src/app/(tabs)/buklod.tsx');
  const messages=read('src/app/(tabs)/messages.tsx');
  assert.match(wall,/alignItems:'flex-end',flexShrink:0,gap:2/);
  assert.match(wall,/toggleAuthorFollow\(/);
  assert.match(wall,/openReport\('post', item\.id\)/);
  assert.match(messages,/<ConnectInboxTabs/);
  assert.match(messages,/BuklodFirstViewAd/);
  for(const name of ['wall-header-navigation-20261117','messenger-inbox-density-20261117','messenger-navigation-scroll-20261117','messenger-wall-nav-density-20261117'])assert.ok(release.includes(name),name);
  assert.ok(release.includes("number:913,head:'ef1e3d8187a1158694c1def3bb6d655d43ccc599'"));
  assert.ok(release.includes("number:914,head:'264a6632ba6cf68eb67780b569a6ec2053829b08'"));
});

test('release ancestry pins the actual PR #912 merge commit, not the final main head',()=>{
  assert.ok(release.includes("number:912,head:'e5d6facd6fc58d2d1e8d97f1b757b41900f46851',merge:'66614852ea3163b6cb9eafdad2db3c02a8f7558a'"));
  assert.ok(release.includes("number:913,head:'ef1e3d8187a1158694c1def3bb6d655d43ccc599',merge:'d9b6a5ba57a7fbc8b3b05b3bc37c5385425546d6'"));
  assert.ok(release.includes('RELEASE_MAIN_SHA: 0ee57887c991d23472cdf1f9b849bce945792910'));
});
