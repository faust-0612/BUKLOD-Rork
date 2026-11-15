const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
test('original Google full color attribution badge is exact official unmodified file', () => {
 const bytes=fs.readFileSync('assets/brands/google-translate/color-regular.png');
 assert.equal(bytes.length,3408);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'1ce4cf9db4cd6c8ae6f6d49542264f5334f40ac79139d51c145a4e039d26323d');
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(bytes.readUInt32BE(16),176);assert.equal(bytes.readUInt32BE(20),16);
});
test('translation requires explicit action, always retains English and mandatory badge/link/help disclaimer', () => {
 const s=fs.readFileSync('src/app/bible/read.tsx','utf8');
 assert.match(s,/useState\(true\);\s*const \[henryAttributionOpen/);
 assert.match(s,/Translate with Google/);
 assert.match(s,/onPress=\{\(\) => setHenryShowOriginal\(false\)\}/);
 assert.match(s,/color-regular\.png/);
 assert.match(s,/https:\/\/translate\.google\.com\//);
 assert.match(s,/THIS SERVICE MAY CONTAIN TRANSLATIONS POWERED BY GOOGLE/);
 assert.match(s,/BUKLOD uses Google Translate to power optional on-device translations/);
 assert.match(s,/henryTranslation\.status === 'translated'/);
 assert.match(s,/Original English/);
 assert.match(s,/Hindi available ang on-device translation/);
 const docs=fs.readFileSync('docs/bible/matthew-henry-translation-attribution-20261116.md','utf8');assert.match(docs,/Google ML Kit/);
});
test('live API confirmed sparse chapter entries cannot invent preceding verse commentary',()=>{
 const study=fs.readFileSync('src/lib/buklodBibleStudy.ts','utf8');
 assert.match(study,/const context = anchors\.length \? anchors\[anchors\.length - 1\] : null;/);
 assert.match(study,/relation: 'direct' \| 'context'/);
});
