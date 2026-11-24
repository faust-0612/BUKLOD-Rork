import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const gate=read('src/components/BuklodSaliksikDoor.tsx');
const cluster=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
const page=read('src/app/scope/saliksik.tsx');
test('Only opted-in faith-enabled Cluster members see SALIKSIK; no Home fetch for manuscript',()=>{
 assert.match(gate,/EXPO_PUBLIC_SALIKSIK_ENABLED/);
 assert.match(gate,/scope\.scope_type!=='CLUSTER'/);
 assert.match(gate,/!scope\.show_faith_content/);
 assert.match(cluster,/<BuklodSaliksikDoor scope=\{scope\}/);
 assert.doesNotMatch(gate,/saliksikRequestCompleteManuscript|saliksikCatalog|saliksik_manuscript_access_v1/);
 assert.match(page,/const downloadManuscript=async/);
 assert.match(page,/saliksikRequestCompleteManuscript\(collectionId\)/);
});
test('Locked progress and remote entitlement stay separated from nonfaith tabs',()=>{
 assert.match(page,/entries\.length===9&&entries\.every\(x=>x\.completed\)/);
 assert.match(page,/disabled=\{!progress\.unlocked\|\|busy\}/);
 assert.match(page,/EXPO_PUBLIC_SALIKSIK_ENABLED!=='true'/);
 assert.match(page,/Linking\.openURL\(receipt\.download_url\)/);
});
