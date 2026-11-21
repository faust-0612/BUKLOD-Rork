/**
 * Single Arena WebSocket protocol shared by production gateway and disposable
 * wire-level tests. Trusted store comes from server entrypoint, NEVER from client.
 * No bypass, test-mode secret, or production schema mutation.
 */
import { WebSocket } from 'ws';
import { deriveVerifiedArenaSnapshot } from './supabaseStore.mjs';

export function attachArenaTransport({wss,store,coordinator,clientsByUser,metrics,sendRaw,isStopping,authTimeoutMs=8000}){
  if(!Number.isInteger(authTimeoutMs)||authTimeoutMs<500||authTimeoutMs>30000)
    throw Error('invalid_auth_timeout');
wss.on('connection',ws=>{
  metrics.connections++;
  let state='awaiting_auth';
  // Unauthenticated sockets have a hard lifetime, avoiding memory/connection
  // exhaustion by peers that never present a valid BUKLOD Supabase token.
  const authTimer=setTimeout(()=>{
    if(state!=='authed'&&ws.readyState===WebSocket.OPEN)
      ws.close(1008,'auth_timeout');
  },authTimeoutMs);
  authTimer.unref?.();
  let session=null;
  let messageChain=Promise.resolve();
  ws.on('message',bytes=>{
    // Explicit serialization prevents overlapping async auth/queue/command races.
    messageChain=messageChain.then(async()=>{
      if(ws.readyState!==WebSocket.OPEN||isStopping())return;
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
          clearTimeout(authTimer);
          // Resume is authoritative; never re-queue a live seat on reconnection.
          const resumed=coordinator.reattach(session);
          sendRaw(ws,{type:'hello_ok',hero:session.hero,
            // A resumed match already holds the user's legitimately earned Diamond.
            // Zero currently spendable Diamonds must not block a verified reattach.
            rankedEligible:session.eligible||resumed,
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
    clearTimeout(authTimer);
    if(session){
      coordinator.disconnect(session);
      if(clientsByUser.get(session.userId)===ws)clientsByUser.delete(session.userId);
    }
  });
  ws.on('error',()=>{/* WebSocket close handles safe session cleanup */});
});
}
