import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const m=JSON.parse(read('.buklod/scopes/nov16-spacing-graphics-character-consolidated-rc.json'));
test('exact Nov16 cumulative scope declares all component proofs without security bypass',()=>{
 assert.equal(m.contractVersion,2);
 assert.equal(m.releaseMode,'consolidated-main-rc');
 assert.deepEqual([...m.componentScopePaths].sort(),['.buklod/scopes/appwide-compact-density-20261116.json','.buklod/scopes/character-1300-art-motion-staging-20261116.json','.buklod/scopes/nov16-unified-character-kingdom-connect-staging132.json','.buklod/scopes/nov16-conso-lesson-progression-20261116.json'].sort());
 for(const p of m.componentScopePaths){assert.ok(m.allowedPaths.includes(p));assert.equal(JSON.parse(read(p)).contractVersion,2)}
 assert.ok(m.lockedFeatureChanges.some(x=>x.id==='backend-security' && x.tests.some(t=>t.startsWith('supabase/tests/'))));
 assert.ok(m.lockedFeatureChanges.some(x=>x.id==='governance-lock'));
 assert.ok(m.regressionTests.includes('tests/protected-feature-lock.test.mjs'));
 assert.ok(m.regressionTests.includes('tests/lesson-quickcheck-regression-20261116.test.mjs'));
 for(const p of ['src/components/LearningQuestionResponse.tsx','src/components/BuklodFormationEntryScopeTracker.tsx','tests/lesson-quickcheck-regression-20261116.test.mjs'])assert.ok(m.allowedPaths.includes(p));
});
test('protected cumulative CI is still exclusive to this branch and main',()=>{
 const w=read('.github/workflows/engineering-accountability.yml');
 const g=read('scripts/engineering-regression-gate.mjs');
 assert.ok(w.includes('integration/nov16-spacing-graphics-character-rc'));
 assert.ok(w.includes('BUKLOD_CONSOLIDATED_RC_GATE=true'));
 assert.ok(w.includes('.buklod/scopes/nov16-spacing-graphics-character-consolidated-rc.json'));
 assert.ok(g.includes('base === \'main\''));
 assert.ok(g.includes("process.env.BUKLOD_CONSOLIDATED_RC_GATE === 'true'"));
 assert.ok(g.includes("'integration/nov16-spacing-graphics-character-rc'"));
});
test('Character visual source lock remains exact while offline art cannot mint items',()=>{
 const c=read('scripts/character-release-contract.mjs');
 const a=read('scripts/verify-publish-character-art.mjs');
 assert.match(c,/a298732870bef208ec6bb13500ff804d7d723d48/);
 assert.ok(a.includes('published-v1.json'));
 assert.equal(m.artStoragePublication,'BLOCKED_ABSENT_VERIFIED_REMOTE_BUCKET_OBJECTS');
});
