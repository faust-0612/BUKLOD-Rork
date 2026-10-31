import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p,'utf8');

test('Native authenticated deep links are blocked at the root, not only in Tabs', () => {
 const root=read('src/app/_layout.tsx');
 const bound=read('src/components/BuklodMandatoryUpdateBoundary.tsx');
 assert.ok(root.indexOf('<BuklodMandatoryUpdateBoundary>') < root.indexOf('<Stack\n'));
 assert.ok(root.indexOf('</Stack>') < root.indexOf('</BuklodMandatoryUpdateBoundary>'));
 assert.match(bound,/Platform.OS !== 'web' && session && config\?\.update_required/);
 assert.match(bound,/<BuklodUpdateRequiredPanel \/>/);
});

test('Forced update screen contains actionable recovery rather than a check-only trap', () => {
 const screen=read('src/app/system/update-required.tsx');
 const panel=read('src/components/BuklodUpdateRequiredPanel.tsx');
 assert.match(screen, /<BuklodUpdateRequiredPanel \/>/);
 assert.match(panel, /market:\/\/details\?id=/);
 assert.match(panel, /https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
 assert.match(panel, /https:\/\/buklod\.expo\.app/);
 assert.match(panel, /I-UPDATE ANG APP/);
 assert.match(panel, /NA-UPDATE KO NA/);
 assert.match(panel, /Kailangang i-update/);
});
