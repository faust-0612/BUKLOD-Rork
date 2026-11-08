import React,{useCallback,useState} from 'react';
import {ActivityIndicator,Alert,Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useFocusEffect} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {notifyBuklodScopePhotoUpdated} from '@/hooks/useBuklodScopePhoto';
import {
 pickBuklodScopeHomeMedia,uploadBuklodScopeHomeAsset,
 signedBuklodScopeHomeAsset,rollbackBuklodScopeHomeAsset,
} from '@/lib/buklodScopeHomeAssets';

/** Same canonical media identity for a Cluster, Organization and Sub-organization. */
export default function BuklodScopeProfilePhoto({
 scopeId,scopeName,isAdmin,
}:{scopeId:string;scopeName:string;isAdmin:boolean}){
 const [url,setUrl]=useState<string|null>(null);
 const [path,setPath]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [note,setNote]=useState('');
 const load=useCallback(async()=>{
   let {data,error}=await supabase.from('buklod_scopes')
     .select('profile_photo_path').eq('id',scopeId).maybeSingle();
   if(error)return;
   const nextPath=(data as any)?.profile_photo_path??null;
   setPath(nextPath);
   setUrl(await signedBuklodScopeHomeAsset(nextPath));
 },[scopeId]);
 useFocusEffect(useCallback(()=>{
   let active=true;
   void load().catch(()=>{if(active)setNote('Photo unavailable offline.');});
   return ()=>{active=false;};
 },[load]));
 const choose=async()=>{
   if(!isAdmin||busy)return;
   setBusy(true);setNote('');
   let uploaded:string|null=null;
   try{
     const asset=await pickBuklodScopeHomeMedia(true);
     if(!asset)return;
     const result=await uploadBuklodScopeHomeAsset({scopeId,kind:'profile',asset});
     uploaded=result.storagePath;
     const {data,error}=await supabase.from('buklod_scopes')
       .update({profile_photo_path:result.storagePath})
       .eq('id',scopeId).select('id').single();
     if(error||!data?.id)throw error??new Error('No profile photo was updated.');
     uploaded=null;
     await load();
     notifyBuklodScopePhotoUpdated(scopeId);
     setNote('Community profile photo updated.');
     // Old object removal is safe after the DB row points to the new one.
     if(path&&path!==result.storagePath)void rollbackBuklodScopeHomeAsset(path).catch(()=>undefined);
   }catch(e:any){
     if(uploaded)await rollbackBuklodScopeHomeAsset(uploaded).catch(()=>undefined);
     const message=e?.message??'Profile photo could not be updated.';
     setNote(message);
     Alert.alert('Community profile photo',message);
   }finally{setBusy(false);}
 };
 const initial=(scopeName||'B').trim().charAt(0).toUpperCase();
 return <View style={styles.wrap}>
   <View style={styles.photoFrame}>
     {url?<Image source={{uri:url}} style={styles.photo} resizeMode="cover"/>:
       <View style={styles.fallback}>
         <Text style={styles.initial}>{initial}</Text>
       </View>}
   </View>
   <View style={{flex:1,minWidth:0,gap:3}}>
     <Text numberOfLines={1} style={styles.title}>{scopeName}</Text>
     <Text style={styles.subtitle}>Official Cluster / Organization profile</Text>
     {isAdmin&&(
       <Pressable accessibilityRole="button" accessibilityLabel="Upload or change community profile photo"
         disabled={busy} onPress={()=>void choose()} style={styles.action}>
         {busy?<ActivityIndicator size="small" color="#0A704E"/>:
           <MaterialCommunityIcons name="camera-plus-outline" size={17} color="#0A704E"/>}
         <Text style={styles.actionText}>{busy?'Uploading photo…':'Edit / Upload Profile Photo'}</Text>
       </Pressable>
     )}
     {!!note&&<Text accessibilityRole="alert" style={styles.note}>{note}</Text>}
   </View>
 </View>;
}
const styles=StyleSheet.create({
 wrap:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:13,paddingVertical:11,
   backgroundColor:'#F3FBF7',borderRadius:16,borderWidth:1,borderColor:'#B9E6D2'},
 photoFrame:{width:72,height:72,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'#70C6A6'},
 photo:{width:72,height:72},
 fallback:{width:72,height:72,backgroundColor:'#D8F5E7',alignItems:'center',justifyContent:'center'},
 initial:{fontSize:29,fontWeight:'900',color:'#0E6846'},
 title:{fontSize:14,fontWeight:'900',color:'#184734'},
 subtitle:{fontSize:10,color:'#637F70'},
 action:{flexDirection:'row',alignItems:'center',gap:6,minHeight:34,alignSelf:'flex-start',borderRadius:9,
   backgroundColor:'#D7F6E7',paddingHorizontal:10,paddingVertical:6},
 actionText:{fontSize:10,fontWeight:'900',color:'#0A704E'},
 note:{fontSize:10,color:'#395E4F'}
});
