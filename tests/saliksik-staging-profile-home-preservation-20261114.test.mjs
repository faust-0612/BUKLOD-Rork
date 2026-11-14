import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('SALIKSIK preserves visual Profile, modern Home and controlled ads',()=>{
 const profile=read('src/app/(tabs)/me.tsx'),home=read('src/app/(tabs)/hub.tsx');
 const utility=read('src/components/home/BuklodHomeUtilityCards.tsx');
 assert.match(profile,/MY OVERALL & MONTHLY RANK/);
 assert.match(profile,/loadBuklodPointsDashboard/);
 assert.match(profile,/BuklodProfilePostCards/);
 assert.match(utility,/home-heart/);
 assert.doesNotMatch(home,/Open Updates & Bulletins/);
 assert.match(home,/BuklodNativeSponsoredCard/);
});
test('Admin and faith-enabled Cluster have the only SALIKSIK entrances',()=>{
 const admin=read('src/app/admin/index.tsx');
 const cluster=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
 assert.match(admin,/path="\/admin\/saliksik-library"/);
 assert.match(cluster,/scope\.show_faith_content \? \(/);
 assert.match(cluster,/<BuklodSaliksikDoor scope=\{scope\}/);
});
test('Backend remains rollout-OFF and private until isolated staging verification',()=>{
 const r1=read('supabase/migrations/20261112221000_saliksik_private_vault_objective_mastery_r1.sql');
 const r2=read('supabase/migrations/20261113221000_saliksik_written_master_reward_r2.sql');
 assert.match(r1,/member_enabled boolean NOT NULL DEFAULT false/);
 assert.match(r1,/ENABLE ROW LEVEL SECURITY/);
 assert.match(r2,/saliksik_master_submissions/);
});
