/**
 * Ephemeral Season 2 Realtime presence. Only an actively subscribed,
 * foregrounded, authenticated app is shown online. No inferred last-seen.
 * One channel per runtime, not one channel per avatar.
 */
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
type Callback=()=>void;
const callbacks=new Set<Callback>();
let viewer='';
let channel:ReturnType<typeof supabase.channel>|null=null;
let foreground=AppState.currentState==='active';
let online=new Set<string>();
let appSubscription:ReturnType<typeof AppState.addEventListener>|null=null;
function notify(){for(const callback of callbacks)callback();}
function refresh(){
  const next=new Set<string>();
  if(foreground&&channel){
    const state=channel.presenceState() as Record<string,unknown>;
    for(const [key,items] of Object.entries(state)){
      if(!Array.isArray(items))continue;
      for(const item of items){
        const row=item as Record<string,unknown>;
        const id=typeof row.user_id==='string'?row.user_id:key;
        if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))next.add(id);
      }
    }
  }
  online=next;notify();
}
function close(){
  const old=channel;channel=null;online.clear();notify();
  if(old){void old.untrack().catch(()=>undefined);void supabase.removeChannel(old);}
}
function start(id:string){
  if(!id||AppState.currentState!=='active')return;
  if(channel&&viewer===id)return;
  close();viewer=id;foreground=true;
  const connected=supabase.channel('buklod-season2-member-presence',{
    config:{presence:{key:id}},
  });
  channel=connected;
  connected.on('presence',{event:'sync'},refresh)
    .on('presence',{event:'join'},refresh)
    .on('presence',{event:'leave'},refresh)
    .subscribe(status=>{
      if(status==='SUBSCRIBED'&&foreground&&channel===connected){
        void connected.track({user_id:id}).catch(()=>undefined);
      }
    });
}
export function avatarIsOnline(id:string):boolean {
  return Boolean(id&&online.has(id));
}
export function subscribeAvatarOnline(viewerId:string,callback:Callback):()=>void {
  if(!viewerId)return ()=>undefined;
  callbacks.add(callback);
  if(!appSubscription){
    appSubscription=AppState.addEventListener('change',state=>{
      foreground=state==='active';
      if(!foreground){close();return;}
      if(viewer)start(viewer);
    });
  }
  if(viewer!==viewerId){viewer=viewerId;close();}
  if(!channel)start(viewerId);
  callback();
  return ()=>{
    callbacks.delete(callback);
    if(!callbacks.size){
      close();viewer='';appSubscription?.remove();appSubscription=null;
    }
  };
}
