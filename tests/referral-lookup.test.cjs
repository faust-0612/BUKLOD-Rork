const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const root = process.env.BUKLOD_TEST_ROOT || path.resolve(__dirname, '..');
const register = fs.readFileSync(path.join(root, 'src/app/(auth)/register.tsx'), 'utf8');
const rewards = fs.readFileSync(path.join(root, 'src/lib/buklodRewards.ts'), 'utf8');
function harness(suggest, resolve) {
  const state = {}, timers = []; let nextTimer = 0;
  const names = ['setReferralQuery','setSelectedReferralCode','setReferralMatchLabel','setReferralStatus','setReferralSuggestions'];
  const code = register.slice(register.indexOf('  const applyReferralSelection'), register.indexOf('\n  useEffect(() => {', register.indexOf('  const applyReferralSelection')));
  const version = { current: 0 };
  const fn = new Function(...names, 'referralLookupVersion', 'referralSuggestTimer', 'setTimeout', 'clearTimeout', 'suggestReferralTargets', 'resolveReferralTarget', stripTypeScriptTypes(code) + '\nreturn {onReferralQueryChange,applyReferralSelection};');
  const api = fn(...names.map(n => v => state[n] = v), version, {current:null}, f => { timers.push(f); return timers.length; }, id => { timers[id-1] = () => {}; }, suggest, resolve);
  return { ...api, state, version, run: () => timers[nextTimer++]() };
}
const flush = () => new Promise(setImmediate);
const item = {referral_code:'48680BC3',label:'Member',username:null,match_kind:'code'};
test('late results cannot overwrite newer input', async () => {
  let finish;
  const h=harness(q => q==='old' ? new Promise(r=>finish=r) : Promise.resolve([item]));
  h.onReferralQueryChange('old'); h.run(); h.onReferralQueryChange('48680BC3'); h.run(); await flush();
  finish([]); await flush(); assert.equal(h.state.setReferralStatus,'matched'); assert.equal(h.state.setSelectedReferralCode,'48680BC3');
});
test('selecting a suggestion invalidates an in-flight lookup', async () => {
  let finish; const h=harness(()=>new Promise(r=>finish=r));
  h.onReferralQueryChange('old');h.run();h.applyReferralSelection(item);finish([]);await flush();assert.equal(h.state.setReferralStatus,'matched');
});
test('clearing the input invalidates an in-flight lookup', async () => {
  let finish; const h=harness(()=>new Promise(r=>finish=r));
  h.onReferralQueryChange('old');h.run();h.onReferralQueryChange('');finish([item]);await flush();assert.equal(h.state.setReferralStatus,'idle');assert.equal(h.state.setSelectedReferralCode,'');
});
test('lookup rejection is unavailable, not missing', async () => {
 const h=harness(async()=>{throw Error('network');});h.onReferralQueryChange('code');h.run();await flush();assert.equal(h.state.setReferralStatus,'unavailable');
});
test('authoritative no-match is missing', async () => {
 const h=harness(async()=>[],async()=>({found:false}));h.onReferralQueryChange('code');h.run();await flush();assert.equal(h.state.setReferralStatus,'missing');
});
test('resolver preserves errors and rejects malformed responses', async () => {
 const code=rewards.slice(rewards.indexOf('export async function resolveReferralTarget'),rewards.indexOf('export async function recordReferral')).replace('export ','');
 let response; const resolve=new Function('supabase','withBuklodTimeout',stripTypeScriptTypes(code)+'\nreturn resolveReferralTarget;')({rpc:async()=>response},async(task,ms)=>{assert.equal(ms,5000);return task;});
 response={error:Error('offline')};await assert.rejects(resolve('code'),/offline/);
 response={data:{}};await assert.rejects(resolve('code'),/Could not check/);
 response={data:{found:false}};assert.equal((await resolve('code')).found,false);
 response={data:{found:true,referral_code:'48680BC3'}};assert.equal((await resolve('code')).referral_code,'48680BC3');
});
