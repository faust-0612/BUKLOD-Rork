import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const route=readFileSync(resolve(root,'src/app/games/empire-arena.tsx'),'utf8');
const client=readFileSync(resolve(root,'src/features/games/empire/rankedClient.ts'),'utf8');
const server=readFileSync(resolve(root,'services/empire-arena/server.mjs'),'utf8');
const transport=readFileSync(resolve(root,'services/empire-arena/transport.mjs'),'utf8');

test('Ranked player actions and tactics always target authenticated local seat, not practice A0',()=>{
  assert.doesNotMatch(route, /(?:game|match)(?:\?)?\.players\.A0/);
  assert.match(route,/game\?\.players\[localSeat\]/);
  assert.match(route,/match\?\.players\[localSeat\]/);
  assert.match(route,/command\(game, localSeat, action\)/);
});

test('Reauthenticated live ranked seat is not queued a second time',()=>{
  assert.match(transport,/const resumed=coordinator\.reattach\(session\)/);
  assert.match(transport,/rating:profile\.rating,resumed/);
  assert.match(client,/if\(packet\.resumed!==true&&this\.queue\)/);
  assert.match(client,/this\.ready=true/);
});
