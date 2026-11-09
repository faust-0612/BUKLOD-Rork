import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/app/clusters/index.tsx','utf8');
const tones=readFileSync('src/lib/buklodCardTones.ts','utf8');
test('Cluster cards use stable accent surfaces and striped colored borders',()=>{
 assert.ok(src.includes('backgroundColor: accent.surface, borderColor: accent.border'));
 assert.ok(src.includes('backgroundColor: accent.action'));
 assert.ok(src.includes('getStableBuklodCardTone(item.scope_id)'));
 assert.ok(src.includes('styles.cardColorLayer'));
 assert.ok(src.includes('styles.cardAccentBar'));
 assert.match(tones,/const tones: BuklodCardToneName\[\]/);
});
test('Compact Cluster hero, horizontal metrics, tiles and cards',()=>{
 assert.ok(src.includes('paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24, gap: 7'));
 assert.ok(src.includes("backgroundColor: '#FFFFFF', padding: 12, gap: 9"));
 assert.ok(src.includes('metricTextColumn'));
 assert.ok(src.includes('minHeight: 52'));
 assert.ok(src.includes('minHeight: 42'));
 assert.ok(src.includes('cardHeadPress'));
});
test('First-view ad is retained after the first Cluster card with empty-view fallback',()=>{
 assert.ok(src.includes('index === 0 ? <BuklodFirstViewAd'));
 assert.ok(src.includes("section !== 'mine' || filteredMyClusters.length === 0"));
 assert.ok(src.includes("enterScopedWorkspace(selectScope, id, { section: 'home', navigation: 'replace' })"));
 assert.ok(src.includes('clusterScopeManageRoute(item.scope_id, item.name)'));
 assert.ok(src.includes('await joinCluster(item.scope_id)'));
 assert.ok(src.includes('await respondClusterInvite('));
});
