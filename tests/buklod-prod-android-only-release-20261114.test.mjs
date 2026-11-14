import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Android-only production marker NEVER triggers web or AAB, preserves original RC gates',()=>{
 const android=read('.github/workflows/production_android_ota.yml');
 const web=read('.github/workflows/production_web_deploy.yml');
 const aab=read('.github/workflows/buklod-v30-aab-production-20261108.yml');
 const marker='BUKLOD_ANDROID_ONLY_PROD_20261114:';
 assert.ok(android.includes(marker));
 assert.ok(!web.includes(marker));
 assert.ok(!aab.includes(marker));
 for(const guard of ['Verify production baseline and runtime','Verify app-wide AdMob policy before production OTA','Freeze verified RC','Publish exact frozen Android RC','Archive publication evidence']) assert.ok(android.includes(guard),guard);
 assert.ok(android.includes("github.ref == 'refs/heads/main'"));
 assert.ok(android.includes('scripts/android-ota-rc.cjs published'));
});
test('production package and signed-client runtime are unchanged by staged JavaScript source',()=>{
 const c=read('app.config.js'), eas=JSON.parse(read('eas.json'));
 assert.ok(c.includes("runtimeVersion: isClassroom ? '1.3.0' : '1.3.2'"));
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build['staging-user'].channel,'staging-user');
 assert.equal(eas.build['production-apk'].android.buildType,'apk');
});

test('protected production OTA cannot omit canonical member ranks or fast original-quality media/ad gates',()=>{
 const source=read('src/app/(tabs)/me.tsx');
 const android=read('.github/workflows/production_android_ota.yml');
 assert.ok(source.includes("['ALL-TIME',rankPositions?.overall]"));
 assert.ok(source.includes("['MONTHLY',rankPositions?.monthly]"));
 assert.ok(source.indexOf('MY OVERALL & MONTHLY RANK')<source.indexOf('isBuklodOfficial && !!profile?.id && <BuklodProfilePostCards'));
 for(const file of ['nov14-profile-navigation-rank-refresh.test.mjs','nov14-connect-green-profile-posts-ota.test.mjs','sponsor-ad-video-fast-start-20261114.test.mjs','marites-wall-scroll-video-navigation-20261113.test.mjs'])
   assert.ok(android.includes(file),'Production must test '+file);
 assert.ok(android.includes('Verify app-wide AdMob policy before production OTA'));
});
