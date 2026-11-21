import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {WebSocket,WebSocketServer} from 'ws';
import {ArenaMatchCoordinator} from '../core.mjs';
import {attachArenaTransport} from '../transport.mjs';

const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const ids={token1:uuid(1),token2:uuid(2)};
const heroes={token1:'phan',token2:'quin'};

async function harness(t,authTimeoutMs=8000){
  const wallet=new Map(Object.values(ids).map(id=>[id,1]));
  const calls={open:[],settle:[],abort:[]};
  const store={
    async authenticated(token){if(!(token in ids))throw Error('invalid_auth');return {id:ids[token]};},
    async selectedCharacter(token){if(!(token in heroes))throw Error('invalid_auth');return {hero:heroes[token],characterLevel:1};},
    async profile({userId}){const diamonds=wallet.get(userId)??0;return {diamonds,eligible:diamonds>0,verifiedItemLevel:1,rating:1000};},
    async open(x){
      // Mimic the dedicated DB escrow; no user or client may mint a Diamond.
      if(x.players.some(p=>(wallet.get(p.user_id)??0)<1))throw Error('insufficient_earned_diamonds');
      x.players.forEach(p=>wallet.set(p.user_id,wallet.get(p.user_id)-1));
      calls.open.push(x);return {accepted:true};
    },
    async settle(x){calls.settle.push(x);return {settled:true};},
    async abort(x){calls.abort.push(x);return {aborted:true};},
  };
  let now=1000;
  const coordinator=new ArenaMatchCoordinator({store,clock:()=>now,randomId:()=>uuid(909)});
  const metrics={connections:0,rejected:0,queue:0},clientsByUser=new Map();
  const server=http.createServer((req,res)=>{res.writeHead(404);res.end('not_found');});
  const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  server.on('upgrade',(request,socket,head)=>{
    if(request.url!=='/arena-v2'){socket.destroy();return;}
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws));
  });
  const sendRaw=(ws,msg)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));};
  attachArenaTransport({wss,store,coordinator,clientsByUser,metrics,sendRaw,isStopping:()=>false,authTimeoutMs});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const port=server.address().port;
  t.after(async()=>{
    wss.clients.forEach(ws=>ws.terminate());
    wss.close();
    await new Promise(resolve=>server.close(resolve));
  });
  return {wallet,calls,coordinator,metrics,url:'ws://127.0.0.1:'+port+'/arena-v2',now};
}

async function peer(url){
  const ws=new WebSocket(url);
  const events=[],waiters=[];
  ws.on('message',data=>{
    let msg;try{msg=JSON.parse(String(data));}catch{return;}
    events.push(msg);
    for(let i=waiters.length-1;i>=0;i--)if(waiters[i].type===msg.type){
      const waiter=waiters.splice(i,1)[0];
      clearTimeout(waiter.timer);waiter.resolve(msg);
    }
  });
  await once(ws,'open');
  return {
    ws,events,
    send:packet=>ws.send(JSON.stringify(packet)),
    packet(type){
      const earlier=events.find(x=>x.type===type);
      if(earlier)return Promise.resolve(earlier);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('missing_'+type)),6500);
        waiters.push({type,resolve,reject,timer});
      });
    },
    close:()=>ws.terminate(),
  };
}

test('Real network WebSocket 1v1: auth -> queue -> reserve -> server moves own seat, rejects replay -> settles',async t=>{
  const h=await harness(t);
  const unauth=await peer(h.url);
  unauth.send({type:'queue',mode:'duel',mapId:'genesis_rift'});
  const [code]=await once(unauth.ws,'close');
  assert.equal(code,1008,'Queue before auth is forbidden');

  const a=await peer(h.url),b=await peer(h.url);
  a.send({type:'hello',token:'token1'});
  b.send({type:'hello',token:'token2'});
  assert.equal((await a.packet('hello_ok')).rankedEligible,true);
  assert.equal((await b.packet('hello_ok')).rankedEligible,true);
  a.send({type:'queue',mode:'duel',mapId:'genesis_rift'});
  b.send({type:'queue',mode:'duel',mapId:'genesis_rift'});
  assert.equal((await a.packet('match_start')).slot,'A0');
  assert.equal((await b.packet('match_start')).slot,'B0');
  assert.equal(h.calls.open.length,1);
  assert.equal(h.wallet.get(ids.token1),0,'Diamond is held once, not minted');

  const game=[...h.coordinator.matches.values()][0];
  const original=game.state.players.A0.x;
  a.send({type:'action',seq:1,action:{type:'move',dx:1,dy:0,damage:9999,playerId:'B0'}});
  await a.packet('command_ack');
  assert.ok(game.state.players.A0.x>original);
  a.send({type:'action',seq:1,action:{type:'move',dx:1,dy:0}});
  await a.packet('command_rejected');
  assert.equal(game.roster[0].slot,'A0');

  game.state.result={winner:'A',reason:'seal_breached'};
  game.state.status='finished';
  await h.coordinator.heartbeat();
  assert.equal(h.calls.settle.length,1);
  assert.equal((await a.packet('match_end')).confirmed,true);
  assert.equal(h.coordinator.matches.size,0);
  a.close();b.close();
});

test('Real network WebSocket reconnect with last Diamond reserved resumes same match, not a new stake',async t=>{
  const h=await harness(t);
  const a=await peer(h.url),b=await peer(h.url);
  a.send({type:'hello',token:'token1'});
  b.send({type:'hello',token:'token2'});
  await a.packet('hello_ok');await b.packet('hello_ok');
  a.send({type:'queue',mode:'duel',mapId:'genesis_rift'});
  b.send({type:'queue',mode:'duel',mapId:'genesis_rift'});
  await a.packet('match_start');await b.packet('match_start');
  assert.equal(h.wallet.get(ids.token1),0);
  a.close();await once(a.ws,'close');
  const reconnect=await peer(h.url);
  reconnect.send({type:'hello',token:'token1'});
  assert.equal((await reconnect.packet('match_resume')).slot,'A0');
  const hello=await reconnect.packet('hello_ok');
  assert.equal(hello.resumed,true);
  assert.equal(hello.rankedEligible,true,'Reserved last Diamond must not reject resume');
  assert.equal(hello.diamonds,0);
  assert.equal(h.calls.open.length,1,'No second ranked stake/seat');
  reconnect.close();b.close();
});

test('Idle unauthenticated sockets are bounded and never reserve earned Diamonds',async t=>{
  const h=await harness(t,600);
  const idle=await peer(h.url);
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(Error('auth_timeout_not_enforced')),2500));
  const [code]=await Promise.race([once(idle.ws,'close'),timeout]);
  assert.equal(code,1008);
  assert.equal(h.calls.open.length,0);
});

test('Production server serializes async authoritative heartbeats',async()=>{
  const {readFileSync}=await import('node:fs');
  const {resolve}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const src=readFileSync(resolve(fileURLToPath(new URL('../server.mjs',import.meta.url))),'utf8');
  assert.match(src,/let heartbeatPending=false/);
  assert.match(src,/if\(stopping\|\|heartbeatPending\)return/);
  assert.match(src,/\.finally\(\(\)=>\{heartbeatPending=false;\}\)/);
});
