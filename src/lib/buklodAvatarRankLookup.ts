/**
 * One bounded, viewer-scoped rank RPC for many visible avatars.
 * Never guess rank from displayed name or mix credentials across accounts.
 */
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { resolveCircleRankArt } from '@/lib/buklodSeason2RankArt';
type RankEntry={value:string|null;expires:number};
const TTL=90_000;
const MAX=1000;
const cache=new Map<string,RankEntry>();
const listeners=new Map<string,Set<(rank:string|null)=>void>>();
const pending=new Map<string,Set<string>>();
const retryUntil=new Map<string,number>();
let scheduled:ReturnType<typeof setTimeout>|null=null;
const key=(viewer:string,target:string)=>viewer+':'+target;
export function peekAvatarCircleRank(viewer:string,target:string):string|null {
  return cache.get(key(viewer,target))?.value??null;
}
export function publishAvatarCircleRank(viewer:string,target:string,name:string|null) {
  if(!viewer||!target) return;
  const value=resolveCircleRankArt(name)?String(name):null;
  const id=key(viewer,target);
  cache.delete(id);
  cache.set(id,{value,expires:Date.now()+TTL});
  if(cache.size>MAX){const first=cache.keys().next().value;if(first)cache.delete(first);}
  for(const fn of listeners.get(id)??[])fn(value);
}
function schedule(viewer:string,target:string) {
  const id=key(viewer,target),warm=cache.get(id);
  if(warm && warm.expires>Date.now())return;
  if((retryUntil.get(id)??0)>Date.now())return;
  const queue=pending.get(viewer)??new Set<string>();
  queue.add(target);pending.set(viewer,queue);
  if(scheduled===null)scheduled=setTimeout(()=>{scheduled=null;void flush();},35);
}
async function flush(){
  const batches=[...pending.entries()];pending.clear();
  for(const [viewer,ids] of batches){
    const all=[...ids];
    for(let n=0;n<all.length;n+=65){
      const group=all.slice(n,n+65);
      try {
        const {data,error}=await withBuklodTimeout<any>(
          (supabase as any).rpc('get_member_circle_ranks_v1',{p_user_ids:group}),
          5000,'Circle ranks for avatars'
        );
        if(error)throw error;
        // A slow account switch must never inject another user's rank.
        const {data:session}=await supabase.auth.getSession();
        if(session.session?.user?.id!==viewer)continue;
        const rows=Array.isArray(data)?data:[];
        const byId=new Map<string,string>();
        for(const row of rows){
          if(typeof row?.user_id==='string' && resolveCircleRankArt(row?.rank_name))
            byId.set(row.user_id,String(row.rank_name));
        }
        for(const target of group)publishAvatarCircleRank(viewer,target,byId.get(target)??null);
      } catch {
        for(const target of group)retryUntil.set(key(viewer,target),Date.now()+30_000);
      }
    }
  }
}
export function subscribeAvatarCircleRank(
 viewer:string,target:string,listener:(rank:string|null)=>void
):()=>void {
  if(!viewer||!target)return ()=>undefined;
  const id=key(viewer,target),items=listeners.get(id)??new Set<(rank:string|null)=>void>();
  items.add(listener);listeners.set(id,items);
  listener(peekAvatarCircleRank(viewer,target));
  schedule(viewer,target);
  return ()=>{
    items.delete(listener);
    if(!items.size)listeners.delete(id);
  };
}
