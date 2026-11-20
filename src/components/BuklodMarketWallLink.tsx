import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { marketMarkerId } from '@/lib/buklodMarketLink';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type Preview = { title:string;price_php:number;unit:string;stock_status:string;image_path?:string|null;store?:{name:string}|null };
export default function BuklodMarketWallLink({body,postId}:{body:string;postId:string}) {
  const id=marketMarkerId(body);
  const {theme}=useBuklodTheme();
  const [value,setValue]=useState<Preview|null|undefined>(undefined);
  useEffect(()=>{
    if(!id)return;
    let active=true;
    setValue(undefined);
    void (async()=>{
      const {data:link,error:linkError}=await (supabase as any)
        .from('buklod_market_wall_shares').select('post_id')
        .eq('post_id',postId).eq('listing_id',id).maybeSingle();
      if(linkError || !link){if(active)setValue(null);return;}
      const {data,error}=await (supabase as any).from('buklod_market_listings')
        .select('title,price_php,unit,stock_status,image_path,store:buklod_market_stores!inner(name)')
        .eq('id',id).eq('publication_state','published').eq('moderation_state','approved')
        .maybeSingle();
      if(active)setValue(error?null:(data as Preview|null));
    })().catch(()=>{if(active)setValue(null);});
    return ()=>{active=false;};
  },[id,postId]);
  if(!id || value===undefined || value===null)return null;
  const available=value?.stock_status==='available';
  return <Pressable accessibilityRole="button" accessibilityLabel="Open Market listing"
    onPress={()=>router.push({pathname:'/profile/buklod-market',params:{listing_id:id}} as any)}
    style={[styles.root,{backgroundColor:theme.surfaceMuted,borderColor:theme.border}]}>
    {value?.image_path ? <Image source={{uri:supabase.storage.from('buklod-market-media').getPublicUrl(value.image_path).data.publicUrl}} style={{width:74,height:70,borderRadius:8}}/> : <MaterialCommunityIcons name="storefront-outline" size={21} color="#278744"/>}
    <View style={{flex:1,gap:3}}>
      <Text style={{fontSize:11,fontWeight:'800',color:'#278744'}}>BUKLOD MARKET</Text>
      <Text numberOfLines={2} style={{fontSize:14,fontWeight:'800',color:theme.textPrimary}}>
        {value===undefined?'Binubuksan ang paninda...':value?.title||'Listing unavailable'}
      </Text>
      {value?<Text style={{fontSize:12,color:theme.textMuted}}>{value.store?.name||'Seller'} · ₱{Number(value.price_php).toLocaleString('en-PH')}/{value.unit} · {available?'Available':'Sold out'}</Text>:null}
    </View>
    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textMuted}/>
  </Pressable>;
}
const styles=StyleSheet.create({
  root:{flexDirection:'row',gap:8,alignItems:'center',padding:10,borderRadius:11,borderWidth:1,marginTop:6}
});
