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
  useRef,
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
import {recordConfirmedCommunityComment} from '@/lib/buklodCommunityCommentAdCadence';
import {warmBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';


import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
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

 const {id,focusCommentId,openComments}=useLocalSearchParams<{id:string;focusCommentId?:string;openComments?:string}>();
 const {user}=useAuth();
 const detailScrollRef=useRef<ScrollView|null>(null);
 const commentsStartYRef=useRef(0);
 const lastFocusedComment=useRef<string|null>(null);
 const lastAutoOpenedComments=useRef<string|null>(null);
 const composerInputRef=useRef<TextInput|null>(null);
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
  if(busy || !comment.trim())return;

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

  if(user?.id){
   const adCount=recordConfirmedCommunityComment(String(user.id));
   if(adCount.shouldWarm)warmBuklodAdOpportunity('community_comment_overage');
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
 <ScrollView ref={detailScrollRef} style={shared.screen} contentContainerStyle={s.content}>
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
  {!post.author_only ? (
   <BuklodFirstViewAd placement="community_entry" placementId="community_post_detail_native" />
  ) : null}
  {user?.id===post.user_id&&requests.length>0&&<><SectionTitle>SHARE REQUESTS</SectionTitle>{requests.map((r:any)=><Card key={r.request_id}><Text style={s.commentName}>{r.requester_name}</Text><Text style={s.commentMeta}>wants permission to share this post outside BUKLOD.</Text><View style={s.review}><View style={{flex:1}}><Button title="APPROVE" onPress={()=>review(r.request_id,true)}/></View><View style={{flex:1}}><Button title="DECLINE" outline onPress={()=>review(r.request_id,false)}/></View></View></Card>)}</>}

  {/* IGPAT / Community: lightweight social comments, not stacked form cards. */}
  <View
   style={s.commentsSection}
   onLayout={event=>{
    commentsStartYRef.current=event.nativeEvent.layout.y;
    if(openComments==='1' && lastAutoOpenedComments.current!==String(id)){
     lastAutoOpenedComments.current=String(id);
     requestAnimationFrame(()=>detailScrollRef.current?.scrollTo({
      y:Math.max(0,commentsStartYRef.current-12),
      animated:true,
     }));
    }
   }}
  >
   <View style={s.commentsHeading}>
    <Text style={s.commentsTitle}>Comments</Text>
    <Text style={s.commentsCount}>{comments.length}</Text>
   </View>
   {!comments.length ? (
    <View style={s.emptyComments}>
     <MaterialCommunityIcons name="comment-text-outline" size={25} color={colors.muted}/>
     <Text style={s.emptyTitle}>No comments yet</Text>
     <Text style={s.emptySubtitle}>Start the conversation.</Text>
    </View>
   ) : comments.map(c=>(
    <View
     key={c.id}
     onLayout={event=>{
      if(!focusCommentId||String(c.id)!==String(focusCommentId)||
       lastFocusedComment.current===String(focusCommentId))return;
      lastFocusedComment.current=String(focusCommentId);
      const y=Math.max(0,commentsStartYRef.current+event.nativeEvent.layout.y-90);
      requestAnimationFrame(()=>detailScrollRef.current?.scrollTo({y,animated:true}));
     }}
     style={[
      s.commentRow,
      c.parent_id? s.replyRow:undefined,
      focusCommentId===String(c.id)?s.focusedComment:undefined,
     ]}
    >
     <BuklodTappableAvatar userId={c.user_id} name={c.commenter_name} size={34}/>
     <View style={s.commentColumn}>
      <View style={s.commentBubble}>
       <Text style={s.commentName} numberOfLines={1}>
        {c.commenter_name}
        <Text style={s.commentCluster}> · {formatClusterName(c.cluster_name)}</Text>
       </Text>
       <BuklodMentionText
        text={String(c.body??'')}
        style={s.commentBody}
        mentionStyle={{fontWeight:'800',color:colors.greenDark}}
       />
      </View>
      <View style={s.commentActions}>
       <Text style={s.commentMeta}>{formatSpecificDateTime(c.created_at)}</Text>
       <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reply to ${c.commenter_name}`}
        onPress={()=>{
         setReplyTo(c);
         setComment(`@${c.commenter_name} `);
         requestAnimationFrame(()=>composerInputRef.current?.focus());
        }}
        hitSlop={8}
       >
        <Text style={s.commentActionText}>Reply</Text>
       </Pressable>
       {user?.id && user.id!==c.user_id ? (
        <Pressable
         accessibilityRole="button"
         accessibilityLabel="Report comment"
         onPress={()=>openReport('comment',String(c.id))}
         hitSlop={8}
        >
         <Text style={s.commentActionText}>Report</Text>
        </Pressable>
       ):null}
      </View>
     </View>
    </View>
   ))}
  </View>
 </ScrollView>

 <View style={s.composer}>
  {!!replyTo && (
   <View style={s.replyBanner}>
    <MaterialCommunityIcons name="reply" size={17} color={colors.greenDark}/>
    <Text style={s.replyBannerText} numberOfLines={1}>
     Replying to {replyTo.commenter_name}
    </Text>
    <Pressable
     accessibilityRole="button"
     accessibilityLabel="Cancel reply"
     hitSlop={10}
     onPress={()=>{setReplyTo(null);setComment('');}}
    >
     <MaterialCommunityIcons name="close" size={20} color={colors.greenDark}/>
    </Pressable>
   </View>
  )}
  <View style={s.composerRow}>
   <TextInput
    ref={composerInputRef}
    value={comment}
    onChangeText={setComment}
    editable={!busy}
    multiline
    placeholder={replyTo?'Write a reply...':'Write a comment...'}
    placeholderTextColor={colors.muted}
    accessibilityLabel="Write a comment"
    style={s.composerInput}
   />
   <Pressable
    accessibilityRole="button"
    accessibilityLabel={busy?'Posting comment':'Send comment'}
    accessibilityState={{disabled:busy||!comment.trim()}}
    disabled={busy||!comment.trim()}
    onPress={()=>void add()}
    style={[s.sendButton,(busy||!comment.trim())&&s.sendButtonDisabled]}
   >
    <MaterialCommunityIcons name="send" size={20} color={colors.white}/>
   </Pressable>
  </View>
 </View>
 <ConnectPhotoViewer
  visible={photoViewerOpen}
  uris={photoUris}
  initialIndex={photoViewerIndex}
  onClose={()=>setPhotoViewerOpen(false)}
 />
 {reportSheet}
 </>;
}

const s=StyleSheet.create({
 content:{paddingHorizontal:12,paddingTop:12,paddingBottom:24},
 eyebrow:{fontSize:10,fontWeight:'900',color:colors.greenDark,letterSpacing:.8,marginBottom:6},
 author:{fontSize:17,fontWeight:'900',color:colors.text},
 meta:{marginTop:3,fontSize:10,color:colors.muted},
 body:{marginTop:12,fontSize:15,lineHeight:22,color:colors.text},
 mentions:{marginTop:8,fontSize:12,fontWeight:'800',color:colors.greenDark},
 image:{width:'100%',height:280,borderRadius:13,marginTop:12},
 stats:{marginTop:10,marginBottom:4,flexDirection:'row',justifyContent:'space-between'},
 stat:{fontSize:10.5,color:colors.muted},
 review:{flexDirection:'row',gap:8,marginTop:8},
 commentsSection:{marginTop:16,paddingHorizontal:4,paddingBottom:24},
 commentsHeading:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:14},
 commentsTitle:{fontSize:18,fontWeight:'900',color:colors.text},
 commentsCount:{fontSize:12,fontWeight:'800',color:colors.greenDark,backgroundColor:colors.greenSoft,overflow:'hidden',borderRadius:999,paddingHorizontal:9,paddingVertical:3},
 emptyComments:{alignItems:'center',paddingVertical:25,gap:5},
 emptyTitle:{fontSize:14,fontWeight:'800',color:colors.text},
 emptySubtitle:{fontSize:12,color:colors.muted},
 commentRow:{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:13},
 replyRow:{marginLeft:20},
 focusedComment:{backgroundColor:colors.greenSoft,borderRadius:12,padding:5},
 commentColumn:{flex:1,minWidth:0},
 commentBubble:{alignSelf:'stretch',paddingVertical:9,paddingHorizontal:12,borderRadius:15,backgroundColor:'#F1F4F2'},
 commentName:{fontSize:13,fontWeight:'900',color:colors.text},
 commentCluster:{fontSize:11,fontWeight:'500',color:colors.muted},
 commentMeta:{fontSize:10,color:colors.muted},
 commentBody:{marginTop:5,fontSize:13.5,lineHeight:19,color:colors.text},
 commentActions:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:16,marginTop:6,paddingHorizontal:6},
 commentActionText:{fontSize:11,fontWeight:'800',color:colors.muted},
 composer:{backgroundColor:colors.white,borderTopWidth:1,borderTopColor:colors.line,paddingHorizontal:12,paddingTop:9,paddingBottom:10},
 composerRow:{flexDirection:'row',alignItems:'flex-end',gap:9},
 composerInput:{flex:1,minHeight:42,maxHeight:96,backgroundColor:'#F4F6F4',borderRadius:22,paddingHorizontal:15,paddingVertical:10,fontSize:14,color:colors.text,textAlignVertical:'center'},
 sendButton:{width:42,height:42,borderRadius:21,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},
 sendButtonDisabled:{opacity:.38},
 replyBanner:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:colors.greenSoft,borderRadius:10,paddingVertical:7,paddingHorizontal:10,marginBottom:8},
 replyBannerText:{flex:1,fontSize:12,fontWeight:'800',color:colors.greenDark},
});
