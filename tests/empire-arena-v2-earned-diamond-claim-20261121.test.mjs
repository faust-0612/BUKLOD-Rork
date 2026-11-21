import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseArenaStore} from '../services/empire-arena/supabaseStore.mjs';

const user='00000000-0000-4000-8000-000000000123';
const profile={diamonds:1,rating:1000,verified_item_level:1};

function fixture(grantResult={awarded:1}) {
  const calls=[];
  const store=Object.create(SupabaseArenaStore.prototype);
  store.rpc=async(name,payload)=>{
    calls.push({name,payload});
    if(name==='arena_v2_claim_daily_diamonds')return grantResult;
    if(name==='arena_v2_ranked_profile')return profile;
    throw Error('unexpected_rpc');
  };
  return {store,calls};
}

test('Server grants only verified participation through private idempotent RPC before eligibility',async()=>{
  const {store,calls}=fixture();
  const r=await store.profile({userId:user,hero:'phan'});
  assert.equal(r.eligible,true);
  assert.deepEqual(calls.map(x=>x.name),[
    'arena_v2_claim_daily_diamonds','arena_v2_ranked_profile']);
  assert.deepEqual(calls[0].payload,{p_user:user});
  assert.equal(calls[1].payload.p_hero,'phan');
});

test('No forged or invalid account/hero can request a private grant',async()=>{
  const {store,calls}=fixture();
  await assert.rejects(store.profile({userId:'bad',hero:'phan'}),/invalid_profile_lookup/);
  await assert.rejects(store.profile({userId:user,hero:'made-up'}),/invalid_profile_lookup/);
  assert.equal(calls.length,0);
});

test('If trusted participation grant fails, queue eligibility fails closed',async()=>{
  const {store,calls}=fixture();
  store.rpc=async name=>{
    calls.push(name);
    throw Error('trusted_rpc_failed');
  };
  await assert.rejects(store.profile({userId:user,hero:'phan'}),/trusted_rpc_failed/);
  assert.deepEqual(calls,['arena_v2_claim_daily_diamonds']);
});
