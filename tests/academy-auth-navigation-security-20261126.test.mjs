import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Academy entry points and direct routes are explicitly opt-in',()=>{
 for(const p of ["src/app/(tabs)/learn.tsx","src/app/_layout.tsx","src/app/admin/index.tsx","src/app/academy/index.tsx","src/app/academy/research.tsx","src/app/admin/academy-recipients.tsx","src/app/admin/academy-research-review.tsx"])assert.match(read(p),/EXPO_PUBLIC_BUKLOD_ACADEMY_ENABLED==='true'/);
 assert.match(read('src/app/_layout.tsx'),/BuklodMicroMotionHost/);
 assert.match(read('src/app/admin/index.tsx'),/SALIKSIK Knowledge Vault/);
});
test('continuing doctrine does not earn foundation UC and printed title is unembellished',()=>{
 assert.match(read('supabase/migrations/20261124020000_buklod_university_internal_academic_r1.sql'),/and \(p.lesson_id in \('prelim-01','prelim-02'\)/);
 assert.match(read('supabase/migrations/20261124023000_buklod_academy_verified_uc_events_r1.sql'),/if not \(new.lesson_id in \('prelim-01','prelim-02'\)/);
 assert.doesNotMatch(read('src/data/university/buklodUniversityCatalog.json'),/Gabut, PhD/);
 assert.doesNotMatch(read('supabase/functions/buklod-academy-paper-v1/index.ts'),/Gabut, PhD/);
});
