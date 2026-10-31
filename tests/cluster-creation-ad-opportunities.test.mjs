import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(name, 'utf8');

test('Cluster creation has a keyboard-aware ad slot, but server creation precedes optional ad', () => {
 const s=read('src/app/clusters/create.tsx');
 assert.match(s,/BuklodSubmissionAdSlot placementId="cluster_create_before_submit"/);
 assert.ok(s.indexOf('const id = await createCluster(') < s.indexOf('setCreatedId(id);'));
 assert.match(s,/OPEN CLUSTER', onPress: \(\) => openCreatedCluster\(id\)/);
 assert.ok(s.indexOf("await showBuklodAdOpportunity('cluster_created_transition')") < s.indexOf("router.replace({\n          pathname: '/clusters/[id]'"));
});
test('Organization creation is persistent before ad/optional navigation', () => {
 const s=read('src/app/organizations/create.tsx');
 assert.match(s,/BuklodSubmissionAdSlot placementId="organization_create_before_submit"/);
 assert.match(s,/buklod_create_organization_v3/);
 assert.match(s,/setCreatedId\(scopeId\)/);
 assert.match(s,/await showBuklodAdOpportunity\('organization_created_transition'\)/);
 assert.match(s,/openCreatedOrganization\(scopeId, true\)/);
});
test('Privacy-sensitive prayer submission uses banner only, never rewarded or interstitial', () => {
 const s=read('src/app/prayer/new.tsx');
 assert.match(s,/BuklodSubmissionAdSlot placementId="prayer_request_before_save"/);
 assert.doesNotMatch(s,/showBuklodAdOpportunity|RewardedAd/);
});
