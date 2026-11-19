import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('Genesis shared header retains ad sponsor on existing surfaces', () => {
 const tabs=read('src/app/(tabs)/_layout.tsx');
 assert.match(tabs, /import BuklodHeaderSponsor/);
 assert.match(tabs, /<BuklodHeaderSponsor/);
 assert.match(tabs, /BuklodDashboardAdWarmup/);
 assert.match(tabs, /placement = 'home'/);
 assert.match(tabs, /placement = 'community'/);
 assert.match(tabs, /placement = 'learn'/);
 assert.match(tabs, /isGenesisPreviewBuild\(\)/);
});
test('AdMob is still native-test-only in Genesis staging and production untouched',()=>{
 const app=read('app.config.js');
 assert.match(app, /genesisNativePreview/);
 assert.match(app, /ca-app-pub-3940256099942544~3347511713/);
 assert.match(app, /process\.env\.ADMOB_ANDROID_APP_ID/);
 const tabs=read('src/app/(tabs)/_layout.tsx');
 assert.match(tabs, /refreshUnread/);
 assert.match(tabs, /Open navigation menu/);
});
