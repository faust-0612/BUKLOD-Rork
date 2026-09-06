/* PATCH_161A_COMMENT_REPLIES */
/* PATCH_160_POST_AVATARS_TIME */
import { formatSpecificDateTime } from '@/lib/dateTime';
import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
import {
  BuklodReactionAction,
  BUKLOD_PUBLIC_COMMUNITY_REACTIONS,
} from '@/components/BuklodReactionAction';
import { CommunityVideo } from '@/components/CommunityVideo';
import {
  BuklodCommunityPhotoCollage,
  communityPhotoCollageItems,
} from '@/components/BuklodCommunityPhotoCollage';
import { resolveCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {Alert,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {supabase} from '@/lib/supabase';
import { acquireSharedRealtimeSubscription } from '@/lib/performance';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS
import {Button,Card,SectionTitle,shared} from '@/components/UI';
import {colors} from '@/lib/theme';
import {useAuth} from '@/providers/AuthProvider';


import BuklodPostInternalShare
  from '@/components/BuklodPostInternalShare';
import {
  ConnectPhotoViewer,
} from '@/components/connect/ConnectPhotoViewer';
import {
  BuklodContentOverflowMenu,
} from '@/components/BuklodContentOverflowMenu';
import {
  useBuklodContentReport,
} from '@/components/BuklodContentReportSheet';
import BuklodMentionText from '@/components/BuklodMentionText';
import {
  deleteCommunityPost,
  setCommunityPostAuthorOnly,
  saveCommunityPostEdit,
  communityPostEditPhotos,
  communityPostIsVideo,
} from '@/lib/buklodCommunityPostOwnerActions';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import {
  type BuklodCommunityReactionKey,
} from '@/lib/buklodCommunityReactions';
type Reaction = BuklodCommunityReactionKey;

export default function PostDetail(){
 const [
  myReaction,
  setMyReaction
 ]=
  useState<Reaction|null>(
    null
  );

 const {id}=useLocalSearchParams<{id:string}>(); const {user}=useAuth();
 const {
  openReport,
  reportSheet,
 } = useBuklodContentReport();
 const [post,setPost]=useState<any>(null),[comments,setComments]=useState<any[]>([]),[requests,setRequests]=useState<any[]>([]);
 const [comment,setComment]=useState(''),[busy,setBusy]=useState(false);
 const [replyTo,setReplyTo]=useState<any>(null);
 const [photoViewerOpen,setPhotoViewerOpen]=useState(false);
 const [photoViewerIndex,setPhotoViewerIndex]=useState(0);

 const load=useCallback(async()=>{if(!id)return;
  const [{data:p,error:pe},{data:c,error:ce}]=await Promise.all([
   (supabase as any).rpc('get_buklod_post_detail_v3',{p_post_id:id}),
   (supabase as any).rpc('get_buklod_post_comments_v4',{p_post_id:id})]);
  if(pe)return Alert.alert('Post',pe.message);if(ce)Alert.alert('Comments',ce.message);
  const row=Array.isArray(p)?p[0]:p;if(!row){setPost(null);setComments([]);return}
  /* PATCH_154N_POST_STABLE_URL */
  let url:string|null=
    await resolveCommunityMediaUrl(
      row.media_path,
      row.media_url
    );
  
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

  const {data:mediaRows}=
   await (supabase as any).rpc(
    'get_buklod_post_media_v1',
    {p_post_ids:[id]}
   );

  const mediaItems=
   await Promise.all(
    (Array.isArray(mediaRows)?mediaRows:[])
     .map(async (row:any)=>{
      const path=String(row?.media_path??'').trim();
      return {
       ...row,
       media_url: path
        ? await resolveCommunityMediaUrl(
            path,
            row?.media_url
          )
        : null,
      };
     })
   );

  // PATCH_154A_POST_CLUSTER_MAP
  const commentRows=(c??[]) as any[];
  const clusterMap=await getClusterLabels([
   row.user_id,
   ...commentRows.map((x:any)=>x.user_id)
  ]);
  setPost({
   ...row,
   media_url:
    url||
    mediaItems.find((item:any)=>item?.media_url)
     ?.media_url||
    null,
   media_items:mediaItems,
   cluster_name:
    clusterMap[row.user_id]??null,
   author_rank_name:
    authorRank??'Circle Starter V'
  });
  setComments(commentRows.map((x:any)=>({...x,cluster_name:clusterMap[x.user_id]??null})));
  if(user?.id===row.user_id){const {data:r}=await (supabase as any).rpc('get_post_share_requests_for_author_v2',{p_post_id:id});setRequests(r??[])}else setRequests([]);
 },[id,user?.id]);

 useEffect(()=>{void load()},[load]);
 useEffect(()=>{
  if(!id)return;

  return acquireSharedRealtimeSubscription(
   `post-detail:${id}`,
   ()=>{void load()},
   emit=>{
    const ch=supabase.channel(`post:${id}`)
     .on('postgres_changes',{event:'*',schema:'public',table:'comments',filter:`post_id=eq.${id}`},()=>emit(undefined))
     .on('postgres_changes',{event:'*',schema:'public',table:'reactions',filter:`post_id=eq.${id}`},()=>emit(undefined))
     .on('postgres_changes',{event:'*',schema:'public',table:'post_share_requests',filter:`post_id=eq.${id}`},()=>emit(undefined))
     .subscribe();

    return()=>{void supabase.removeChannel(ch)};
   }
  );
 },[id,load]);

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

 const photoUris=useMemo(()=>{
  if(!post||String(post.media_mime_type||'').startsWith('video/')){
   return [] as string[];
  }

  const fromItems=Array.isArray(post.media_items)
   ? post.media_items
      .map((item:any)=>String(item?.media_url??'').trim())
      .filter(Boolean)
   : [];

  if(fromItems.length){
   return fromItems;
  }

  const url=String(post.media_url??'').trim();
  return url?[url]:[];
 },[post]);

 if(!post)return <View style={[shared.screen,shared.content]}><Text style={shared.h1}>BUKLOD Post</Text><Card><Text style={shared.muted}>Post unavailable or outside your allowed audience.</Text></Card><Button title="BACK" onPress={()=>router.back()}/></View>;
 const counts=post.reaction_counts||{},mentions=Array.isArray(post.mentions)?post.mentions:[];

 return <>
 <ScrollView style={shared.screen} contentContainerStyle={s.content}>
  <Text style={s.eyebrow}>BUKLOD POST</Text><Card><View
   style={{
     flexDirection:
       'row',
     alignItems:
       'center',
     gap: 9,
   }}
  >
   <BuklodTappableAvatar
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
   {user?.id===post.user_id ? (
     <BuklodContentOverflowMenu
      title="Your post"
      body={String(post.body ?? '')}
      authorOnly={!!post.author_only}
      iconColor={colors.muted}
      allowPhotoEdit={!communityPostIsVideo(post)}
      maxPhotos={COMMUNITY_MAX_PHOTOS}
      photos={communityPostEditPhotos(post)}
      onEdit={async (nextBody, nextPhotos) => {
       const saved = await saveCommunityPostEdit({
        postId: post.id,
        userId: String(user?.id ?? ''),
        body: nextBody,
        photos: nextPhotos ?? [],
       });
       setPost((current: any) =>
        current
         ? { ...current, ...saved }
         : current
       );
      }}
      onToggleAuthorOnly={
       async () => {
        await setCommunityPostAuthorOnly(
         post.id,
         !post.author_only
        );
        setPost((current: any) =>
         current
          ? {
             ...current,
             author_only: !post.author_only,
            }
          : current
        );
       }
      }
      onDelete={async () => {
       await deleteCommunityPost(post.id);
       router.back();
      }}
     />
   ) : (
     <BuklodContentOverflowMenu
      title="Post"
      iconColor={colors.muted}
      onReport={() =>
       openReport('post', String(post.id))
      }
     />
   )}
  </View>

  {!!post.author_rank_name&&
   <Text style={s.meta}>
    {post.author_rank_name}
   </Text>
  }<Text style={s.meta}>{String(post.audience).toUpperCase()} | {formatSpecificDateTime(post.created_at)}</Text>
   <Text style={s.body}>{post.body}</Text>{!!mentions.length&&<Text style={s.mentions}>{mentions.map((x:any)=>`@${x.full_name}`).join(' ')}</Text>}{/* PATCH_155C_POST_VIDEO */}
  {!!(post.media_url || post.media_path || (Array.isArray(post.media_items) && post.media_items.length)) &&
   !String(post.media_mime_type||'').startsWith('video/') &&
   <BuklodCommunityPhotoCollage
    items={communityPhotoCollageItems(
     post.media_items,
     {
      media_path: post.media_path,
      media_url: post.media_url,
      media_mime_type: post.media_mime_type,
     }
    )}
    width={undefined}
    height={280}
    onPressPhoto={(index)=>{
     setPhotoViewerIndex(index);
     setPhotoViewerOpen(true);
    }}
   />}

  {!!post.media_url &&
   String(post.media_mime_type||'').startsWith('video/') &&
   <CommunityVideo uri={post.media_url} height={420}/>}
   <BuklodReactionAction
    options={BUKLOD_PUBLIC_COMMUNITY_REACTIONS}
    counts={counts}
    mine={myReaction}
    onSelect={key=>
     void react(key as Reaction)
    }
   />
   <View style={s.stats}><Text style={s.stat}>{Number(post.total_reactions??0)} reactions</Text><Text style={s.stat}>{Number(post.comment_count??comments.length)} comments</Text></View>
   <BuklodPostInternalShare
    postId={String(post.id)}
   />
   {user?.id && user.id !== post.user_id ? (
    <Button
     title="REPORT"
     outline
     onPress={() =>
      openReport('post', String(post.id))
     }
    />
   ) : null}
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

     <BuklodMentionText
      text={String(c.body ?? '')}
      style={s.commentBody}
      mentionStyle={{
       fontWeight: '800',
       color: colors.greenDark,
      }}
     />

     <View
      style={{
       marginTop: 8,
       flexDirection: 'row',
       alignItems: 'center',
       justifyContent: 'flex-end',
       gap: 12,
      }}
     >
      {user?.id && user.id !== c.user_id ? (
       <Pressable
        onPress={() =>
         openReport('comment', String(c.id))
        }
       >
        <Text
         style={{
          fontSize: 10,
          fontWeight: '900',
          color: colors.muted,
         }}
        >
         Report
        </Text>
       </Pressable>
      ) : null}
      <Pressable
       onPress={() => {
        setReplyTo(c);

        setComment(
         `@${c.commenter_name} `
        );
       }}
      >
       <Text
        style={{
         fontSize: 10,
         fontWeight: '900',
         color: colors.greenDark,
        }}
       >
        Reply
       </Text>
      </Pressable>
     </View>
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
     <BuklodMentionText
      text={`@${replyTo.commenter_name}`}
      numberOfLines={1}
      style={{
       flex:1,
       fontSize:10,
       fontWeight:'800',
       color:colors.greenDark
      }}
      mentionStyle={{
       fontWeight:'800',
       color:colors.greenDark
      }}
     />

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
 </ScrollView>
 <ConnectPhotoViewer
  visible={photoViewerOpen}
  uris={photoUris}
  initialIndex={photoViewerIndex}
  onClose={()=>setPhotoViewerOpen(false)}
 />
 {reportSheet}
 </>;
}
const s=StyleSheet.create({content:{padding:16,paddingBottom:50},eyebrow:{fontSize:10,fontWeight:'900',color:colors.greenDark,letterSpacing:.8,marginBottom:6},author:{fontSize:17,fontWeight:'900',color:colors.text},meta:{marginTop:3,fontSize:10,color:colors.muted},body:{marginTop:12,fontSize:15,lineHeight:22,color:colors.text},mentions:{marginTop:8,fontSize:12,fontWeight:'800',color:colors.greenDark},image:{width:'100%',height:280,borderRadius:13,marginTop:12},stats:{marginTop:10,marginBottom:4,flexDirection:'row',justifyContent:'space-between'},stat:{fontSize:10.5,color:colors.muted},review:{flexDirection:'row',gap:8,marginTop:8},commentName:{fontSize:13,fontWeight:'900',color:colors.text},commentMeta:{marginTop:3,fontSize:10,color:colors.muted},commentBody:{marginTop:8,fontSize:13,lineHeight:19,color:colors.text},input:{minHeight:78,marginTop:9,marginBottom:8,padding:11,borderWidth:1,borderColor:colors.line,borderRadius:12,textAlignVertical:'top',backgroundColor:colors.white}});
