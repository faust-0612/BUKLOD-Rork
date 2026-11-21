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
import { SupabaseArenaStore } from './supabaseStore.mjs';
import { attachArenaTransport } from './transport.mjs';

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

attachArenaTransport({
  wss,store,coordinator,clientsByUser,metrics,sendRaw,isStopping:()=>stopping,
});

await store.expire(); // Refuse ranked readiness when crash-refund recovery RPC is missing.
ready=true;
server.listen(PORT,HOST,()=>{
  console.log('[arena] ready on protected internal listener',PORT);
});

let heartbeatPending=false;
const gameClock=setInterval(()=>{
  // Settlement may await a database transaction. Never run another game tick
  // concurrently with the previous heartbeat or mutate a finalizing match.
  if(stopping||heartbeatPending)return;
  heartbeatPending=true;
  void coordinator.heartbeat()
    .catch(error=>console.error('[arena] heartbeat_failed',
      typeof error?.message==='string'?error.message.slice(0,80):'error'))
    .finally(()=>{heartbeatPending=false;});
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
