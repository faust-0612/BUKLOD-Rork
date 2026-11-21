/**
 * In-app Arena ranked transport — NO game authority, no wallet writes.
 * Supabase user access token goes to the owned WSS Arena server only.
 * All match positions, outcomes and Diamond ledgers come from that server.
 */
import { supabase } from '@/lib/supabase';

type Mode='duel'|'cluster'|'grand';
type ArenaScene='genesis_rift'|'aurora_foundry'|'verdant_fracture';

type MatchPacket = Record<string,unknown> & {type:string};

export function isArenaRankedConfigured():boolean {
  const enabled=process.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED==='true';
  const endpoint=process.env.EXPO_PUBLIC_BUKLOD_ARENA_WS_URL||'';
  if(!enabled||!/^wss:\/\//.test(endpoint))return false;
  try {
    const url=new URL(endpoint);
    return url.protocol==='wss:' && Boolean(url.hostname) &&
      !url.username && !url.password && !url.hash && !url.search &&
      url.pathname==='/arena-v2';
  } catch {return false;}
}

type ArenaCallbacks={
  onPacket:(packet:MatchPacket)=>void;
  onError:(message:string)=>void;
};

export class ArenaRankedSocket {
  private ws:WebSocket|null=null;
  private nextSeq=0;
  private queue:{mode:Mode;mapId:ArenaScene}|null=null;
  private active=false;
  private ready=false;
  private closed=false;
  private readonly callbacks:ArenaCallbacks;

  constructor(callbacks:ArenaCallbacks){this.callbacks=callbacks;}

  async connectAndQueue(mode:Mode,mapId:ArenaScene,expectedUserId:string){
    if(!isArenaRankedConfigured())throw Error('Arena ranked server not configured');
    if(this.ws)throw Error('Arena connection already created');
    const {data,error}=await supabase.auth.getSession();
    const session=data.session;
    if(error||!session||session.user.id!==expectedUserId||!session.access_token)
      throw Error('Bangkang authorization expired — please sign in again');
    if(this.closed)return;
    this.queue={mode,mapId};
    const socket=new WebSocket(process.env.EXPO_PUBLIC_BUKLOD_ARENA_WS_URL!);
    this.ws=socket;
    const timeout=setTimeout(()=>{
      if(!this.ready && !this.closed){
        this.callbacks.onError('Ranked connection timed out');
        socket.close();
      }
    },12000);
    socket.onopen=()=>{
      if(this.closed){socket.close();return;}
      socket.send(JSON.stringify({type:'hello',token:session.access_token}));
    };
    socket.onmessage=(event)=>{
      if(this.closed)return;
      let packet:MatchPacket;
      try{
        const decoded=JSON.parse(String(event.data));
        if(!decoded||typeof decoded!=='object'||typeof decoded.type!=='string')return;
        packet=decoded as MatchPacket;
      }catch{return;}
      if(packet.type==='hello_ok'){
        this.ready=true;clearTimeout(timeout);
        if(packet.rankedEligible!==true){
          this.callbacks.onError('Ranked requires an earned Character Diamond. Participate to qualify.');
          socket.close();return;
        }
        socket.send(JSON.stringify({type:'queue',mode:this.queue!.mode,mapId:this.queue!.mapId}));
      }
      if(packet.type==='match_start'||packet.type==='match_resume')this.active=true;
      if(packet.type==='match_end'||packet.type==='match_aborted')this.active=false;
      this.callbacks.onPacket(packet);
    };
    socket.onerror=()=>{
      if(!this.closed)this.callbacks.onError('Arena network unavailable; no result has been accepted.');
    };
    socket.onclose=()=>{
      clearTimeout(timeout);
      if(!this.closed&&this.active)
        this.callbacks.onError('Connection lost. Reconnect within 20 seconds to avoid a ranked forfeit.');
      this.active=false;
      this.ready=false;
    };
  }

  sendAction(action:Record<string,unknown>):boolean{
    const ws=this.ws;
    if(!ws||ws.readyState!==WebSocket.OPEN||!this.active)return false;
    const seq=++this.nextSeq;
    ws.send(JSON.stringify({type:'action',seq,action}));
    return true;
  }

  leave(){
    if(this.ws?.readyState===WebSocket.OPEN)
      this.ws.send(JSON.stringify({type:'leave'}));
    this.close();
  }

  close(){
    this.closed=true;this.ready=false;this.active=false;
    const ws=this.ws;this.ws=null;
    if(ws){ws.onmessage=null;ws.onerror=null;ws.onopen=null;ws.onclose=null;
      try{ws.close();}catch{/* disposal best effort */}}
  }
}
