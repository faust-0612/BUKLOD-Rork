import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../',import.meta.url);
const sql=readFileSync(new URL('supabase/changesets/buklod_world_exchange_v1.dev.sql',root),'utf8');
const ts=readFileSync(new URL('src/lib/buklodWorldExchangeV1.ts',root),'utf8');
const js=stripTypeScriptTypes(ts,{mode:'strip'});
const {makeBuklodWorldExchangeClient}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const uuids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const response=(data,error=null)=>({data,error});
const mock=(handler)=>{const calls=[];const api=makeBuklodWorldExchangeClient({rpc:async(name,params)=>{calls.push({name,params});return handler(name,params)}});return {api,calls}};

test('owner clarification: BP is not a commodity; item sale moves spendable balance but NEVER lifetime rank, QMP, or character XP',()=>{
 assert.match(sql,/available_points=available_points-v_offer\.price_bp/);
 assert.match(sql,/available_points=available_points\+v_offer\.price_bp/);
 assert.doesNotMatch(sql,/\b(?:insert\s+into|update)\s+public\.buklod_points_ledger\b/i);
 assert.doesNotMatch(sql,/\bset\s+lifetime_points\s*=/i);
 assert.match(sql,/private\.buklod_world_bp_transfers_v1/);
 assert.match(sql,/buyer_user_id uuid not null/);
 assert.match(sql,/item_id uuid not null/);
 assert.match(sql,/available_points=available_points-v_offer\.price_bp/);
 assert.match(sql,/available_points=available_points\+v_offer\.price_bp/);
 assert.doesNotMatch(sql,/create or replace function public\.buklod_world_(buy|sell)_bp_/i);
 assert.doesNotMatch(sql,/\b(?:update|insert\s+into)\s+.*\bqmp\b/i);
});

test('feature flags fail closed and direct private table access is revoked',()=>{
 assert.match(sql,/values \(true,false,false\) on conflict/);
 for(const name of ['exchange_gate','verified_sources','items','offers','bp_transfers']){
   assert.match(sql,new RegExp(`alter table private\\.buklod_world_${name}_v1 enable row level security`));
   assert.match(sql,new RegExp(`revoke all on private\\.buklod_world_${name}_v1 from public,anon,authenticated`));
 }
 assert.match(sql,/revoke all on function private\.buklod_world_issue_verified_item_v1\(text\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function private\.buklod_world_issue_verified_item_v1\(text\) to service_role/);
});

test('item sources are proven server-side, unique and non-forgeable by regular clients',()=>{
 assert.match(sql,/source_key text primary key/);
 assert.match(sql,/constraint world_source_unique_origin unique \(source_surface,source_object_key\)/);
 assert.match(sql,/source_key text not null unique references private\.buklod_world_verified_sources_v1/);
 assert.match(sql,/revoked_at is null/);
 assert.match(sql,/item_id uuid unique/);
 assert.match(sql,/\('gear','strategy','material'\)/);
 assert.doesNotMatch(ts.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,''),/service_role|\/admin\/|createWorldItem\(/);
});

test('no seller/user ID is accepted from client purchase; SQL infers auth.uid',()=>{
 assert.match(sql,/create or replace function public\.buklod_world_buy_offer_v1\(p_offer_id uuid,p_request_id text\)/);
 assert.match(sql,/v_buyer uuid := auth\.uid\(\)/);
 assert.match(sql,/security definer set search_path = ''/);
 assert.match(sql,/buyer_user_id=v_buyer and client_request_id=p_request_id/);
 assert.match(sql,/seller_user_id=v_user/);
});

test('double-buy safety and idempotent retry checked after offer row lock',()=>{
 const fn=sql.split('create or replace function public.buklod_world_buy_offer_v1')[1].split('create or replace function public.buklod_world_cancel_offer_v1')[0];
 const lock=fn.indexOf('where id=p_offer_id for update;');
 const retry=fn.indexOf('where buyer_user_id=v_buyer and client_request_id=p_request_id;',lock);
 const availability=fn.indexOf("v_offer.status<>'open'",lock);
 assert.ok(lock>0&&retry>lock&&availability>retry,'Retry must return BEFORE rejecting now-settled offer');
 assert.match(sql,/create unique index if not exists buklod_world_one_open_offer_per_item_v1/);
 assert.match(sql,/unique\(buyer_user_id,client_request_id\)/);
 assert.match(sql,/order by user_id for update/);
 assert.match(sql,/available_points>=v_offer\.price_bp/);
});

test('no client minted inventory, no legacy collectible/evolution receipt sales',()=>{
 assert.match(sql,/kind in \('gear','strategy','material'\)/);
 assert.doesNotMatch(sql,/kind in \('evolution'/);
 assert.match(sql,/tradable boolean not null default false/);
 assert.match(sql,/character_id in/);
 assert.match(sql,/source_surface text not null/);
});

test('listItem calls only authenticated RPC with stable request id and no owner ID',async()=>{
 const {api,calls}=mock((_name,_args)=>response(uuids[1]));
 assert.equal(await api.listItem({itemId:uuids[0],priceBp:33,requestId:'req-order-1'}),uuids[1]);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'buklod_world_list_item_v1');
 assert.deepEqual(calls[0].params,{p_item_id:uuids[0],p_price_bp:33,p_request_id:'req-order-1',p_restricted_buyer_id:null});
 assert.equal(Object.hasOwn(calls[0].params,'user_id'),false);
});

test('buyOffer returns settlement only on valid durable server receipt',async()=>{
 const {api,calls}=mock(()=>response({transfer_id:uuids[2],item_id:uuids[0],offer_id:uuids[1],amount_bp:25,status:'settled'}));
 assert.equal((await api.buyOffer(uuids[1],'purchase-req-1')).transfer_id,uuids[2]);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].params,{p_offer_id:uuids[1],p_request_id:'purchase-req-1'});
 const noReceipt=makeBuklodWorldExchangeClient({rpc:async()=>response(null)});
 await assert.rejects(noReceipt.buyOffer(uuids[1],'purchase-req-2'),/Invalid settlement response/);
 const badReceipt=makeBuklodWorldExchangeClient({rpc:async()=>response({status:'settled',amount_bp:25})});
 await assert.rejects(badReceipt.buyOffer(uuids[1],'purchase-req-3'),/Unverified settlement response/);
});

