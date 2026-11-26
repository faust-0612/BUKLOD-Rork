import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('cumulative runner pins candidate, reuses compatible dependencies and fails closed',()=>{
 const s=read('scripts/local-genesis-206-cumulative-runtime-qa.sh');
 assert.match(s,/test "\$actual" = "\$expected"/);
 assert.match(s,/cmp -s package-lock.json/);
 assert.match(s,/GENESIS_CUMULATIVE_QA_FAILED/);
 assert.match(s,/run_check typescript/);
 assert.doesNotMatch(s,/eas update|supabase db push|npm ci|npm install/);
});
test('existing Genesis runtime and backend holds remain explicit',()=>{
 assert.match(read('src/app/_layout.tsx'),/BuklodMicroMotionHost/);
 assert.match(read('src/app/_layout.tsx'),/EXPO_PUBLIC_BUKLOD_ACADEMY_ENABLED==='true'/);
 assert.match(read('src/components/BuklodChildrenTeachingDoor.tsx'),/EXPO_PUBLIC_CHILDREN_TEACHING_ENABLED/);
 assert.match(read('src/components/points/BuklodPointsRewardsScreen.tsx'),/POINTS_STAGING_READ_ONLY/);
 assert.match(read('src/app/admin/index.tsx'),/SALIKSIK Knowledge Vault/);
 assert.match(read('src/components/kabihasnang-ligaw/KlSeriesShelf.tsx'),/FALLBACK/);
});
