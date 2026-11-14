import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Image,Pressable,Text,View} from 'react-native';
import {router} from 'expo-router';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';
import {loadMemberCommunityPosts,type MemberPublicPost} from '@/lib/buklodMemberProfile';
import {repairMojibakeText} from '@/lib/repairMojibakeText';

export default function BuklodProfilePostCards({userId}:{userId:string}) {
 const {theme}=useBuklodTheme();
 const [posts,setPosts]=useState<MemberPublicPost[]>([]);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
   let mounted=true;setPosts([]);setLoading(true);
   void loadMemberCommunityPosts(userId,userId,3).then(rows=>{if(mounted)setPosts(rows);})
     .catch(()=>{if(mounted)setPosts([]);}).finally(()=>{if(mounted)setLoading(false);});
   return ()=>{mounted=false;};
 },[userId]);
 return <View style={{marginHorizontal:12,marginTop:12,gap:10}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
     <Text allowFontScaling style={{color:theme.textPrimary,fontWeight:'900',fontSize:16}}>MY POSTS & ACTIVITY</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Open all my posts"
       onPress={()=>router.push(('/member/'+encodeURIComponent(userId)) as any)}
       style={{minHeight:44,justifyContent:'center'}}>
       <Text allowFontScaling style={{color:theme.accent,fontWeight:'800'}}>See all →</Text>
     </Pressable>
   </View>
   {loading?<ActivityIndicator color={theme.accent}/>:posts.length===0?
     <Text allowFontScaling style={{color:theme.textMuted,fontSize:13}}>No recent posts to preview.</Text>:
     posts.map(post=><Pressable key={post.id} accessibilityRole="button" accessibilityLabel="Open exact post card"
       onPress={()=>router.push(('/post/'+encodeURIComponent(post.id)) as any)}
       style={{padding:12,borderRadius:15,borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSurface,gap:8}}>
       {!!post.body&&<Text allowFontScaling numberOfLines={5}
         style={{color:theme.textPrimary,fontSize:14,lineHeight:20}}>{repairMojibakeText(post.body)}</Text>}
       {post.media_url&&!post.is_video?<Image source={{uri:post.media_url}} resizeMode="cover"
         style={{width:'100%',height:150,borderRadius:10}}/>:null}
       {post.is_video?<Text allowFontScaling style={{color:theme.accent}}>Video post · Tap for playback</Text>:null}
       <Text allowFontScaling style={{color:theme.textMuted,fontSize:11}}>
         {post.created_at?new Date(post.created_at).toLocaleDateString('en-PH'):'Open post to view'}
       </Text>
     </Pressable>)}
   <Text allowFontScaling style={{color:theme.textMuted,fontSize:11}}>All visible activity honors the original post's access permissions.</Text>
 </View>;
}
