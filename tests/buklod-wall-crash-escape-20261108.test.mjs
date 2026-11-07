import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const layout=readFileSync('src/app/_layout.tsx','utf8');
const wall=readFileSync('src/app/(tabs)/buklod.tsx','utf8');
test('Wall render failure Go Back escapes broken Wall to public Home rather than looping',()=>{
 const part=layout.slice(layout.indexOf('export function ErrorBoundary'),layout.indexOf('const',layout.indexOf('export function ErrorBoundary')+110));
 assert.match(layout,/pathname === '\/buklod' \|\| pathname\.startsWith\('\/buklod\/'\)/);
 assert.match(layout, /\? '\/home'/);
 assert.match(layout, /pathname\.startsWith\('\/clusters'\)/);
 assert.match(layout, /\? '\/clusters'/);
 assert.match(layout, /onPress=\{retry\}/);
 assert.match(layout, /BUKLOD_SCREEN_RENDER_EXCEPTION/);
 assert.match(wall, /const ensureWallAudioPlayer=/);
 assert.doesNotMatch(wall,/useAudioPlayer\(null/);
});
