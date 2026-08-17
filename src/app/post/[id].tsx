import { Image as ExpoImage } from 'expo-image';
/* PATCH_161A_COMMENT_REPLIES */
/* PATCH_160_POST_AVATARS_TIME */
import { formatSpecificDateTime } from '@/lib/dateTime';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { CommunityVideo } from '@/components/CommunityVideo';
import {
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import {Alert,Image,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {supabase} from '@/lib/supabase';
import {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS
import {Button,Card,SectionTitle,shared} from '@/components/UI';
import {colors} from '@/lib/theme';
import {useAuth} from '@/providers/AuthProvider';


import BuklodPostInternalShare
  from '@/components/BuklodPostInternalShare';
type Reaction='amen'|'with_you'|'praying'|'love'|'haha'|'sad';
const RX:{key:Reaction;label:string;icon:any}[]=[
{key:'amen',label:'Amen',icon:'hands-pray'},{key:'with_you',label:'With You',icon:'account-heart-outline'},
{key:'praying',label:'Praying',icon:'hand-heart-outline'},{key:'love',label:'Love',icon:'heart-outline'},
{key:'haha',label:'Haha',icon:'emoticon-happy-outline'},{key:'sad',label:'Sad',icon:'emoticon-sad-outline'}];

export default function PostDetail(){
 /* PATCH_154N_POST_MEDIA_CACHE */
 const postMediaUrlCacheRef=
  useRef<{
    path:string;
    url:string;
    at:number;
  }|null>(null);

 const [
  myReaction,
  setMyReaction
 ]=
  useState<Reaction|null>(
    null
  );

 const {id}=useLocalSearchParams<{id:string}>(); const {user}=useAuth();
 const [post,setPost]=useState<any>(null),[comments,setComments]=useState<any[]>([]),[requests,setRequests]=useState<any[]>([]);
 const [comment,setComment]=useState(''),[busy,setBusy]=useState(false);
 const [replyTo,setReplyTo]=useState<any>(null);

 const load=useCallback(async()=>{if(!id)return;
  const [{data:p,error:pe},{data:c,error:ce}]=await Promise.all([
   (supabase as any).rpc('get_buklod_post_detail_v3',{p_post_id:id}),
   (supabase as any).rpc('get_buklod_post_comments_v4',{p_post_id:id})]);
  if(pe)return Alert.alert('Post',pe.message);if(ce)Alert.alert('Comments',ce.message);
  const row=Array.isArray(p)?p[0]:p;if(!row){setPost(null);setComments([]);return}
  /* PATCH_154N_POST_STABLE_URL */
  let url:string|null=null;

  if(row.media_path){
    const cached=
      postMediaUrlCacheRef
        .current;

    if(
      cached &&
      cached.path===
        row.media_path &&
      Date.now()-cached.at <
        50*60*1000
    ){
      url=
        cached.url;
    }else{
      const {data:s}=
        await supabase
          .storage
          .from(
            'community-media'
          )
          .createSignedUrl(
            row.media_path,
            3600
          );

      url=
        s?.signedUrl??null;

      if(url){
        postMediaUrlCacheRef
          .current={
            path:
              row.media_path,
            url,
            at:Date.now()
          };
      }
    }
  }
  
  /* PATCH_154N_LOAD_MY_POST_REACTION */
  if(user?.id){
    const {
      data:mine
    }=
      await supabase
        .from('reactions')
        .select('reaction')
        .eq(
          'post_id',
          id
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();

    setMyReaction(
      (
        mine?.reaction??
        null
      ) as Reaction|null
    );
  }

  // POST_AUTHOR_CIRCLE_RANK
  const {data:rankRows}=await (supabase as any).rpc(
   'get_member_circle_ranks_v1',
   {p_user_ids:[row.user_id]}
  );

  const authorRank=
   Array.isArray(rankRows)&&rankRows.length
    ? rankRows[0]?.rank_name
    : null;

  // PATCH_154A_POST_CLUSTER_MAP
  const commentRows=(c??[]) as any[];
  const clusterMap=await getClusterLabels([
   row.user_id,
   ...commentRows.map((x:any)=>x.user_id)
  ]);
  setPost({
   ...row,
   media_url:url,
   cluster_name:
    clusterMap[row.user_id]??null,
   author_rank_name:
    authorRank??'Circle Starter V'
  });
  setComments(commentRows.map((x:any)=>({...x,cluster_name:clusterMap[x.user_id]??null})));
  if(user?.id===row.user_id){const {data:r}=await (supabase as any).rpc('get_post_share_requests_for_author_v2',{p_post_id:id});setRequests(r??[])}else setRequests([]);
 },[id,user?.id]);

 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!id)return;const ch=supabase.channel(`post:${id}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'comments',filter:`post_id=eq.${id}`},()=>load())
  .on('postgres_changes',{event:'*',schema:'public',table:'reactions',filter:`post_id=eq.${id}`},()=>load())
  .on('postgres_changes',{event:'*',schema:'public',table:'post_share_requests',filter:`post_id=eq.${id}`},()=>load()).subscribe();
  return()=>{supabase.removeChannel(ch)}},[id,load]);

 const add=async()=>{
  if(!comment.trim())return;

  setBusy(true);

  const {error}=
   await (supabase as any)
    .rpc(
     'add_buklod_post_comment_v4',
     {
      p_post_id:id,
      p_body:comment.trim(),
      p_parent_id:
       replyTo?.id ?? null
     }
    );

  setBusy(false);

  if(error){
   return Alert.alert(
    'Comment',
    error.message
   );
  }

  setComment('');
  setReplyTo(null);
  await load();
 };
 const react=async(
  r:Reaction
)=>{
  if(!post)return;

  /* PATCH_154N_OPTIMISTIC_POST_REACTION */

  const previous=
    myReaction;

  const nextReaction=
    previous===r
      ? null
      : r;

  const mutate=(
    base:any,
    from:Reaction|null,
    to:Reaction|null
  )=>{
    const counts={
      ...(
        base.reaction_counts||
        {}
      )
    };

    let total=
      Number(
        base.total_reactions??
        Object.values(
          counts
        ).reduce(
          (
            sum:number,
            value:any
          )=>
            sum+
            Number(
              value??0
            ),
          0
        )
      );

    if(from){
      counts[from]=
        Math.max(
          0,
          Number(
            counts[from]??0
          )-1
        );

      total=
        Math.max(
          0,
          total-1
        );
    }

    if(to){
      counts[to]=
        Number(
          counts[to]??0
        )+1;

      total+=1;
    }

    return{
      ...base,
      reaction_counts:
        counts,
      total_reactions:
        total
    };
  };

  setMyReaction(
    nextReaction
  );

  setPost(
    (current:any)=>
      current
        ? mutate(
            current,
            previous,
            nextReaction
          )
        : current
  );

  const {error}=
    await(
      supabase as any
    ).rpc(
      'set_buklod_post_reaction_v3',
      {
        p_post_id:id,
        p_reaction:r
      }
    );

  if(error){
    setMyReaction(
      previous
    );

    setPost(
      (current:any)=>
        current
          ? mutate(
              current,
              nextReaction,
              previous
            )
          : current
    );

    Alert.alert(
      'Reaction',
      error.message
    );
  }
};


 const share=async()=>{if(!post)return;const {data,error}=await (supabase as any).rpc('request_external_post_share_v2',{p_post_id:post.id});if(error)return Alert.alert('Share',error.message);
  const r=Array.isArray(data)?data[0]:data;if(r?.share_allowed)return Share.share({message:`${post.author_name}\n\n${post.body}\n\nShared from BUKLOD Community`});
  Alert.alert('Approval Requested','The poster was notified. After approval, open this post and tap Share Outside again.')};
 const review=async(requestId:string,approve:boolean)=>{const {error}=await (supabase as any).rpc('review_external_post_share_v2',{p_request_id:requestId,p_approve:approve});if(error)return Alert.alert('Share Approval',error.message);await load()};

 if(!post)return <View style={[shared.screen,shared.content]}><Text style={shared.h1}>BUKLOD Post</Text><Card><Text style={shared.muted}>Post unavailable or outside your allowed audience.</Text></Card><Button title="BACK" onPress={()=>router.back()}/></View>;
 const counts=post.reaction_counts||{},mentions=Array.isArray(post.mentions)?post.mentions:[];

 return <ScrollView style={shared.screen} contentContainerStyle={s.content}>
  <Text style={s.eyebrow}>BUKLOD POST</Text><Card><View
   style={{
     flexDirection:
       'row',
     alignItems:
       'center',
     gap: 9,
   }}
  >
   <ProfileAvatar
     userId={
       post.user_id
     }
     name={
       post.author_name
     }
     size={42}
   />

   <Text
     style={[
       s.author,
       {
         flex: 1,
       },
     ]}
   >
     {post.author_name}
     {' | '}
     {
       formatClusterName(
         post.cluster_name
       )
     }
   </Text>
  </View>

  {!!post.author_rank_name&&
   <Text style={s.meta}>
    {post.author_rank_name}
   </Text>
  }<Text style={s.meta}>{String(post.audience).toUpperCase()} | {formatSpecificDateTime(post.created_at)}</Text>
   <Text style={s.body}>{post.body}</Text>{!!mentions.length&&<Text style={s.mentions}>{mentions.map((x:any)=>`@${x.full_name}`).join(' ')}</Text>}{/* PATCH_155C_POST_VIDEO */}
  {!!post.media_url &&
   !String(post.media_mime_type||'').startsWith('video/') &&
   <ExpoImage
   source={{
    uri:post.media_url
   }}
   style={s.image}
   contentFit="cover"
   cachePolicy="memory-disk"
   transition={80}
  />}

  {!!post.media_url &&
   String(post.media_mime_type||'').startsWith('video/') &&
   <CommunityVideo uri={post.media_url} height={420}/>}
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rx}>{RX.map(r=><Pressable key={r.key} onPress={()=>react(r.key)} style={[
  s.rxBtn,
  myReaction===r.key&&{
    backgroundColor:
      colors.greenSoft,
    borderWidth:1,
    borderColor:
      colors.green
  }
]}><MaterialCommunityIcons name={r.icon} size={18} color={colors.greenDark}/><Text style={s.rxText}>{r.label} {Number(counts[r.key]??0)}</Text></Pressable>)}</ScrollView>
   <View style={s.stats}><Text style={s.stat}>{Number(post.total_reactions??0)} reactions</Text><Text style={s.stat}>{Number(post.comment_count??comments.length)} comments</Text></View>
   <BuklodPostInternalShare
    postId={String(post.id)}
   />
   <Button title={user?.id===post.user_id?'SHARE OUTSIDE BUKLOD':'REQUEST / SHARE OUTSIDE'} outline onPress={share}/>
  </Card>
  {user?.id===post.user_id&&requests.length>0&&<><SectionTitle>SHARE REQUESTS</SectionTitle>{requests.map((r:any)=><Card key={r.request_id}><Text style={s.commentName}>{r.requester_name}</Text><Text style={s.commentMeta}>wants permission to share this post outside BUKLOD.</Text><View style={s.review}><View style={{flex:1}}><Button title="APPROVE" onPress={()=>review(r.request_id,true)}/></View><View style={{flex:1}}><Button title="DECLINE" outline onPress={()=>review(r.request_id,false)}/></View></View></Card>)}</>}
  <SectionTitle>
   COMMENTS ({comments.length})
  </SectionTitle>

  {comments.map(c => (
   <View
    key={c.id}
    style={
     c.parent_id
      ? {
         marginLeft:24
        }
      : undefined
    }
   >
    <Card>
     {!!c.parent_id && (
      <Text
       style={{
        marginBottom:5,
        fontSize:9,
        fontWeight:'800',
        color:colors.greenDark
       }}
      >
       Reply to @
       {c.parent_commenter_name ||
        'BUKLOD Member'}
      </Text>
     )}

     <Text style={s.commentName}>
      {c.commenter_name}
      {' | '}
      {formatClusterName(
       c.cluster_name
      )}
     </Text>

     <Text style={s.commentMeta}>
      {formatSpecificDateTime(
       c.created_at
      )}
     </Text>

     <Text style={s.commentBody}>
      {c.body}
     </Text>

     <Pressable
      onPress={() => {
       setReplyTo(c);

       setComment(
        `@${c.commenter_name} `
       );
      }}
      style={{
       alignSelf:'flex-start',
       marginTop:8,
       paddingVertical:4,
       paddingHorizontal:6
      }}
     >
      <Text
       style={{
        fontSize:10,
        fontWeight:'900',
        color:colors.greenDark
       }}
      >
       REPLY
      </Text>
     </Pressable>
    </Card>
   </View>
  ))}
  {!comments.length&&<Card><Text style={shared.muted}>No comments yet.</Text></Card>}
  <Card>
   <Text style={s.commentName}>
    {
     replyTo
      ? 'Reply to Comment'
      : 'Add Comment'
    }
   </Text>

   {!!replyTo && (
    <View
     style={{
      marginTop:8,
      padding:9,
      borderRadius:10,
      backgroundColor:colors.greenSoft,
      flexDirection:'row',
      alignItems:'center'
     }}
    >
     <Text
      numberOfLines={1}
      style={{
       flex:1,
       fontSize:10,
       fontWeight:'800',
       color:colors.greenDark
      }}
     >
      Replying to @
      {replyTo.commenter_name}
     </Text>

     <Pressable
      onPress={() => {
       setReplyTo(null);
       setComment('');
      }}
     >
      <MaterialCommunityIcons
       name="close"
       size={20}
       color={colors.greenDark}
      />
     </Pressable>
    </View>
   )}

   <TextInput
    value={comment}
    onChangeText={setComment}
    multiline
    placeholder={
     replyTo
      ? `Reply to @${replyTo.commenter_name}...`
      : 'Write a comment...'
    }
    style={s.input}
   />

   <Button
    title={
     busy
      ? 'POSTING...'
      : replyTo
       ? 'POST REPLY'
       : 'POST COMMENT'
    }
    onPress={add}
   />
  </Card>
 </ScrollView>;
}
const s=StyleSheet.create({content:{padding:16,paddingBottom:50},eyebrow:{fontSize:10,fontWeight:'900',color:colors.greenDark,letterSpacing:.8,marginBottom:6},author:{fontSize:17,fontWeight:'900',color:colors.text},meta:{marginTop:3,fontSize:10,color:colors.muted},body:{marginTop:12,fontSize:15,lineHeight:22,color:colors.text},mentions:{marginTop:8,fontSize:12,fontWeight:'800',color:colors.greenDark},image:{width:'100%',height:280,borderRadius:13,marginTop:12},rx:{gap:7,marginTop:12},rxBtn:{minHeight:39,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,borderRadius:20,backgroundColor:'#F3F5F3'},rxText:{fontSize:10.5,fontWeight:'900',color:colors.text},stats:{marginTop:10,marginBottom:4,flexDirection:'row',justifyContent:'space-between'},stat:{fontSize:10.5,color:colors.muted},review:{flexDirection:'row',gap:8,marginTop:8},commentName:{fontSize:13,fontWeight:'900',color:colors.text},commentMeta:{marginTop:3,fontSize:10,color:colors.muted},commentBody:{marginTop:8,fontSize:13,lineHeight:19,color:colors.text},input:{minHeight:78,marginTop:9,marginBottom:8,padding:11,borderWidth:1,borderColor:colors.line,borderRadius:12,textAlignVertical:'top',backgroundColor:colors.white}});
