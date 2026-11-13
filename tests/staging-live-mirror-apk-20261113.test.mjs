import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const w=fs.readFileSync(new URL('../.github/workflows/buklod-staging-user-latest-main-apk-20261108.yml',import.meta.url),'utf8');

test('staging baseline APK requires source parity with freshly verified November 13 production runtime bytes',()=>{
  assert.match(w,/LIVE_PUBLISHED_SHA=a43e1813d62a151e8294a52989a80fe21b36057c/);
  assert.match(w,/git merge-base --is-ancestor "\$LIVE_PUBLISHED_SHA" "\$GITHUB_SHA"/);
  assert.match(w,/git diff --exit-code "\$LIVE_PUBLISHED_SHA" HEAD -- src assets plugins android ios app.config.js eas.json package.json package-lock.json/);
  assert.match(w,/org\.mzbministry\.buklod\.staging/);
  assert.match(w,/assert\.equal\(target\.environment,'preview'\)/);
  assert.match(w,/assert\.equal\(cfg\.runtimeVersion,'1\.3\.2'\)/);
});

test('staging artifact parser uses WHATWG URL and disallows web, arbitrary hosts, or invalid scheme',()=>{
  assert.doesNotMatch(w, /!\^https:\\\/\\\//);
  assert.match(w,/const apk = new URL\(url\)/);
  assert.match(w,/apk\.protocol !== 'https:'/);
  assert.match(w,/apk\.hostname !== 'expo.dev'/);
  assert.match(w,/apk\.pathname\.toLowerCase\(\)\.endsWith\('\.apk'\)/);
  for(const candidate of ['http://expo.dev/artifacts/eas/test.apk','https://evil.example/test.apk','https://expo.dev/example.json']){
    const u=new URL(candidate);
    assert.equal(u.protocol==='https:'&&u.hostname==='expo.dev'&&u.pathname.toLowerCase().endsWith('.apk'),false);
  }
});

test('mirror workflow remains a one-time staging-only APK, not OTA, web or Play deployment',()=>{
  assert.match(w,/github.ref == 'refs\/heads\/main'/);
  assert.match(w,/--platform android --profile staging-user --non-interactive --wait --json/);
  assert.match(w,/Download and verify actual staging APK/);
  assert.match(w,/Upload actual installable staging-user APK/);
  assert.doesNotMatch(w,/eas-cli@latest (?:update|deploy|submit)/);
  assert.doesNotMatch(w,/--channel production|--platform all/);
});
