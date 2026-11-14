import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const verification=readFileSync('.github/workflows/buklod-staging-visual-recovery-verify-20261114.yml','utf8');
const previousPublisher=readFileSync('.github/workflows/navigation-v2-owner-staging-ota.yml','utf8');
test('recovery verification is read-only and checks exact current Expo staging manifest',()=>{
 assert.match(verification,/01a1d7f4-3cdf-7219-9632-52fba0ed5a4e/);
 assert.match(verification,/01a1d2d6-bae3-74df-bbf4-2bdd9df35215/);
 assert.match(verification,/e1551b09ad180e81a889d39615aea6257688ddea/);
 assert.match(verification,/await manifest\('staging-user'\)/);
 assert.match(verification,/await manifest\('production'\)/);
 assert.doesNotMatch(verification,/eas-cli@[^\\s]+ (?:update|build|deploy|submit)\\s|--channel production|--destination-branch/);
});
test('old staging publisher refuses sources missing newer Visual Staging baseline',()=>{
 assert.match(previousPublisher,/git merge-base --is-ancestor e1551b09ad180e81a889d39615aea6257688ddea "\$GITHUB_SHA"/);
 assert.match(previousPublisher,/DO NOT re-publish an older source over the restored Visual Staging OTA/);
});
