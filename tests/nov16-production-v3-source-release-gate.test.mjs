import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('production RC uses exact staged source but NEVER publishes directly',()=>{
 const wf=read('.github/workflows/buklod-nov16-production-v3-source-qa.yml');
 assert.match(wf,/4f5359021732b39e3771a1ac2f25b1f8c1a898b0/);
 assert.match(wf,/org\.mzbministry\.buklod/);
 assert.match(wf,/1\.3\.2/);
 assert.match(wf,/01a1e0fe-45da-7be9-a6f5-107d43bad4b3/);
 assert.match(wf,/01a1dff8-7563-790b-a714-22c316f56590/);
 assert.match(wf,/expo export --platform android/);
 assert.doesNotMatch(wf,/eas-cli@[^\n]* update --channel production|eas update --channel production|--platform ios|deploy --prod/);
});
test('children dialogue and Henry v3 preserve staged source and Google attributed original',()=>{
 assert.match(read('src/lib/buklodHenryTranslation.ts'),/henry-translation-v3:/);
 assert.match(read('src/features/childrenStories/bibleExpansion.ts'),/BIBLE_EXPANSION_DIALOGUES_NEW_B/);
 assert.match(read('src/app/bible/read.tsx'),/Powered by Google Translate/);
 const m=JSON.parse(read('.buklod/scopes/nov16-production-staging-parity-rc.json'));
 assert.equal(m.contractVersion,2);
 assert.equal(m.baseRef,'main');
 assert.ok(m.regressionTests.includes('tests/nov16-production-v3-source-release-gate.test.mjs'));
});
