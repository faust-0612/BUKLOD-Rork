import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('.buklod/scopes/nov15-conso-prod-video-ads.json'));
test('Nov15 prod OTA RC requires exact current main and a single no-publish QA workflow',()=>{
 assert.equal(manifest.contractVersion,2);
 assert.equal(manifest.baseRef,'main');
 assert.ok(manifest.riskAreas.includes('release-identity'));
 assert.ok(manifest.lockedFeatureChanges.some(x=>x.id==='production-release'));
 assert.ok(manifest.allowedPaths.includes('.github/workflows/buklod-nov15-prod-android-rc-qa.yml'));
 assert.ok(manifest.allowedPaths.includes('src/components/BuklodCommunityInlineAd.android.tsx'));
 const workflow=read('.github/workflows/buklod-nov15-prod-android-rc-qa.yml');
 assert.match(workflow,/on:\n  pull_request:/);
 assert.match(workflow,/APP_VARIANT: production/);
 assert.match(workflow,/org\.mzbministry\.buklod/);
 assert.ok(workflow.includes("npx expo export --platform android"));
 assert.ok(!workflow.includes("eas update --channel production"));
});
