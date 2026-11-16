import React,{useCallback,useRef,useState} from 'react';
import {ActivityIndicator,Image,Pressable,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';
import {loadMemberCommunityPosts,type MemberPublicPost} from '@/lib/buklodMemberProfile';
import {repairMojibakeText} from '@/lib/repairMojibakeText';
import {buklodVisual} from '@/lib/buklodVisual';

export default function BuklodProfilePostCards({userId}:{userId:string}) {
 const {theme}=useBuklodTheme();
 const [posts,setPosts]=useState<MemberPublicPost[]>([]);
 const [loading,setLoading]=useState(true);
 const ownerRef=useRef('');
 const lastSyncRef=useRef(0);

 // Focus is not a reason to erase an already painted post preview.
 // Keep previous content during a silent refresh; a different account
 // must never see a cached preview belonging to the prior account.
 useFocusEffect(useCallback(()=>{
   let active=true;
   if(ownerRef.current!==userId){
     ownerRef.current=userId;
     lastSyncRef.current=0;
     setPosts([]);
     setLoading(true);
   }
   if(lastSyncRef.current>0 && Date.now()-lastSyncRef.current<12_000){
     return ()=>{active=false;};
   }
   void loadMemberCommunityPosts(userId,userId,3)
     .then(rows=>{
       if(active && ownerRef.current===userId){
         setPosts(rows);
         lastSyncRef.current=Date.now();
       }
     })
     .catch(()=>{
       // On a temporary failure retain the last authorized preview.
     })
     .finally(()=>{if(active && ownerRef.current===userId)setLoading(false);});
   return ()=>{active=false;};
 },[userId]));
 const visiblePosts=ownerRef.current===userId?posts:[];
 const initialLoading=ownerRef.current!==userId || (loading && lastSyncRef.current===0);
 return <View style={{marginHorizontal:buklodVisual.space.screen,marginTop:buklodVisual.space.tight,gap:6}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
     <Text allowFontScaling style={{color:theme.textPrimary,fontWeight:'900',fontSize:16}}>MY RECENT POSTS</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Open all my posts"
       onPress={()=>router.push(('/member/'+encodeURIComponent(userId)) as any)}
       style={{minHeight:44,justifyContent:'center'}}>
       <Text allowFontScaling style={{color:theme.accent,fontWeight:'800'}}>See all →</Text>
     </Pressable>
   </View>
   {initialLoading?<ActivityIndicator color={theme.accent}/>:visiblePosts.length===0?
     <Text allowFontScaling style={{color:theme.textMuted,fontSize:13}}>No recent posts to preview.</Text>:
     visiblePosts.map(post=><Pressable key={post.id} accessibilityRole="button" accessibilityLabel="Open exact post card"
       onPress={()=>router.push(('/post/'+encodeURIComponent(post.id)) as any)}
       style={{padding:10,borderRadius:13,borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSurface,gap:6}}>
       {!!post.body&&<Text allowFontScaling numberOfLines={5}
         style={{color:theme.textPrimary,fontSize:14,lineHeight:20}}>{repairMojibakeText(post.body)}</Text>}
       {post.media_url&&!post.is_video?<Image source={{uri:post.media_url}} resizeMode="cover"
         style={{width:'100%',height:120,borderRadius:10}}/>:null}
       {post.is_video?<Text allowFontScaling style={{color:theme.accent}}>Video post · Tap for playback</Text>:null}
       <Text allowFontScaling style={{color:theme.textMuted,fontSize:11}}>
         {post.created_at?new Date(post.created_at).toLocaleDateString('en-PH'):'Open post to view'}
       </Text>
     </Pressable>)}
   <Text allowFontScaling style={{color:theme.textMuted,fontSize:11}}>All visible activity honors the original post's access permissions.</Text>
 </View>;
}
