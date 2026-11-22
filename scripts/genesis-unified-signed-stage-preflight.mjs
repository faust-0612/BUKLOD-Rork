#!/usr/bin/env node
/** Fail closed before paid EAS build. This is not a release approval tool. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const rc=json('.buklod/releases/genesis-unified-signed-rc-hold-20261122.json');
const eas=json('eas.json');
const profile=eas.build['season2-genesis-unified-worlds-staging'];
assert.equal(eas.build.production.channel,'production');
assert.equal(profile.extends,'staging-user');
assert.equal(profile.channel,'season2-genesis-unified-preview');
assert.equal(profile.android.buildType,'apk');
assert.equal(profile.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS,'true');
assert.equal(profile.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
for(const key of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])
  assert.equal(profile.env[key],undefined,'Do not commit staging project credentials into repo build profile');
assert.equal(rc.productionUntouched,true);
if(process.argv.includes('--signed')){
  assert.equal(rc.signedReleaseReady,true,'BLOCK: native world gameplay and release gates not approved yet');
  assert.equal(process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
  const url=process.env.STAGING_SUPABASE_URL||'';
  const key=process.env.STAGING_SUPABASE_PUBLISHABLE_KEY||'';
  const live=new Set(['yhanxndaqbmuzbdqlblu','oppswibwjrruxkrpiwej','cjtehbfspgimyhifnjon']);
  const match=url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/);
  assert.ok(match,'Separate staging Supabase URL missing/invalid');
  assert.ok(!live.has(match[1]),'BLOCK: do not connect production or other existing BUKLOD databases');
  assert.match(key,/^sb_publishable_[a-zA-Z0-9_-]+$/);
  assert.ok(process.env.STAGING_FIREBASE_JSON_B64);
  assert.ok(process.env.EXPO_TOKEN);
  assert.equal(process.env.APP_VARIANT,'staging');
  assert.equal(process.env.EXPO_PUBLIC_ARENA_RANKED_ENABLED,undefined);
  console.log('SIGNED_RC_PREFLIGHT_PASS: identity, isolated backend, preserved production; actual EAS build still required.');
}else{
  console.log('SOURCE_HOLD_CONFIRMED: 2.0.3 staged profile configured; EAS signed release stays blocked.');
}
