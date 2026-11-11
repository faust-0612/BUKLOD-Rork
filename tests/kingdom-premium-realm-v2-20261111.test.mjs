import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const content = readFileSync('src/features/games/kingdom/BuklodKingdomMapPremium.tsx', 'utf8');
test('13 canonical stations and stable map navigation', () => {
 const s = content.split('const STATIONS: readonly Station[] = [')[1]?.split('] as const;')[0];
 assert.equal((s?.match(/\{ id: '/g) ?? []).length, 13);
 assert.ok(content.includes('router.push(station.href as any)'));
 assert.ok(content.includes("setMode(current => current === 'detail' ? 'fit' : 'detail')"));
});
test('modern illustrated realm retains accessible stations', () => {
 for(const token of ['id="aurora"','id="highland"','waylight-', 'onFocus={chooseStation}', 'onEnter={enterStation}', '<BuklodKingdomAtmosphere']) assert.ok(content.includes(token), token);
});
