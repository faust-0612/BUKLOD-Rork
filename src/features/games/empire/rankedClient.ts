/**
 * BUKLOD in-app authoritative Arena ranked transport.
 *
 * The client never decides outcomes, Diamond balances or server-side character
 * eligibility. Only an owned WSS endpoint receives the Supabase session token.
 * Reconnects resume the server-owned seat without silently staking another
 * earned Diamond or queueing a new match.
 */
import { supabase } from '@/lib/supabase';

type Mode='duel'|'cluster'|'grand';
type ArenaScene='genesis_rift'|'aurora_foundry'|'verdant_fracture';
type MatchPacket=Record<string,unknown> & {type:string};
type Callbacks={onPacket:(packet:MatchPacket)=>void;onError:(message:string)=>void};

const RECONNECT_DELAYS_MS=[800,1700,3200] as const;
const RANKED_REATTACH_WINDOW_MS=19000;
const HANDSHAKE_TIMEOUT_MS=10000;

export function isArenaRankedConfigured():boolean{
  // Never enable ranked/escrow in production or outside reviewed Genesis preview.
  if(process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW!=='true'||
     !['staging','preview','development','dev'].includes(
       String(process.env.EXPO_PUBLIC_APP_ENV||'').toLowerCase()))return false;
  if(process.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED!=='true')return false;
  const endpoint=process.env.EXPO_PUBLIC_BUKLOD_ARENA_WS_URL||'';
  if(!/^wss:\/\//.test(endpoint))return false;
  try{
    const u=new URL(endpoint);
    return u.protocol==='wss:'&&Boolean(u.hostname)&&!u.username&&!u.password&&
      !u.hash&&!u.search&&u.pathname==='/arena-v2';
  }catch{return false;}
}

export class ArenaRankedSocket{
  private ws:WebSocket|null=null;
  private nextSeq=0;
  private queue:{mode:Mode;mapId:ArenaScene}|null=null;
  private expectedUserId:string|null=null;
  private active=false;
  private ready=false;
  private closed=false;
  private finished=false;
  private resumeOnly=false;
  private reconnectDeadline=0;
  private retryAttempts=0;
  private retryTimer:ReturnType<typeof setTimeout>|null=null;
  private handshakeTimer:ReturnType<typeof setTimeout>|null=null;
  private readonly callbacks:Callbacks;

  constructor(callbacks:Callbacks){this.callbacks=callbacks;}

  async connectAndQueue(mode:Mode,mapId:ArenaScene,expectedUserId:string){
    if(!isArenaRankedConfigured())throw Error('Arena ranked server not configured');
    if(this.ws||this.queue||this.closed)throw Error('Arena connection already created');
    this.queue={mode,mapId};
    this.expectedUserId=expectedUserId;
    try{await this.openConnection();}
    catch(error){this.queue=null;this.expectedUserId=null;throw error;}
  }

  private clearHandshake(){
    if(this.handshakeTimer!==null)clearTimeout(this.handshakeTimer);
    this.handshakeTimer=null;
  }

  private async openConnection(){
    if(this.closed||!this.queue||!this.expectedUserId)return;
    if(this.ws)return;
    const {data,error}=await supabase.auth.getSession();
    const session=data.session;
    if(error||!session||session.user.id!==this.expectedUserId||!session.access_token)
      throw Error('Ranked sign-in expired. Please sign in again.');
    if(this.closed)return;
    const ws=new WebSocket(process.env.EXPO_PUBLIC_BUKLOD_ARENA_WS_URL!);
    this.ws=ws;
    this.ready=false;
    this.handshakeTimer=setTimeout(()=>{
      if(!this.closed&&!this.ready&&this.ws===ws){
        this.callbacks.onError('Arena ranked connection timed out.');
        ws.close();
      }
    },HANDSHAKE_TIMEOUT_MS);

    ws.onopen=()=>{
      if(this.closed||this.ws!==ws){ws.close();return;}
      ws.send(JSON.stringify({type:'hello',token:session.access_token}));
    };
    ws.onmessage=event=>{
      if(this.closed||this.ws!==ws)return;
      let packet:MatchPacket;
      try{
        const parsed=JSON.parse(String(event.data));
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||typeof parsed.type!=='string')return;
        packet=parsed as MatchPacket;
      }catch{return;}
      if(packet.type==='hello_ok'){
        this.ready=true;
        this.clearHandshake();
        // Reconnect is an existing stake, not permission to mint/reserve a second one.
        if(this.resumeOnly&&packet.resumed!==true){
          this.callbacks.onError('The server could not resume the previous ranked match. Check its authoritative result.');
          this.close();
          return;
        }
        if(packet.rankedEligible!==true){
          this.callbacks.onError('An earned Character Diamond is needed to queue for ranked play.');
          this.close();
          return;
        }
        if(packet.resumed!==true&&this.queue){
          ws.send(JSON.stringify({type:'queue',mode:this.queue.mode,mapId:this.queue.mapId}));
        }
      }
      if(packet.type==='match_start'||packet.type==='match_resume'){
        // Server binds a fresh authenticated socket to a new command sequence.
        // Long-running matches can exceed seq 1000 before a network drop;
        // continuing the old counter would be rejected forever after resume.
        if(packet.type==='match_resume')this.nextSeq=0;
        this.active=true;
        this.resumeOnly=false;
        this.retryAttempts=0;
        this.reconnectDeadline=0;
      }
      if(packet.type==='match_end'||packet.type==='match_aborted'){
        this.active=false;
        this.finished=true;
      }
      this.callbacks.onPacket(packet);
    };
    ws.onerror=()=>{
      if(!this.closed&&this.ws===ws)
        this.callbacks.onError('Arena network interrupted. Only the server can confirm match results.');
    };
    ws.onclose=()=>{
      if(this.ws!==ws)return;
      this.clearHandshake();
      this.ws=null;
      const wasActive=this.active;
      this.active=false;this.ready=false;
      if(this.closed||this.finished)return;
      if(wasActive){
        this.resumeOnly=true;
        this.reconnectDeadline=Date.now()+RANKED_REATTACH_WINDOW_MS;
        this.callbacks.onError('Connection interrupted. Reconnecting to the same ranked seat.');
      }
      this.scheduleRetry();
    };
  }

  private scheduleRetry(){
    if(this.closed||this.finished||!this.queue)return;
    if(this.retryAttempts>=RECONNECT_DELAYS_MS.length||
       (this.resumeOnly&&Date.now()>=this.reconnectDeadline)){
      this.callbacks.onError('Arena reconnect limit reached. Ranked settlement remains server-owned.');
      this.close();
      return;
    }
    const delay=RECONNECT_DELAYS_MS[this.retryAttempts++];
    if(this.resumeOnly&&Date.now()+delay>=this.reconnectDeadline){
      this.callbacks.onError('Ranked reconnection grace elapsed. Server will settle or refund.');
      this.close();
      return;
    }
    this.retryTimer=setTimeout(()=>{
      this.retryTimer=null;
      if(this.closed)return;
      void this.openConnection().catch(()=>{
        if(!this.closed)this.scheduleRetry();
      });
    },delay);
  }

  sendAction(action:Record<string,unknown>):boolean{
    const ws=this.ws;
    if(!ws||ws.readyState!==WebSocket.OPEN||!this.active||ws.bufferedAmount>64_000)return false;
    ws.send(JSON.stringify({type:'action',seq:++this.nextSeq,action}));
    return true;
  }

  leave(){
    if(this.ws?.readyState===WebSocket.OPEN){
      try{this.ws.send(JSON.stringify({type:'leave'}));}catch{/* disconnect still clears */ }
    }
    this.close();
  }

  close(){
    this.closed=true;
    this.finished=true;
    this.ready=false;this.active=false;
    this.clearHandshake();
    if(this.retryTimer!==null)clearTimeout(this.retryTimer);
    this.retryTimer=null;
    const ws=this.ws;
    this.ws=null;
    if(ws){
      ws.onmessage=null;ws.onerror=null;ws.onopen=null;ws.onclose=null;
      try{ws.close();}catch{/* best-effort disposal */}
    }
  }
}
