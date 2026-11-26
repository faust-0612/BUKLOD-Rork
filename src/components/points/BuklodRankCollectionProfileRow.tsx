import React,{useCallback,useRef,useState} from 'react';
import {useFocusEffect,router} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {supabase} from '@/lib/supabase';
import {withBuklodTimeout} from '@/lib/buklodAsyncTimeout';
import {BuklodProfileGlassCard,BuklodProfileGlassRow} from '@/components/BuklodProfileGlassCard';

type Snapshot={owner:string;pending:number;redeemed:number};
export default function BuklodRankCollectionProfileRow(){
  const {user}=useAuth();
  const {config}=useRuntimeConfig();
  const owner=user?.id??'';
  const enabled=!!owner&&config?.features?.rank_bonus_collections===true;
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [failed,setFailed]=useState(false);
  const lastFetch=useRef({owner:'',at:0});
  useFocusEffect(useCallback(()=>{
    if(!enabled)return;
    let active=true;
    setFailed(false);
    if(lastFetch.current.owner===owner&&Date.now()-lastFetch.current.at<15000)return;
    void (async()=>{
      try{
        const query=(supabase as any).from('buklod_rank_bonus_ledger_v1')
          .select('bonus_key,redeemed_at').eq('user_id',owner)
          .is('revoked_at',null).lte('available_at',new Date().toISOString()).limit(40);
        const result=await withBuklodTimeout<{data:{bonus_key:string;redeemed_at:string|null}[]|null;error:unknown}>(query,5000,'My collections');
        if(result.error||!Array.isArray(result.data))throw Error('unavailable');
        if(!active)return;
        const redeemed=result.data.filter(r=>!!r.redeemed_at).length;
        setSnapshot({owner,pending:result.data.length-redeemed,redeemed});
        lastFetch.current={owner,at:Date.now()};
      }catch{if(active){setFailed(true);setSnapshot(null);}}
    })();
    return()=>{active=false;};
  },[enabled,owner]));
  if(!enabled)return null;
  const count=snapshot?.owner===owner?snapshot:null;
  const subtitle=failed?'Open to refresh your rewards':count
    ?count.pending+' unredeemed · '+count.redeemed+' redeemed'
    :'View rewards and upcoming collections';
  return <BuklodProfileGlassCard><BuklodProfileGlassRow icon="gift-outline"
    title={count&&count.pending>0?'My Collections ('+count.pending+')':'My Collections'}
    subtitle={subtitle} onPress={()=>router.push('/points/progression' as any)}/></BuklodProfileGlassCard>;
}
