/**
 * BUKLOD in-app ranked Arena server. Deploy separately as infrastructure,
 * NOT as another Android app. One BUKLOD auth, authoritative game simulation,
 * nontransferable Diamond stake and separate rating ledger.
 *
 * Requires HTTPS TLS terminating reverse proxy supplying wss:// to the app.
 * Secrets must be server-only. Never embed service-role key in an OTA or APK.
 */
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { ArenaMatchCoordinator } from './core.mjs';
import { SupabaseArenaStore, deriveVerifiedArenaSnapshot } from './supabaseStore.mjs';

const PORT=Number(process.env.PORT||8797);
const HOST=process.env.HOST||'127.0.0.1';
if(!Number.isInteger(PORT)||PORT<=0||PORT>65535)throw Error('invalid_port');
const store=new SupabaseArenaStore({
  url:process.env.ARENA_SUPABASE_URL,
  publishableKey:process.env.ARENA_SUPABASE_PUBLISHABLE_KEY,
  secretKey:process.env.ARENA_SUPABASE_SECRET_KEY,
});
const metrics={connections:0,rejected:0,queue:0};
const coordinator=new ArenaMatchCoordinator({
  store,
  onError:(code,error)=>console.error('[arena]',code,
    typeof error?.message==='string'?error.message.slice(0,96):'unavailable'),
});
let ready=false,stopping=false;
const clientsByUser=new Map();
const sendRaw=(ws,content)=>{
  if(ws.readyState!==WebSocket.OPEN)return;
  if(ws.bufferedAmount>256*1024){ws.terminate();return;}
  try{ws.send(JSON.stringify(content));}catch{ws.terminate();}
};

const server=http.createServer((req,res)=>{
  if(req.url==='/healthz'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end('{"status":"running"}');return;
  }
  if(req.url==='/readyz'){
    res.writeHead(ready&&!stopping?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ready:ready&&!stopping}));return;
  }
  res.writeHead(404);res.end('Not found');
});
const wss=new WebSocketServer({
  noServer:true,maxPayload:2048,perMessageDeflate:false,clientTracking:true,
});
server.on('upgrade',(request,socket,head)=>{
  if(stopping||!ready||request.url!=='/arena-v2'){
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();return;
  }
  // All clients must authenticate with Supabase-issued user JWT before queueing.
  wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws));
});

wss.on('connection',ws=>{
  metrics.connections++;
  let state='awaiting_auth';
  let session=null;
  let messageChain=Promise.resolve();
  ws.on('message',bytes=>{
    // Explicit serialization prevents overlapping async auth/queue/command races.
    messageChain=messageChain.then(async()=>{
      if(ws.readyState!==WebSocket.OPEN||stopping)return;
      if(bytes.byteLength>2048){ws.close(1009,'payload_too_large');return;}
      let packet;
      try{packet=JSON.parse(String(bytes));}
      catch{ws.close(1003,'invalid_json');return;}
      if(!packet||typeof packet!=='object'||Array.isArray(packet)){
        ws.close(1003,'invalid_frame');return;
      }
      if(state==='awaiting_auth'){
        if(packet.type!=='hello'){ws.close(1008,'auth_required');return;}
        state='authenticating';
        try{
          const token=packet.token;
          const user=await store.authenticated(token);
          const selection=await store.selectedCharacter(token);
          const profile=await store.profile({userId:user.id,hero:selection.hero});
          const existing=clientsByUser.get(user.id);
          if(existing&&existing!==ws){
            // Verified account reconnects to exact existing seat, not a second seat.
            existing.close(1000,'session_replaced');
          }
          if(ws.readyState!==WebSocket.OPEN)return;
          session={userId:user.id,hero:selection.hero,profile,eligible:profile.eligible,
            verified:true,snapshot:profile.eligible?
              deriveVerifiedArenaSnapshot(selection,profile):null,
            send:message=>sendRaw(ws,message),disconnectedAt:null,
            lastCommandSeq:0};
          clientsByUser.set(user.id,ws);
          state='authed';
          // Resume is authoritative; never re-queue a live seat on reconnection.
          const resumed=coordinator.reattach(session);
          sendRaw(ws,{type:'hello_ok',hero:session.hero,rankedEligible:session.eligible,
            diamonds:profile.diamonds,rating:profile.rating,resumed});
        }catch(error){
          metrics.rejected++;
          sendRaw(ws,{type:'error',code:'authentication_or_rank_eligibility_failed'});
          ws.close(1008,'auth_rejected');
        }
        return;
      }
      if(state!=='authed'||!session)return;
      if(packet.type==='queue'){
        try{
          // Refresh independently verified character/account state at each queue.
          // No client-supplied item, Diamond or rating value is used.
          await coordinator.enqueue(session,packet.mode,packet.mapId);
        }catch(error){
          sendRaw(ws,{type:'error',code:
            typeof error?.message==='string'&&/^[a-z_]{3,64}$/.test(error.message)
              ?error.message:'queue_rejected'});
        }
      }else if(packet.type==='action'){
        const success=coordinator.input(session,packet.seq,packet.action);
        if(!success)sendRaw(ws,{type:'command_rejected',seq:Number.isSafeInteger(packet.seq)?packet.seq:0});
      }else if(packet.type==='leave'){
        coordinator.disconnect(session,{intentional:true});
        sendRaw(ws,{type:'left'});
      }else if(packet.type==='ping'){
        sendRaw(ws,{type:'pong',serverTime:Date.now()});
      }else{
        sendRaw(ws,{type:'error',code:'unsupported_message'});
      }
    }).catch(()=>{metrics.rejected++;ws.close(1011,'server_error');});
  });
  ws.on('close',()=>{
    if(session){
      coordinator.disconnect(session);
      if(clientsByUser.get(session.userId)===ws)clientsByUser.delete(session.userId);
    }
  });
  ws.on('error',()=>{/* WebSocket close handles safe session cleanup */});
});

await store.expire(); // Refuse ranked readiness when crash-refund recovery RPC is missing.
ready=true;
server.listen(PORT,HOST,()=>{
  console.log('[arena] ready on protected internal listener',PORT);
});

const gameClock=setInterval(()=>{
  if(stopping)return;
  void coordinator.heartbeat().catch(error=>console.error('[arena] heartbeat_failed',
    typeof error?.message==='string'?error.message.slice(0,80):'error'));
},100);
gameClock.unref();
const expireClock=setInterval(()=>{
  if(stopping)return;
  void store.expire().catch(()=>console.error('[arena] refund_recovery_degraded'));
},60_000);
expireClock.unref();

async function shutdown(signal){
  if(stopping)return;
  stopping=true;ready=false;
  clearInterval(gameClock);clearInterval(expireClock);
  wss.clients.forEach(ws=>ws.close(1001,'server_shutdown'));
  try{await coordinator.shutdown();}
  catch(error){console.error('[arena] refund_pending_after_shutdown');}
  server.close();
  console.log('[arena] stopped',signal);
}
process.once('SIGINT',()=>{void shutdown('SIGINT');});
process.once('SIGTERM',()=>{void shutdown('SIGTERM');});
