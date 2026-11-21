import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {claimEarnedDiamondsThenReadProfile} from '../services/empire-arena/rankedParticipation.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const storeSource=readFileSync(resolve(root,'services/empire-arena/supabaseStore.mjs'),'utf8');
const user='00000000-0000-4000-8000-000000000123';
const profile={diamonds:1,rating:1000,verified_item_level:1};

function fixture(){
  const calls=[];
  const rpc=async(name,payload)=>{
    calls.push({name,payload});
    if(name==='arena_v2_claim_daily_diamonds')return {awarded:1};
    if(name==='arena_v2_ranked_profile')return profile;
    throw Error('unexpected_rpc');
  };
  return {calls,rpc};
}

test('Trusted ranked eligibility first grants only verified participation via private RPC',async()=>{
  const {calls,rpc}=fixture();
  const r=await claimEarnedDiamondsThenReadProfile(rpc,user,'phan');
  assert.deepEqual(r,profile);
  assert.deepEqual(calls.map(x=>x.name),[
    'arena_v2_claim_daily_diamonds','arena_v2_ranked_profile']);
  assert.deepEqual(calls[0].payload,{p_user:user});
  assert.deepEqual(calls[1].payload,{p_user:user,p_hero:'phan'});
});

test('Store validates account and hero before invoking private grant sequence',()=>{
  assert.match(storeSource,/if\(!UUID\.test\(userId\)\|\|!HEROES\.has\(hero\)\)throw Error\('invalid_profile_lookup'\)/);
  assert.match(storeSource,/await claimEarnedDiamondsThenReadProfile\(/);
  assert.match(storeSource,/this\.rpc\.bind\(this\),userId,hero/);
});

test('Failed trusted participation grant forbids profile/queue eligibility',async()=>{
  const calls=[];
  const rpc=async(name)=>{
    calls.push(name);
    throw Error('trusted_rpc_failed');
  };
  await assert.rejects(claimEarnedDiamondsThenReadProfile(rpc,user,'phan'),/trusted_rpc_failed/);
  assert.deepEqual(calls,['arena_v2_claim_daily_diamonds']);
});

test('Untrusted or missing RPC fails closed before any privilege escalation',async()=>{
  await assert.rejects(claimEarnedDiamondsThenReadProfile(null,user,'phan'),/trusted_ranked_rpc_required/);
  const {calls,rpc}=fixture();
  await assert.rejects(claimEarnedDiamondsThenReadProfile(rpc,null,'phan'),/invalid_ranked_profile_parameters/);
  assert.equal(calls.length,0);
});