test('network failure does not create local optimistic balance or item state',async()=>{
 let invocations=0;
 const {api}=mock(async()=>{invocations++;if(invocations===1)throw Error('offline network');return response({transfer_id:uuids[2],item_id:uuids[0],offer_id:uuids[1],amount_bp:25,status:'settled'})});
 await assert.rejects(api.buyOffer(uuids[1],'stable-purchase'),/offline network/);
 const result=await api.buyOffer(uuids[1],'stable-purchase');
 assert.equal(result.status,'settled');
 assert.equal(invocations,2);
});

test('invalid item IDs, price, request IDs and limits never reach RPC',async()=>{
 const {api,calls}=mock(()=>response([]));
 await assert.rejects(api.listItem({itemId:'fake-id',priceBp:25,requestId:'request-id'}),/Invalid listing/);
 await assert.rejects(api.listItem({itemId:uuids[0],priceBp:-1,requestId:'request-id'}),/Invalid listing/);
 await assert.rejects(api.buyOffer(uuids[0],'short'),/Invalid purchase/);
 await assert.rejects(api.inventory(1000),/Invalid inventory limit/);
 await assert.rejects(api.browse(100),/Invalid offer limit/);
 assert.equal(calls.length,0);
});

test('cancellation is acknowledged by server; cannot be assumed locally',async()=>{
 const api=makeBuklodWorldExchangeClient({rpc:async()=>response(false)});
 await assert.rejects(api.cancelOffer(uuids[1]),/not confirmed/);
 const success=makeBuklodWorldExchangeClient({rpc:async()=>response(true)});
 assert.equal(await success.cancelOffer(uuids[1]),undefined);
});

test('source revocation quarantines listed inventory, match reservation deferred',()=>{
 assert.match(sql,/private\.buklod_world_quarantine_item_v1/);
 assert.match(sql,/v_item.status='escrow'/);
 assert.match(sql,/set status='cancelled',closed_at=now\(\)/);
 assert.match(sql,/set status='revoked',updated_at=now\(\)/);
 assert.match(sql,/match-reserved item must be revoked by trusted match arbitration/);
});


test('API rejects an unsupported currency or dishonest status payload instead of unlocking trading',async()=>{
 const bad=makeBuklodWorldExchangeClient({rpc:async()=>response({trading_enabled:true,currency:'paid_diamonds'})});
 await assert.rejects(bad.status(),/Invalid World Exchange status/);
 const good=makeBuklodWorldExchangeClient({rpc:async()=>response({trading_enabled:false,currency:'spendable_bp_only',source:'verified'})});
 assert.equal((await good.status()).trading_enabled,false);
});

test('new backend proposal forbids BP-to-BP or BP-for-cash listings: only separately verified goods',()=>{
 assert.match(sql,/kind text not null check \(kind in \('gear','strategy','material'\)\)/);
 assert.match(sql,/private\.buklod_world_verified_sources_v1/);
 assert.doesNotMatch(sql,/\('bp','currency','cash'\)/i);
 assert.match(sql,/BP itself CANNOT be bought or sold as a listed item/);
});