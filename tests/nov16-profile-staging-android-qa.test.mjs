import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const scope=JSON.parse(read('.buklod/scopes/nov16-all-pending-home-focus-stories-henry-v4.json'));
const eas=JSON.parse(read('eas.json'));
const config=read('app.config.js');
const profile=read('src/app/(tabs)/me.tsx');

test('Consolidated source is staging-first and preserves exact Expo runtime and channel contracts',()=>{
 assert.equal(scope.contractVersion,2);
 assert.equal(scope.runtimeVersion,'1.3.2');
 assert.equal(scope.publicationStatus,'SOURCE_ONLY_NO_OTA');
 assert.equal(eas.build['staging-user'].channel,'staging-user');
 assert.equal(eas.build['staging-user'].environment,'preview');
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build.production.environment,'production');
 assert.match(config,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
 assert.match(config,/org\.mzbministry\.buklod\.staging/);
 assert.ok(!scope.allowedPaths.includes('app.config.js'));
 assert.ok(!scope.allowedPaths.includes('eas.json'));
});

test('Profile identity, ads and navigation keep all explicit revised regression checks',()=>{
 for(const path of [
  'tests/nov16-profile-hero-compact.test.mjs',
  'tests/nov16-profile-navigation-actions.test.mjs',
  'tests/nov16-profile-staging-android-qa.test.mjs'
 ])assert.ok(scope.regressionTests.includes(path),'Missing changed regression proof '+path);
 for(const token of ['testID="profile-primary-display-name"','testID="profile-identity-rank"',
   'MY OVERALL & MONTHLY RANK','<BuklodProfilePostCards',
   'BuklodNativeSponsoredCard','BuklodFirstViewAd','BuklodScreenBottomBanner']){
  assert.ok(profile.includes(token),'Missing protected Profile behavior '+token);
 }
 assert.ok(scope.preserveBehaviors.some(s=>/AdMob/.test(s)));
});
