import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { marketMarkerId, marketVisiblePostBody } from '../src/lib/buklodMarketLink.ts';

const read=path=>readFileSync(path,'utf8');
const id='12345678-90ab-cdef-1234-567890abcdef';
test('Market card metadata is extracted without displaying a technical marker in Wall captions',()=>{
  const text='🛍️ Seller: Sariwang Gulay\n[BUKLOD_MARKET:' + id + ']';
  assert.equal(marketMarkerId(text),id);
  assert.equal(marketVisiblePostBody(text),'🛍️ Seller: Sariwang Gulay');
  assert.equal(marketMarkerId('ordinary post'),null);
  assert.equal(marketVisiblePostBody('ordinary post'),'ordinary post');
});
test('Spoofed or truncated Market markers cannot trigger a Market card',()=>{
  assert.equal(marketMarkerId('[BUKLOD_MARKET:not-a-uuid]'),null);
  assert.equal(marketMarkerId('[BUKLOD_MARKET:123]'),null);
});
test('Public Wall retains its canonical card, caption, media and ad lifecycle',()=>{
  const wall=read('src/app/(tabs)/buklod.tsx');
  const card=read('src/components/BuklodCommunityWallPostCard.tsx');
  assert.match(wall,/BuklodExpandableWallCaption/);
  assert.match(wall,/marketVisiblePostBody\(String\(repairMojibakeText\(item.body\)/);
  assert.match(wall,/marketPostBody=\{String\(item.body\?\?''\)\}/);
  assert.match(wall,/renderCommunityMedia\(item\)/);
  assert.match(card,/marketMarkerId\(marketPostBody\)/);
  assert.match(card,/BuklodMarketWallLink/);
  assert.match(card,/marketPostId/);
  assert.match(read('src/components/BuklodMarketWallLink.tsx'),/from\('buklod_market_wall_shares'\)/);
  assert.match(card,/\{children\}/);
});
test('Market has full browse/seller/listing/chat actions without changing native dependencies',()=>{
  const screen=read('src/app/profile/buklod-market.tsx');
  const lib=read('src/lib/buklodMarket.ts');
  const manifest=read('.buklod/scopes/buklod-market-palengke-phase1-2-20261120.json');
  assert.match(screen,/marketDiscover/);
  assert.match(screen,/marketCreateStore/);
  assert.match(screen,/marketCreateListing/);
  assert.match(screen,/marketPublishListing/);
  assert.match(screen,/marketShareToWall/);
  assert.match(screen,/connect\/personal\/\[threadId\]/);
  assert.match(lib,/publication_state:'draft'/);
  assert.match(lib,/marketUploadPhoto/);
  assert.match(manifest,/"backend-security"/);
});
