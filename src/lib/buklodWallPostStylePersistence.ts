import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { canSelectWallPostDesign, canSelectWallFont, resolveWallPostDesign, wallDesignMotionAllowed, wallFontForViewer, type WallFontId } from '@/lib/buklodWallPostDesigns';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export type WallPostStyle = { designId: string | null; fontId: WallFontId; animated: boolean };
export const DEFAULT_WALL_POST_STYLE: WallPostStyle = {designId:null,fontId:'standard',animated:false};
export function normalizeWallPostStyle(value:any):WallPostStyle {
  const design=resolveWallPostDesign(value?.design_id);
  return {designId:design?.id??null,fontId:wallFontForViewer(value?.font_id),animated:!!design&&value?.animated===true};
}
export function authorizeWallPostStyle(style:WallPostStyle,rank:string|null,hasMedia:boolean):WallPostStyle {
  if(hasMedia)return DEFAULT_WALL_POST_STYLE;
  const design=resolveWallPostDesign(style.designId);
  const allowed=!!design&&canSelectWallPostDesign(design.id,rank);
  return {designId:allowed?design!.id:null,fontId:canSelectWallFont(style.fontId,rank)?style.fontId:'standard',
    animated:allowed&&style.animated&&wallDesignMotionAllowed(design!,rank)};
}
export function isDefaultWallPostStyle(style:WallPostStyle) {
  return style.designId===null&&style.fontId==='standard'&&!style.animated;
}
export async function persistWallPostStyle(postId:string,userId:string,style:WallPostStyle) {
  if(isDefaultWallPostStyle(style))return;
  const {data:auth}=await supabase.auth.getSession();
  if(auth.session?.user.id!==userId)throw Error('Account changed');
  const {error}=await (supabase as any).from('buklod_wall_post_styles_v1').upsert({
    post_id:postId,author_id:userId,design_id:style.designId,font_id:style.fontId,animated:style.animated,
  },{onConflict:'post_id',ignoreDuplicates:true});
  if(error)throw error;
  // A retry must read the original stored style rather than silently overwrite it.
  const result=await (supabase as any).from('buklod_wall_post_styles_v1').select('design_id,font_id,animated').eq('post_id',postId).single();
  if(result.error)throw result.error;
  const actual=normalizeWallPostStyle(result.data);
  if(actual.designId!==style.designId||actual.fontId!==style.fontId||actual.animated!==style.animated)throw Error('Different post style already saved');
}
/** Bounded reads; no viewer rank check, no additional requests while flag off. */
export function useWallPostStyles(userId:string|undefined,posts:readonly {id:unknown}[],composerOpen:boolean,scopeKey='public') {
  const {config}=useRuntimeConfig();
  const enabled=config?.features?.rank_wall_designs===true&&!!userId;
  const owner=enabled?userId+':'+scopeKey:'';
  const [rankState,setRankState]=useState<{owner:string;name:string|null}>({owner:'',name:null});
  const [stylesState,setStylesState]=useState<{owner:string;rows:Record<string,WallPostStyle>}>({owner:'',rows:{}});
  const ids=useMemo(()=>Array.from(new Set(posts.map(p=>String(p.id??'')).filter(Boolean))).sort().join(','),[posts]);
  const rankEpoch=useRef(0),readEpoch=useRef(0);
  useEffect(()=>{
    const seq=++rankEpoch.current;
    if(!owner||!composerOpen)return;
    setRankState({owner,name:null});
    void Promise.resolve(supabase.rpc('get_my_buklod_rank_progress')).then(({data,error})=>{
      if(seq!==rankEpoch.current||error)return;
      const name=Array.isArray(data)&&typeof data[0]?.rank_name==='string'?data[0].rank_name:null;
      setRankState({owner,name});
    }).catch(()=>{});
    return()=>{rankEpoch.current++;};
  },[owner,composerOpen]);
  useEffect(()=>{
    const seq=++readEpoch.current;
    if(!owner||!ids)return;
    void (async()=>{
      try{
        const list=ids.split(',');
        const result:Record<string,WallPostStyle>={};
        for(let i=0;i<list.length;i+=80){
          const {data,error}=await (supabase as any).from('buklod_wall_post_styles_v1')
            .select('post_id,design_id,font_id,animated').in('post_id',list.slice(i,i+80));
          if(error)throw error;
          if(seq!==readEpoch.current)return;
          for(const row of data??[])result[String(row.post_id)]=normalizeWallPostStyle(row);
        }
        if(seq===readEpoch.current)setStylesState({owner,rows:result});
      }catch{/* Text and media remain readable when optional style metadata is unavailable. */}
    })();
    return()=>{readEpoch.current++;};
  },[owner,ids]);
  const remember=useCallback((postId:string,style:WallPostStyle)=>{
    if(!owner)return;
    setStylesState(prev=>({owner,rows:{...(prev.owner===owner?prev.rows:{}),[postId]:style}}));
  },[owner]);
  return {enabled,rankName:rankState.owner===owner&&owner?rankState.name:null,
    styles:stylesState.owner===owner&&owner?stylesState.rows:{},remember};
}
