import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');

test('Cluster command dashboard preserves faith and lesson controls and embeds safe sponsor slots',()=>{
 const source=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
 assert.match(source,/<BuklodHomeFaithPanel scopeId=\{scope.scope_id\} compact/);
 assert.match(source,/<BuklodScopeBuklodLessonPanel scope=\{scope\}/);
 assert.match(source,/<BuklodScopeFaithMonitoringDoor scope=\{scope\}/);
 assert.match(source,/14 existing configurable widgets/);
 assert.match(source,/<BuklodNativeSponsoredCard/);
 assert.match(source,/scope.scope_id/);
});

test('Managed Cluster/Organization dashboard sponsor is scope-keyed and does not replace attendance',()=>{
 const source=read('src/components/BuklodScopeHomeDashboard.tsx');
 assert.match(source,/<BuklodHomeScopeBulletins/);
 assert.match(source,/<BuklodScopeAttendanceCard/);
 assert.match(source,/<BuklodNativeSponsoredCard/);
 assert.match(source,/scope-home-native-media:\$\{scope.scope_id\}/);
 assert.match(source,/placementId=\{scope.scope_type === 'CLUSTER'/);
});
