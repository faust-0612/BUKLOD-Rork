import {useCallback,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {supabase} from '@/lib/supabase';
import {signedBuklodScopeHomeAsset} from '@/lib/buklodScopeHomeAssets';

type Photo={url:string|null;expires:number};
const cache=new Map<string,Photo>();
const pending=new Map<string,Promise<string|null>>();
const generation=new Map<string,number>();
const listeners=new Set<(scopeId:string)=>void>();
const TTL=12*60*1000;
export function notifyBuklodScopePhotoUpdated(scopeId:string){
  for(const key of new Set([...cache.keys(),...pending.keys()])){
    if(key.endsWith(':'+scopeId)){
      cache.delete(key);
      pending.delete(key);
      generation.set(key,(generation.get(key)??0)+1);
    }
  }
  listeners.forEach(listener=>listener(scopeId));
}
async function resolvePhoto(key:string,scopeId:string):Promise<string|null>{
  const cached=cache.get(key);
  if(cached&&cached.expires>Date.now())return cached.url;
  if(pending.has(key))return pending.get(key)!;
  const version=generation.get(key)??0;
  const request=(async()=>{
    const {data,error}=await supabase.from('buklod_scopes')
      .select('profile_photo_path').eq('id',scopeId).maybeSingle();
    if(error||!data)return null;
    const url=await signedBuklodScopeHomeAsset((data as any).profile_photo_path);
    if((generation.get(key)??0)!==version)return null;
    if(cache.size>=120)cache.delete(cache.keys().next().value as string);
    cache.set(key,{url,expires:Date.now()+TTL});
    return url;
  })();
  pending.set(key,request);
  try{return await request;}finally{
    if(pending.get(key)===request)pending.delete(key);
  }
}
export function useBuklodScopePhoto(scopeId:string|null|undefined):string|null{
  const {user}=useAuth();
  const key=user?.id&&scopeId?`${user.id}:${scopeId}`:'';
  const [photo,setPhoto]=useState<{key:string;url:string|null}>({key:'',url:null});
  useFocusEffect(useCallback(()=>{
    let active=true;
    const refresh=()=>{
      if(!key||!scopeId){setPhoto({key,url:null});return;}
      void resolvePhoto(key,scopeId).then(url=>{
        if(active)setPhoto({key,url});
      }).catch(()=>{if(active)setPhoto({key,url:null});});
    };
    const changed=(id:string)=>{if(id===scopeId)refresh();};
    listeners.add(changed);refresh();
    return()=>{active=false;listeners.delete(changed);};
  },[key,scopeId]));
  return photo.key===key?photo.url:null;
}
