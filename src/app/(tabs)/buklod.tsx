import { uploadCommunityVideoFile } from '@/lib/uploadCommunityVideoFile';
import { CommunityVideo } from '@/components/CommunityVideo';
/* PATCH_186M_RESTORE_COMMUNITY_POST_PHOTOS */
import {
  useEffect as useCommunityMediaEffect186M,
  useState as useCommunityMediaState186M,
} from 'react';
import {
  Image as CommunityMediaImage186M,
} from 'react-native';

import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';
/* PATCH_186H_SINGLE_COMMUNITY_AUTHOR_AVATAR */
/* PATCH_179D_FIX_COMMUNITY_IMAGE_STABLE_CACHE */
import BuklodPublicLocationChips from '@/components/BuklodPublicLocationChips';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import BuklodCommunitySponsoredAd from '@/components/BuklodCommunitySponsoredAd';
import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import {
 Image as ExpoImage } from 'expo-image';
/* PATCH_160_COMMUNITY_AVATARS_TIME */
import { formatSpecificDateTime } from '@/lib/dateTime';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import {
  useCallback,
 useEffect,
 useState,
 useRef,
 } from 'react';
import {ActivityIndicator,
 Alert,
 FlatList,
 Image,
 Modal,
 Pressable,
 ScrollView,
 Share,
 StyleSheet,
 Text,
 TextInput,
 View,
 Dimensions,
 KeyboardAvoidingView,
 Platform} from 'react-native';
import {Redirect,router} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {decode} from 'base64-arraybuffer';

import {
  useSafeAreaInsets
} from 'react-native-safe-area-context';

import {
 Gesture,
 GestureDetector,
 GestureHandlerRootView
} from 'react-native-gesture-handler';

import Animated,{
 useAnimatedStyle,
 useSharedValue,
 withTiming
} from 'react-native-reanimated';
import {supabase} from '@/lib/supabase';
import {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS
import {Button,Card,SectionTitle,shared} from '@/components/UI';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {colors} from '@/lib/theme';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {FeatureUnavailable} from '@/components/FeatureUnavailable';




import BuklodPostInternalShare
  from '@/components/BuklodPostInternalShare';
import { BuklodPhotoEditor } from '@/components/BuklodPhotoEditor';
/* PATCH_186B_PHOTO_EDITOR_IMPORT */
/* PATCH_166H_REALTIME_DEBOUNCE_IS_EFFECT_LOCAL */
const CATEGORIES=['reflection','testimony','encouragement'] as const;
type Audience='group'|'local'|'public'; type FeedMode='for_you'|'latest';
type Reaction='amen'|'with_you'|'praying'|'love'|'haha'|'sad';
type Photo={uri:string;base64:string;sizeBytes:number};
type Mention={user_id:string;full_name:string;church_name:string;group_name:string};
const RX:{key:Reaction;label:string;icon:any}[]=[
{key:'amen',label:'Amen',icon:'hands-pray'},{key:'with_you',label:'With You',icon:'account-heart-outline'},
{key:'praying',label:'Praying',icon:'hand-heart-outline'},{key:'love',label:'Love',icon:'heart-outline'},
{key:'haha',label:'Haha',icon:'emoticon-happy-outline'},{key:'sad',label:'Sad',icon:'emoticon-sad-outline'}];
const HELP:Record<Audience,string>={
group:'Only active members of your BUKLOD Cluster can see this post.',
local:'Only verified members of your Local Church can see this post.',
public:'All verified BUKLOD app members can see this post.'};

let PERF2_MENTION_SEARCH_SEQ = 0;

/* PERF2_MENTION_SEARCH_DEBOUNCE */

// PATCH_161H_C_PHOTO_VIEWER_PLUS

function CommunityZoomPhoto({
 uri
}:{
 uri:string
}){
 const scale=
  useSharedValue(1);

 const startScale=
  useSharedValue(1);


 const pinch=
  Gesture.Pinch()

   .onStart(()=>{
    startScale.value=
     scale.value;
   })

   .onUpdate(event=>{
    scale.value=
     Math.max(
      1,
      Math.min(5,
       startScale.value*
       event.scale
      )
     );
   })

   .onEnd(()=>{
    if(scale.value<1.05){
     scale.value=
      withTiming(1);
    }
   });


 const doubleTap=
  Gesture.Tap()

   .numberOfTaps(2)

   .maxDuration(280)

   .onEnd(
    (_event,success)=>{
     if(!success){
      return;
     }

     scale.value=
      withTiming(
       scale.value>1.1
        ? 1
        : 3
      );
    }
   );


 const gesture=
  Gesture.Simultaneous(
   pinch,
   doubleTap
  );


 const animatedStyle=
  useAnimatedStyle(
   ()=>({
    transform:[
     {
      scale:
       scale.value
     }
    ]
   })
  );


 return (
  <GestureDetector
   gesture={gesture}
  >
   <Animated.View
    collapsable={false}
    style={{
     width:'100%',
     height:'100%',
     alignItems:'center',
     justifyContent:'center'
    }}
   >
    {/* PATCH_161H_D1_ZOOM_CONTAINER */}
    <Animated.Image
    source={{uri}}
    style={[
     s.communityViewerImage,
     animatedStyle
    ]}
    resizeMode="contain"
   />
   </Animated.View>
  </GestureDetector>
 );
}


const COMMUNITY_VIEWER_HEIGHT=
 Dimensions.get('window').height;

// PATCH_161H_SINGLE_SCREEN_COMMUNITY
/* PATCH_173H_R4_STRICT_PUBLIC_LOCALIZATION */

/* PATCH_186K_PUBLIC_COMMUNITY_INFINITE_ALGO_ADMOB */
const BUKLOD_COMMUNITY_INLINE_AD_INTERVAL_186K =
  12;

function buildBuklodCommunityFeedRows186K(
  sourceRows: any[],
) {
  const visiblePosts =
    sourceRows.filter(
      (post: any) =>
        !String(
          post.media_mime_type ||
            '',
        ).startsWith(
          'video/',
        ),
    );

  const rows: any[] =
    [];

  visiblePosts.forEach(
    (
      post: any,
      index: number,
    ) => {
      rows.push(
        post,
      );

      if (
        (index + 1) %
          BUKLOD_COMMUNITY_INLINE_AD_INTERVAL_186K ===
        0
      ) {
        rows.push({
          id:
            '__buklod_inline_ad_186k_' +
            String(
              index + 1,
            ),
          __buklodInlineAd186K:
            true,
        });
      }
    },
  );

  return rows;
}


/* PATCH_186M_COMMUNITY_MEDIA_PATH_FALLBACK */
const communityMediaFallbackCache186M =
  new Map<
    string,
    {
      url:string;
      at:number;
    }
  >();

function BuklodCommunityMediaImage186M({
  photo,
  style,
}:{
  photo:any;
  style:any;
}) {
  const directUri =
    String(
      photo?.media_url ??
      ''
    ).trim();

  const [
    resolvedUri,
    setResolvedUri,
  ] =
    useCommunityMediaState186M<
      string | null
    >(
      directUri ||
      null
    );

  useCommunityMediaEffect186M(
    () => {
      let active =
        true;

      const currentDirect =
        String(
          photo?.media_url ??
          ''
        ).trim();

      if (currentDirect) {
        setResolvedUri(
          currentDirect
        );

        return () => {
          active =
            false;
        };
      }

      const path =
        String(
          photo?.media_path ??
          ''
        ).trim();

      if (!path) {
        setResolvedUri(
          null
        );

        return () => {
          active =
            false;
        };
      }

      const cached =
        communityMediaFallbackCache186M
          .get(path);

      if (
        cached &&
        Date.now() -
          cached.at <
          50 * 60 * 1000
      ) {
        /*
         * Local display hydration only.
         * This does not write anything to the database.
         * Keeping the resolved URI on the row also lets the
         * existing full-screen photo viewer reuse it.
         */
        photo.media_url =
          cached.url;

        setResolvedUri(
          cached.url
        );

        return () => {
          active =
            false;
        };
      }

      setResolvedUri(
        null
      );

      void (async () => {
        try {
          const {
            data,
            error,
          } =
            await supabase
              .storage
              .from(
                'community-media'
              )
              .createSignedUrl(
                path,
                3600
              );

          if (!active) {
            return;
          }

          const signedUrl =
            !error
              ? String(
                  data?.signedUrl ??
                  ''
                ).trim()
              : '';

          if (!signedUrl) {
            setResolvedUri(
              null
            );

            return;
          }

          communityMediaFallbackCache186M
            .set(
              path,
              {
                url:
                  signedUrl,
                at:
                  Date.now(),
              }
            );

          photo.media_url =
            signedUrl;

          setResolvedUri(
            signedUrl
          );
        }
        catch {
          if (active) {
            setResolvedUri(
              null
            );
          }
        }
      })();

      return () => {
        active =
          false;
      };
    },
    [
      photo?.media_path,
      photo?.media_url,
    ],
  );

  if (!resolvedUri) {
    return (
      <View
        style={[
          style,
          {
            backgroundColor:
              '#EEF3F0',
          },
        ]}
      />
    );
  }

  return (
    <CommunityMediaImage186M
      source={{
        uri:
          resolvedUri,
      }}
      style={style}
      resizeMode="cover"
    />
  );
}

export default function BuklodScreen(){
 const {
  activeScope,
  loading:scopeLoading,
  error:scopeError
 }=useBuklodScope();

 if(scopeLoading){
  return(
   <View
    style={[
     shared.screen,
     {
      flex:1,
      alignItems:'center',
      justifyContent:'center'
     }
    ]}
   >
    <ActivityIndicator color={colors.green}/>
   </View>
  );
 }

 if(!activeScope){
  return(
   <View
    style={[
     shared.screen,
     {
      flex:1,
      padding:16,
      justifyContent:'center'
     }
    ]}
   >
    <Card>
     <Text style={shared.h2}>
      Community unavailable
     </Text>
     <Text style={shared.muted}>
      {scopeError||
       'No active Community is available.'}
     </Text>
    </Card>
   </View>
  );
 }

 /*
  * PATCH_165G_CANONICAL_COMMUNITY
  *
  * PUBLIC keeps the mature Community engine while
  * scoped communities use the unified scope engine.
  *
  * Compatibility bridge only:
  * no legacy Community DB/code is removed yet.
  */
 if(activeScope.scope_type!=='PUBLIC'){
  return(
   <Redirect
    href={'/scope?section=community' as any}
   />
  );
 }

 return <LegacyPublicBuklodScreen/>;
}

function LegacyPublicBuklodScreen(){

 const communityInsets=
  useSafeAreaInsets();

 /* PERF2_PROGRESSIVE_FEED */
 const [
   feedLimit,
   setFeedLimit
 ] = useState(40);
 /* PATCH_154N_COMMUNITY_MEDIA_CACHE */
 const communityMediaUrlCacheRef=
  useRef<Record<string,{url:string;at:number}>>({});

 const {featureEnabled}=useRuntimeConfig(); const {user,profile}=useAuth();
 const {
   activeScope,
 } = useBuklodScope();
 const [posts,setPosts]=useState<any[]>([]),[group,setGroup]=useState<any>(null),[body,setBody]=useState('');
 const [category,setCategory]=useState<typeof CATEGORIES[number]>('reflection');

 // COMMUNITY_COMPACT_COMPOSER_20260811
 const [composerHeight,setComposerHeight]=useState(52);
 const [audience,setAudience]=useState<Audience>('public'); const [feedMode]=useState<FeedMode>('for_you');
 const [busy,setBusy]=useState(false),[photos,setPhotos]=useState<Photo[]>([]),[photoBusy,setPhotoBusy]=useState(false);

 /* PATCH_186B_PHOTO_EDITOR_PUBLIC_STATE */
 const [
  communityPhotoEditor,
  setCommunityPhotoEditor
 ]=useState<Photo|null>(null);
 /* PATCH_186O_PUBLIC_WALL_VIDEO */
 const [
  wallVideo186O,
  setWallVideo186O
 ]=useState<{
  uri:string;
  mimeType:string;
  sizeBytes:number;
  durationSeconds:number;
 }|null>(null);
 const [
  videoBusy186O,
  setVideoBusy186O
 ]=useState(false);


 const [mentionOpen,setMentionOpen]=useState(false),[mentionSearch,setMentionSearch]=useState(''),[mentionRows,setMentionRows]=useState<Mention[]>([]),[mentions,setMentions]=useState<Mention[]>([]);
// PATCH_161H_DRAWER_STATE
 const [commentOpen,setCommentOpen]=
  useState(false);

 const [commentPost,setCommentPost]=
  useState<any|null>(null);

 const [comments,setComments]=
  useState<any[]>([]);

 const [commentText,setCommentText]=
  useState('');

 const [commentBusy,setCommentBusy]=
  useState(false);

 const [replyTo,setReplyTo]=
  useState<any|null>(null);

 const [
  commentReactionTarget,
  setCommentReactionTarget
 ]=useState<any|null>(null);

 const [
  commentReactionOpen,
  setCommentReactionOpen
 ]=useState(false);

 const [viewerOpen,setViewerOpen]=
  useState(false);

 const [viewerItems,setViewerItems]=
  useState<any[]>([]);

 const [viewerIndex,setViewerIndex]=
  useState(0);

 const [
  savingPhotoKey,
  setSavingPhotoKey
 ]=useState<string|null>(null);

/* PATCH_166H_STALE_LOAD_GUARD */
 const communityLoadSeqRef=useRef(0);
/* PATCH_173H_R4_PUBLIC_LOCATION_STATE */
const [
  publicLocationScopeId,
  setPublicLocationScopeId,
] = useState<string | null>(null);

/* PATCH_186L_R3_TRUE_PAGED_STRICT_PUBLIC */
const load=useCallback(async(options?:{
  append?:boolean;
  offset?:number;
  limit?:number;
})=>{
  if(!user)return -1;

  const appendPage186L=
    Boolean(
      options?.append
    );

  const offset186L=
    Math.max(
      0,
      Number(
        options?.offset??0
      )||0
    );

  const limit186L=
    Math.max(
      1,
      Math.min(
        Number(
          options?.limit??40
        )||40,
        100
      )
    );
  const communityLoadSeq=++communityLoadSeqRef.current;
  const {data:m}=await supabase.from('group_members').select('group_id,buklod_groups:group_id(id,name,leader_id)').eq('user_id',user.id).eq('is_active',true).limit(1).maybeSingle();
  if(communityLoadSeq!==communityLoadSeqRef.current)return;
  const g:any=m?.buklod_groups??null; setGroup(g);
  const {data,error}=await (supabase as any).rpc(
    'get_buklod_public_community_feed_v7_page',
    {
      p_location_scope_id:publicLocationScopeId,
      p_mode:'for_you',
      p_limit:limit186L,
      p_offset:offset186L
    }
  );
  if(error){
    Alert.alert(
      'Community',
      error.message
    );

    return -1;
  }
  /* PATCH_154N_COMMUNITY_FEED_ROWS */
  const feedRows=
    (data??[]) as any[];

  const postIds=
    feedRows
      .map((p:any)=>p.id)
      .filter(Boolean);

  const myReactionByPost:
    Record<string,Reaction>={};

  if(postIds.length){
    const {
      data:myReactionRows,
      error:myReactionError
    }=
      await supabase
        .from('reactions')
        .select('post_id,reaction')
        .eq(
          'user_id',
          user.id
        )
        .in(
          'post_id',
          postIds
        );

    if(!myReactionError){
      for(
        const row of
          myReactionRows??[]
      ){
        myReactionByPost[
          row.post_id
        ]=
          row.reaction as Reaction;
      }
    }
  }

  const next=
    await Promise.all(
      feedRows.map(
        async(p:any)=>{
          const base={
            ...p,
            my_reaction:
              myReactionByPost[
                p.id
              ]??null
          };

          if(!p.media_path){
            return{
              ...base,
              media_url:null
            };
          }

          const cached=
            communityMediaUrlCacheRef
              .current[
                p.media_path
              ];

          if(
            cached &&
            Date.now()-cached.at <
              50*60*1000
          ){
            return{
              ...base,
              media_url:
                cached.url
            };
          }

          const {data:s}=
            await supabase
              .storage
              .from(
                'community-media'
              )
              .createSignedUrl(
                p.media_path,
                3600
              );

          const url=
            s?.signedUrl??null;

          if(url){
            communityMediaUrlCacheRef
              .current[
                p.media_path
              ]={
                url,
                at:Date.now()
              };
          }

          return{
            ...base,
            media_url:url
          };
        }
      )
    );

  
  // PATCH_161H_MEDIA_LOAD
  const mediaMap:
   Record<string,any[]> =
   {};

  const mediaPostIds=
   next
    .map(
     (p:any)=>p?.id
    )
    .filter(Boolean);

  if(mediaPostIds.length){
   const {
    data:mediaRows,
    error:mediaError
   }=
    await (
     supabase as any
    ).rpc(
     'get_buklod_post_media_v1',
     {
      p_post_ids:
       mediaPostIds
     }
    );

   if(mediaError){
    console.warn(
     'Community photos:',
     mediaError.message
    );
   }
   else{
    const signedMedia=
     await Promise.all(
      (mediaRows??[])
       .map(
        async(row:any)=>{
         const {
          data:signed
         }=
          await supabase
           .storage
           .from(
            'community-media'
           )
           .createSignedUrl(
            row.media_path,
            3600
           );

         return {
          ...row,
          media_url:
           signed?.signedUrl??
           null
         };
        }
       )
     );

    for(
     const row
     of signedMedia
    ){
     if(!row?.post_id){
      continue;
     }

     if(
      !mediaMap[
       row.post_id
      ]
     ){
      mediaMap[
       row.post_id
      ]=[];
     }

     mediaMap[
      row.post_id
     ].push(row);
    }
   }
  }

  for(const p of next){
   const loaded=
    mediaMap[p.id]??[];

   if(loaded.length){
    p.media_items=
     loaded.sort(
      (a:any,b:any)=>
       Number(
        a.media_position??0
       )-
       Number(
        b.media_position??0
       )
     );
   }
   else if(
    p.media_url &&
    !String(
     p.media_mime_type??
     ''
    )
     .toLowerCase()
     .startsWith(
      'video/'
     )
   ){
    p.media_items=[
     {
      post_id:p.id,
      media_position:0,
      media_path:
       p.media_path,
      media_mime_type:
       p.media_mime_type,
      media_size_bytes:
       p.media_size_bytes,
      media_url:
       p.media_url
     }
    ];
   }
   else{
    p.media_items=[];
   }
  }

// COMMUNITY_AUTHOR_CIRCLE_RANK
  const authorIds = Array.from(
    new Set(
      next
        .map((p: any) => p.user_id)
        .filter(Boolean)
    )
  );

  const rankMap =
    new Map<string, string>();

  if (authorIds.length) {
    const { data: rankRows } =
      await (supabase as any).rpc(
        'get_member_circle_ranks_v1',
        {
          p_user_ids: authorIds,
        }
      );

    for (const row of rankRows ?? []) {
      if (row?.user_id && row?.rank_name) {
        rankMap.set(
          row.user_id,
          row.rank_name
        );
      }
    }
  }

  // PATCH_154A_CLUSTER_MAP
  const clusterMap =
    await getClusterLabels(
      authorIds as string[]
    );
  if(communityLoadSeq!==communityLoadSeqRef.current)return;
  const preparedPosts186L=
    next.map((p:any)=>({
      ...p,
      cluster_name:
        clusterMap[p.user_id] ??
        null,
      author_rank_name:
        rankMap.get(p.user_id) ??
        'Circle Starter V',
    }));

  if(appendPage186L){
    setPosts(previous=>{
      const seen=
        new Set(
          previous.map(
            (row:any)=>
              String(row.id)
          )
        );

      return [
        ...previous,
        ...preparedPosts186L.filter(
          (row:any)=>
            !seen.has(
              String(row.id)
            )
        )
      ];
    });
  }
  else{
    setPosts(
      preparedPosts186L
    );
  }

  return preparedPosts186L.length;
 },[user?.id,feedLimit, publicLocationScopeId]);
/* PATCH_166H_INITIAL_LOAD */
 useEffect(()=>{
  void load();

  return()=>{
   communityLoadSeqRef.current+=1;
  };
 },[load]);
 /* PATCH_166H_SAFE_COMMUNITY_REALTIME */
 useEffect(()=>{
  if(!user?.id)return;

  let disposed=false;
  let reloadTimer:
   ReturnType<typeof setTimeout>|null=
   null;

  const requestReload=()=>{
   if(disposed)return;

   if(reloadTimer){
    clearTimeout(reloadTimer);
   }

   reloadTimer=
    setTimeout(()=>{
     reloadTimer=null;

     if(!disposed){
      void load();
     }
    },140);
  };

  // Remove any stale channel left by Fast Refresh / remount.
  const staleChannels=
   ((supabase as any).getChannels?.()??[])
    .filter((existing:any)=>
     String(existing?.topic??'')
      .includes(`buklod-social:${user.id}`)
    );

  for(const existing of staleChannels){
   void (supabase as any).removeChannel(existing);
  }

  // Unique topic prevents an already-subscribed channel from being reused.
  const realtimeTopic=
   `buklod-social:${user.id}:`+
   `${Date.now()}:`+
   Math.random().toString(36).slice(2,8);

  const c=
   supabase
    .channel(realtimeTopic)
    .on(
     'postgres_changes',
     {
      event:'*',
      schema:'public',
      table:'community_posts'
     },
     requestReload
    )
    .on(
     'postgres_changes',
     {
      event:'*',
      schema:'public',
      table:'comments'
     },
     requestReload
    )
    .on(
     'postgres_changes',
     {
      event:'*',
      schema:'public',
      table:'reactions'
     },
     requestReload
    )
    .subscribe();

  return()=>{
   disposed=true;

   if(reloadTimer){
    clearTimeout(reloadTimer);
    reloadTimer=null;
   }

   void supabase.removeChannel(c);
  };
 },[user?.id,load]);
 /* PATCH_186B_PHOTO_EDITOR_PUBLIC_PREPARE */
 const prepareCommunityPhoto=
  async(asset:any)=>{
   const M=
    await import(
     'expo-image-manipulator'
    );

   const context=
    M.ImageManipulator
     .manipulate(
      asset.uri
     );

   if(
    Number(
     asset.width??0
    )>1600
   ){
    context.resize({
     width:1600
    });
   }

   const rendered=
    await context
     .renderAsync();

   const image=
    await rendered
     .saveAsync({
      format:
       M.SaveFormat.JPEG,
      compress:.86,
      base64:true
     });

   if(!image.base64){
    throw new Error(
     'Could not prepare this photo.'
    );
   }

   const sizeBytes=
    Math.ceil(
     image.base64.length*
      .75
    );

   if(
    sizeBytes>
     5*1024*1024
   ){
    throw new Error(
     'Photo is too large.'
    );
   }

   setCommunityPhotoEditor({
    uri:image.uri,
    base64:image.base64,
    sizeBytes
   });
  };


 /* PATCH_154S_COMMUNITY_CAMERA */
 const takeCommunityPhoto=
  async()=>{
   try{
    setPhotoBusy(true);

    const P=
     await import(
      'expo-image-picker'
     );

    const perm=
     await P
      .requestCameraPermissionsAsync();

    if(!perm.granted){
     Alert.alert(
      'Camera Permission',
      'Allow BUKLOD to use your camera to take a photo.'
     );

     return;
    }

    const r=
     await P.launchCameraAsync({
      mediaTypes:
       ['images'] as any,
      allowsEditing:false,
      quality:1
     });

    if(
     r.canceled ||
     !r.assets?.[0]
    ){
     return;
    }

    await prepareCommunityPhoto(
     r.assets[0]
    );

   }catch(e:any){

    Alert.alert(
     'Camera',
     e?.message ??
     'Could not take photo.'
    );

   }finally{
    setPhotoBusy(false);
   }
  };


 const chooseCommunityPhoto=
  async()=>{
   try{
    setPhotoBusy(true);

    const P=
     await import(
      'expo-image-picker'
     );

    const perm=
     await P
      .requestMediaLibraryPermissionsAsync();

    if(!perm.granted){
     Alert.alert(
      'Photo Permission',
      'Allow BUKLOD to access your photos.'
     );

     return;
    }

    const r=
     await P
      .launchImageLibraryAsync({
       mediaTypes:
        ['images'] as any,
       allowsEditing:false,
       allowsMultipleSelection:false,
       quality:1
      });

    if(
     r.canceled ||
     !r.assets?.[0]
    ){
     return;
    }

    await prepareCommunityPhoto(
     r.assets[0]
    );

   }catch(e:any){

    Alert.alert(
     'Photo',
     e?.message ??
     'Could not select photo.'
    );

   }finally{
    setPhotoBusy(false);
   }
  };
 /* PATCH_186B_PHOTO_EDITOR_PUBLIC_PICK */
 const pickPhoto=
  async()=>{
   if(photos.length>=5){
    return Alert.alert(
     'Photos',
     'Maximum of 5 photos per post.'
    );
   }

   try{
    setPhotoBusy(true);

    const P=
     await import(
      'expo-image-picker'
     );

    const perm=
     await P
      .requestMediaLibraryPermissionsAsync();

    if(!perm.granted){
     return Alert.alert(
      'Photos',
      'Please allow photo access.'
     );
    }

    /*
     * One photo at a time keeps the edit-before-post rule exact.
     * Users can still attach up to 5 photos by tapping Add Photos again.
     */
    const result=
     await P
      .launchImageLibraryAsync({
       mediaTypes:
        ['images'] as any,
       allowsEditing:false,
       allowsMultipleSelection:false,
       quality:.95
      });

    if(
     result.canceled ||
     !result.assets?.[0]
    ){
     return;
    }

    await prepareCommunityPhoto(
     result.assets[0]
    );
   }
   catch(e:any){
    Alert.alert(
     'Photos',
     e?.message||
      'Could not select photo.'
    );
   }
   finally{
    setPhotoBusy(false);
   }
  };

 const removePhoto=
  (index:number)=>{
   setPhotos(
    current=>
     current.filter(
      (_item,i)=>
       i!==index
     )
   );
  };

 const acceptWallVideo186O=
  async(asset:any)=>{
   const durationMs=
    Number(
     asset?.duration??0
    );

   const durationSeconds=
    Math.ceil(
     durationMs/1000
    );

   if(
    !durationSeconds ||
    durationSeconds<1
   ){
    Alert.alert(
     'Video',
     'Could not read this video duration.'
    );
    return false;
   }

   if(durationSeconds>60){
    Alert.alert(
     'Video Too Long',
     'Community Wall videos may be up to 60 seconds.'
    );
    return false;
   }

   let sizeBytes=
    Number(
     asset?.fileSize??0
    );

   if(!sizeBytes){
    try{
     const FS:any=
      await import(
       'expo-file-system/legacy'
      );

     const info:any=
      await FS.getInfoAsync(
       asset.uri,
       {size:true} as any
      );

     sizeBytes=
      Number(
       info?.size??0
      );
    }
    catch{
     sizeBytes=0;
    }
   }

   if(
    sizeBytes>
    50*1024*1024
   ){
    Alert.alert(
     'Video Too Large',
     'Community Wall videos must be 50 MB or smaller.'
    );
    return false;
   }

   const uri=
    String(
     asset?.uri??''
    );

   if(!uri){
    Alert.alert(
     'Video',
     'Could not prepare this video.'
    );
    return false;
   }

   const suppliedMime=
    String(
     asset?.mimeType??''
    )
     .trim()
     .toLowerCase();

   const mimeType=
    suppliedMime.startsWith(
     'video/'
    )
     ? suppliedMime
     : uri
        .toLowerCase()
        .includes('.mov')
       ? 'video/quicktime'
       : 'video/mp4';

   setPhotos([]);
   setWallVideo186O({
    uri,
    mimeType,
    sizeBytes,
    durationSeconds
   });

   return true;
  };

 const pickWallVideo186O=
  async()=>{
   if(
    busy ||
    videoBusy186O
   ){
    return;
   }

   try{
    setVideoBusy186O(true);

    const P=
     await import(
      'expo-image-picker'
     );

    const permission=
     await P
      .requestMediaLibraryPermissionsAsync();

    if(!permission.granted){
     Alert.alert(
      'Video Permission',
      'Please allow BUKLOD to access your videos.'
     );
     return;
    }

    const result=
     await P
      .launchImageLibraryAsync({
       mediaTypes:
        ['videos'] as any,
       allowsEditing:false,
       videoMaxDuration:60,
       quality:1
      });

    if(
     result.canceled ||
     !result.assets?.length
    ){
     return;
    }

    await acceptWallVideo186O(
     result.assets[0]
    );
   }
   catch(error:any){
    Alert.alert(
     'Video',
     error?.message||
      'Could not prepare this video.'
    );
   }
   finally{
    setVideoBusy186O(false);
   }
  };



 const searchMentions=async(q='')=>{

  const perfMentionSeq =
    ++PERF2_MENTION_SEARCH_SEQ;

  await new Promise<void>(
    resolve =>
      setTimeout(
        resolve,
        220
      )
  );

  if (
    perfMentionSeq !==
    PERF2_MENTION_SEARCH_SEQ
  ) {
    return;
  }
const {data,error}=await (supabase as any).rpc('search_post_mention_candidates_v2',{p_audience:audience,p_group_id:audience==='group'?group?.id??null:null,p_query:q,p_limit:40});
  if(error)return Alert.alert('Mention',error.message);(
  perfMentionSeq ===
  PERF2_MENTION_SEARCH_SEQ
) && setMentionRows(
  data ?? []
)};
 const toggleMention=(m:Mention)=>setMentions(v=>v.some(x=>x.user_id===m.user_id)?v.filter(x=>x.user_id!==m.user_id):[...v,m]);

 const publish=async()=>{
  if(!user)return;

  if(
   audience==='group' &&
   !group?.id
  ){
   return Alert.alert(
    'BUKLOD',
    'No active Cluster. Choose LOCAL or PUBLIC.'
   );
  }

  if(
   audience==='local' &&
    !profile?.church_id
  ){
   return Alert.alert(
    'BUKLOD',
    'A Local Church is required.'
   );
  }

  if(
    !body.trim() &&
    !photos.length &&
    !wallVideo186O
   ){
    return Alert.alert(
     'BUKLOD',
     'Write a message, add photos, or add a video.'
    );
   }

  if(
    wallVideo186O &&
    photos.length
   ){
    return Alert.alert(
     'BUKLOD',
     'Choose either photos or one video for this post.'
    );
   }

   setBusy(true);

  const uploaded:
   Array<{
    media_path:string;
    media_mime_type:string;
    media_size_bytes:number;
   }>=[];

  let createdPostId:
   string|null=
   null;

  try{
    if(wallVideo186O){
     const lowerMime=
      wallVideo186O
       .mimeType
       .toLowerCase();

     const extension=
      lowerMime.includes(
       'quicktime'
      ) ||
      wallVideo186O
       .uri
       .toLowerCase()
       .includes('.mov')
       ? 'mov'
       : 'mp4';

     const videoPath=
      `${user.id}/post-video-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

     await uploadCommunityVideoFile({
      path:videoPath,
      uri:wallVideo186O.uri,
      contentType:
       wallVideo186O.mimeType
     });

     uploaded.push({
      media_path:videoPath,
      media_mime_type:
       wallVideo186O.mimeType,
      media_size_bytes:
       wallVideo186O.sizeBytes
     });
    }

    for(
     let index=0;
    index<photos.length;
    index++
   ){
    const photo=
     photos[index];

    const path=
     `${user.id}/post-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.jpg`;

    const {
     error:uploadError
    }=
     await supabase
      .storage
      .from(
       'community-media'
      )
      .upload(
       path,
       decode(
        photo.base64
       ),
       {
        contentType:
         'image/jpeg',
        upsert:false
       }
      );

    if(uploadError){
     throw uploadError;
    }

    uploaded.push({
     media_path:path,
     media_mime_type:
      'image/jpeg',
     media_size_bytes:
      photo.sizeBytes
    });
   }

   const first=
    uploaded[0]??null;

   const {
    data:created,
    error:createError
   }=
    await (
     supabase as any
    ).rpc(
     'create_buklod_community_post_v3',
     {
      p_audience:
       audience,
      p_group_id:
       audience==='group'
        ? group?.id??null
        : null,
      p_category:
       category,
      p_body:
       body.trim()||
       (
        wallVideo186O
         ? 'Shared a video.'
         : uploaded.length>1
          ? 'Shared photos.'
          : 'Shared a photo.'
       ),
      p_media_path:
       first?.media_path??
       null,
      p_media_mime_type:
       first?.media_mime_type??
       null,
      p_media_size_bytes:
       first?.media_size_bytes??
       null,
      p_mentioned_user_ids:
       mentions.map(
        x=>x.user_id
       )
     }
    );

   if(createError){
    throw createError;
   }

   createdPostId=
    typeof created==='string'
     ? created
     : Array.isArray(created)
     ? (
        typeof created[0]==='string'
         ? created[0]
         : created[0]?.id??null
       )
     : created?.id??null;

   if(!createdPostId){
    throw new Error(
     'Post was created but its ID was not returned.'
    );
   }

   if(uploaded.length&&!wallVideo186O){
    const {
     error:mediaError
    }=
     await (
      supabase as any
     ).rpc(
      'set_buklod_post_media_v1',
      {
       p_post_id:
        createdPostId,
       p_media:
        uploaded
      }
     );

    if(mediaError){
     throw mediaError;
    }
   }

   setBody('');
   setComposerHeight(52);
   setPhotos([]);
   setWallVideo186O(null);
   setMentions([]);

   await load();
  }
  catch(e:any){
   /*
    * If post creation itself failed,
    * remove all uploaded files.
    *
    * If the post already exists,
    * keep photo #1 because the legacy
    * community_posts field still points
    * to it.
    */
   if(!createdPostId){
    if(uploaded.length){
     await supabase
      .storage
      .from(
       'community-media'
      )
      .remove(
       uploaded.map(
        x=>x.media_path
       )
      );
    }
   }
   else if(
    uploaded.length>1
   ){
    await supabase
     .storage
     .from(
      'community-media'
     )
     .remove(
      uploaded
       .slice(1)
       .map(
        x=>x.media_path
       )
     );
   }

   Alert.alert(
    'Could Not Post',
    e?.message||
    'Posting failed.'
   );

   await load();
  }
  finally{
   setBusy(false);
  }
 };const react=async(
  postId:string,
  reaction:Reaction
)=>{
  /* PATCH_154N_OPTIMISTIC_COMMUNITY_REACTION */

  const current=
    posts.find(
      p=>p.id===postId
    );

  const previous=
    (
      current?.my_reaction??
      null
    ) as Reaction|null;

  const nextReaction=
    previous===reaction
      ? null
      : reaction;

  const changeReaction=(
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
        total,
      my_reaction:
        to
    };
  };

  /* Count changes NOW */
  setPosts(
    currentPosts=>
      currentPosts.map(
        p=>
          p.id===postId
            ? changeReaction(
                p,
                previous,
                nextReaction
              )
            : p
      )
  );

  const {error}=
    await(
      supabase as any
    ).rpc(
      'set_buklod_post_reaction_v3',
      {
        p_post_id:
          postId,
        p_reaction:
          reaction
      }
    );

  if(error){
    /* DB rejected: restore count */
    setPosts(
      currentPosts=>
        currentPosts.map(
          p=>
            p.id===postId
              ? changeReaction(
                  p,
                  nextReaction,
                  previous
                )
              : p
        )
    );

    Alert.alert(
      'Reaction',
      error.message
    );
  }
};


 
 // PATCH_161H_INTERACTIONS

 const reactionLabel=
  (value?:string|null)=>{
   if(!value)return '';

   return (
    RX.find(
     r=>r.key===value
    )?.label??
    value
   );
  };


 const commentReactionTotal=
  (item:any)=>{
   return Object
    .values(
     item?.reaction_counts??
     {}
    )
    .reduce(
     (
      total:number,
      value:any
     )=>
      total+
      Number(
       value??0
      ),
     0
    );
  };


 const loadComments=
  useCallback(
   async(
    postId:string
   )=>{
    const [
     commentsResult,
     reactionsResult
    ]=
     await Promise.all([
      (
       supabase as any
      ).rpc(
       'get_buklod_post_comments_v4',
       {
        p_post_id:
         postId
       }
      ),

      (
       supabase as any
      ).rpc(
       'get_buklod_comment_reactions_v1',
       {
        p_post_id:
         postId
       }
      )
     ]);

    if(
     commentsResult.error
    ){
     Alert.alert(
      'Comments',
      commentsResult
       .error
       .message
     );
     return;
    }

    const rows=
     (
      commentsResult.data??
      []
     ) as any[];

    const clusterMap=
     await getClusterLabels(
      rows.map(
       (row:any)=>
        row.user_id
      )
     );

    const reactionMap=
     new Map<string,any>();

    for(
     const row
     of (
      reactionsResult.data??
      []
     )
    ){
     reactionMap.set(
      String(
       row.comment_id
      ),
      row
     );
    }

    setComments(
     rows.map(
      (row:any)=>{
       const reaction=
        reactionMap.get(
         String(row.id)
        );

       return {
        ...row,
        cluster_name:
         clusterMap[
          row.user_id
         ]??null,
        reaction_counts:
         reaction?.reaction_counts??
         {},
        my_reaction:
         reaction?.my_reaction??
         null
       };
      }
     )
    );
   },
   []
  );


 const openComments=
  async(
   post:any
  )=>{
   setCommentPost(post);
   setComments([]);
   setCommentText('');
   setReplyTo(null);
   setCommentOpen(true);

   await loadComments(
    post.id
   );
  };


 const closeComments=
  ()=>{
   setCommentOpen(false);
   setReplyTo(null);
   setCommentText('');
   setCommentReactionOpen(false);
   setCommentReactionTarget(null);
  };


 const submitCommunityComment=
  async()=>{
   if(
    !commentPost?.id ||
    !commentText.trim() ||
    commentBusy
   ){
    return;
   }

   let finalBody=
    commentText.trim();

   if(replyTo){
    const mention=
     '@'+
     String(
      replyTo.commenter_name||
      'BUKLOD Member'
     );

    if(
     !finalBody
      .toLowerCase()
      .startsWith(
       mention.toLowerCase()
      )
    ){
     finalBody=
      mention+
      ' '+
      finalBody;
    }
   }

   setCommentBusy(true);

   const {error}=
    await (
     supabase as any
    ).rpc(
     'add_buklod_post_comment_v4',
     {
      p_post_id:
       commentPost.id,
      p_body:
       finalBody,
      p_parent_id:
       replyTo?.id??
       null
     }
    );

   setCommentBusy(false);

   if(error){
    return Alert.alert(
     'Comment',
     error.message
    );
   }

   setCommentText('');
   setReplyTo(null);

   await Promise.all([
    loadComments(
     commentPost.id
    ),
    load()
   ]);
  };


 const openCommentReaction=
  (item:any)=>{
   setCommentReactionTarget(
    item
   );
   setCommentReactionOpen(
    true
   );
  };


 const reactToComment=
  async(
   reaction:Reaction
  )=>{
   const target=
    commentReactionTarget;

   if(!target?.id){
    return;
   }

   const targetId=
    String(target.id);

   const previous=
    (
     target.my_reaction??
     null
    ) as
     Reaction|null;

   const nextReaction=
    previous===reaction
     ? null
     : reaction;

   setCommentReactionOpen(
    false
   );

   setCommentReactionTarget(
    null
   );

   setComments(
    current=>
     current.map(
      item=>{
       if(
        String(item.id)!==
        targetId
       ){
        return item;
       }

       const counts={
        ...(
         item.reaction_counts??
         {}
        )
       };

       if(previous){
        counts[previous]=
         Math.max(
          0,
          Number(
           counts[previous]??
           0
          )-1
         );
       }

       if(nextReaction){
        counts[nextReaction]=
         Number(
          counts[nextReaction]??
          0
         )+1;
       }

       return {
        ...item,
        my_reaction:
         nextReaction,
        reaction_counts:
         counts
       };
      }
     )
   );

   const {error}=
    await (
     supabase as any
    ).rpc(
     'set_buklod_comment_reaction_v1',
     {
      p_comment_id:
       targetId,
      p_reaction:
       reaction
     }
    );

   if(error){
    Alert.alert(
     'Reaction',
     error.message
    );

    if(commentPost?.id){
     await loadComments(
      commentPost.id
     );
    }
   }
  };


 // PATCH_161H_C_PHOTO_ACTIONS

 const photoReactionTotal=
  (photo:any)=>{
   return Object
    .values(
     photo?.reaction_counts??
     {}
    )
    .reduce(
     (
      total:number,
      value:any
     )=>
      total+
      Number(
       value??0
      ),
     0
    );
  };


 const reactToCommunityPhoto=
  async(
   photo:any,
   reaction:Reaction
  )=>{

   const postId=
    String(
     photo?.post_id??
     ''
    );

   const mediaPosition=
    Number(
     photo?.media_position??
     0
    );


   if(!postId){
    return;
   }


   const previous=
    (
     photo?.my_reaction??
     null
    ) as Reaction|null;


   const {
    data,
    error
   }=
    await (
     supabase as any
    ).rpc(
     'set_buklod_photo_reaction_v1',
     {
      p_post_id:
       postId,

      p_media_position:
       mediaPosition,

      p_reaction:
       reaction
     }
    );


   if(error){
    return Alert.alert(
     'Photo Reaction',
     error.message
    );
   }


   const nextReaction=
    (
     data??
     null
    ) as Reaction|null;


   const updatePhoto=
    (item:any)=>{

     if(
      String(
       item?.post_id??
       ''
      )!==postId
      ||
      Number(
       item?.media_position??
       0
      )!==mediaPosition
     ){
      return item;
     }


     const counts={
      ...(
       item?.reaction_counts??
       {}
      )
     };


     if(previous){
      counts[previous]=
       Math.max(
        0,
        Number(
         counts[previous]??
         0
        )-1
       );
     }


     if(nextReaction){
      counts[nextReaction]=
       Number(
        counts[nextReaction]??
        0
       )+1;
     }


     return {
      ...item,

      reaction_counts:
       counts,

      my_reaction:
       nextReaction
     };
    };


   setViewerItems(
    current=>
     current.map(
      updatePhoto
     )
   );


   setPosts(
    current=>
     current.map(
      post=>{

       if(
        String(post.id)!==
        postId
       ){
        return post;
       }

       return {
        ...post,

        media_items:
         Array.isArray(
          post.media_items
         )
          ? post.media_items
             .map(
              updatePhoto
             )
          : []
       };
      }
     )
   );
  };


 const saveCommunityPhoto=
  async(
   photo:any
  )=>{

   const url=
    String(
     photo?.media_url??
     ''
    );


   if(!url){
    return;
   }


   const key=
    String(
     photo?.post_id??
     ''
    )+
    ':'+
    String(
     photo?.media_position??
     0
    );


   try{
    setSavingPhotoKey(
     key
    );


    const FS=
     await import(
      'expo-file-system'
     );


    const ML=
     await import(
      'expo-media-library'
     );


    const permission=
     await ML
      .requestPermissionsAsync(
       true,
       ['photo']
      );


    if(!permission.granted){
     return Alert.alert(
      'Save Photo',
      'Please allow BUKLOD to save photos to your device.'
     );
    }


    const mime=
     String(
      photo?.media_mime_type??
      'image/jpeg'
     )
      .toLowerCase();


    const extension=
     mime.includes(
      'png'
     )
      ? 'png'
      : mime.includes(
         'webp'
        )
      ? 'webp'
      : 'jpg';


    const destination=
     new FS.File(
      FS.Paths.cache,
      'buklod-'+
       Date.now()+
       '-'+
       Math.random()
        .toString(36)
        .slice(2)+
       '.'+
       extension
     );


    const downloaded=
     await FS.File
      .downloadFileAsync(
       url,
       destination
      );


    await ML.Asset.create(
     downloaded.uri
    );


    Alert.alert(
     'Saved',
     'Photo saved to your gallery.'
    );
   }
   catch(e:any){
    Alert.alert(
     'Save Photo',
     e?.message||
     'Could not save this photo.'
    );
   }
   finally{
    setSavingPhotoKey(
     null
    );
   }
  };


 const renderViewerPhotoActions=
  ()=>{

   const photo=
    viewerItems[
     viewerIndex
    ];


   if(!photo){
    return null;
   }


   const counts=
    photo.reaction_counts??
    {};


   const saveKey=
    String(
     photo?.post_id??
     ''
    )+
    ':'+
    String(
     photo?.media_position??
     0
    );


   return (
    <View
     style={[
      s.communityViewerActions,
      {
       bottom:
        Math.max(
         communityInsets.bottom+14,
         Platform.OS==='android'
          ? 68
          : 26
        )
      }
     ]}
    >

     <Text style={s.communityViewerActionTitle}>
      React to this photo
     </Text>


     <View style={s.communityViewerReactionRow}>

      {RX.map(r=>{

       const active=
        photo.my_reaction===
        r.key;

       const count=
        Number(
         counts[r.key]??
         0
        );


       return (
        <Pressable
         key={r.key}

         accessibilityRole="button"

         accessibilityLabel={
          r.label+
          (
           count
            ? ', '+
              count
            : ''
          )
         }

         onPress={()=>
          void reactToCommunityPhoto(
           photo,
           r.key
          )
         }

         style={[
          s.communityViewerReactionButton,
          active&&
           s.communityViewerReactionButtonActive
         ]}
        >

         <MaterialCommunityIcons
          name={r.icon}
          size={20}
          color={
           active
            ? '#FFFFFF'
            : '#FFFFFF'
          }
         />

         {count>0&&(
          <Text style={s.communityViewerReactionCount}>
           {count}
          </Text>
         )}

        </Pressable>
       );
      })}


      <Pressable
       disabled={
        savingPhotoKey===
        saveKey
       }

       onPress={()=>
        void saveCommunityPhoto(
         photo
        )
       }

       style={s.communityViewerSaveButton}
      >

       <MaterialCommunityIcons
        name={
         savingPhotoKey===
         saveKey
          ? 'progress-download'
          : 'download'
        }
        size={20}
        color="#FFFFFF"
       />

       <Text style={s.communityViewerSaveText}>
        {savingPhotoKey===
         saveKey
          ? 'Saving'
          : 'Save'}
       </Text>

      </Pressable>

     </View>


     {photoReactionTotal(photo)>0&&(
      <Text style={s.communityViewerReactionSummary}>
       {photoReactionTotal(photo)}
       {' '}
       {photoReactionTotal(photo)===1
        ? 'reaction'
        : 'reactions'}
       {' on this photo'}
      </Text>
     )}

    </View>
   );
  };


 const openPhotoViewer=
  (
   media:any[],
   index:number
  )=>{
   if(!media.length){
    return;
   }

   setViewerItems(media);
   setViewerIndex(index);
   setViewerOpen(true);
  };


 const renderCommunityMedia=
  (item:any)=>{

    const videoMime186O=
     String(
      item?.media_mime_type??
      ''
     )
      .trim()
      .toLowerCase();

    const videoUrl186O=
     String(
      item?.media_url??
      ''
     )
      .trim();

    if(
     videoMime186O
      .startsWith('video/') &&
     videoUrl186O
    ){
     return (
      <CommunityVideo
       uri={videoUrl186O}
       height={300}
      />
     );
    }

   const mediaItems186M=
    Array.isArray(
      item?.media_items
    )
      ? item.media_items
      : [];

   /*
    * Legacy first-photo fallback:
    * community_posts.media_path remains the canonical first photo.
    * This keeps old posts visible even if multi-photo hydration
    * is late or temporarily unavailable.
    */
   const legacyMedia186M=
    (
      item?.media_path ||
      item?.media_url
    )
      ? [
          {
            post_id:
              item?.id,
            media_position:
              0,
            media_path:
              item?.media_path ??
              null,
            media_mime_type:
              item?.media_mime_type ??
              'image/jpeg',
            media_size_bytes:
              item?.media_size_bytes ??
              null,
            media_url:
              item?.media_url ??
              null,
          },
        ]
      : [];

   const rawMedia=
    (
      mediaItems186M.length
        ? mediaItems186M
        : legacyMedia186M
    )
      .filter(
        (x:any)=>
          (
            !!x?.media_url ||
            !!x?.media_path
          ) &&
          !String(
            x?.media_mime_type ??
            ''
          )
            .toLowerCase()
            .startsWith(
              'video/'
            )
      );


   const seenMedia=
    new Set<string>();


   const media=
    rawMedia
     .filter(
      (x:any)=>{

       /*
        * Prefer storage path because signed URLs
        * may differ even for the same file.
        */
       const key=
        String(
         x?.media_path||
         x?.media_url||
         ''
        )
         .trim();


       if(!key){
        return false;
       }


       if(
        seenMedia.has(
         key
        )
       ){
        return false;
       }


       seenMedia.add(
        key
       );

       return true;
      }
     )
     .slice(
      0,
      5
     );

   const count=
    media.length;

   if(!count){
    return null;
   }

   return (
    <View style={s.communityMediaGrid}>
     {media.map(
      (
       photo:any,
       index:number
      )=>{
       const tileStyle=
        count===1
         ? s.communityMediaOne
         : count===2
         ? s.communityMediaHalfTall
         : (
            count===3 &&
            index===0
           )
         ? s.communityMediaWide
         : (
            count===5 &&
            index===0
           )
         ? s.communityMediaWide
         : count===5
         ? s.communityMediaHalfSmall
         : s.communityMediaHalf;

       return (
        <Pressable
         key={
          photo.media_path||
          String(index)
         }
         onPress={()=>
          openPhotoViewer(
           media,
           index
          )
         }
         style={[
          s.communityMediaTile,
          tileStyle
         ]}
        >
         <BuklodCommunityMediaImage186M
           photo={photo}
           style={
            s.communityMediaImage
           }
          />
        </Pressable>
       );
      }
     )}
    </View>
   );
  };


 useEffect(
  ()=>{
   if(
    !commentOpen ||
    !commentPost?.id
   ){
    return;
   }

   const postId=
    String(
     commentPost.id
    );

   const channel=
    supabase
     .channel(
      `community-drawer:${postId}`
     )
     .on(
      'postgres_changes',
      {
       event:'*',
       schema:'public',
       table:'comments',
       filter:
        `post_id=eq.${postId}`
      },
      ()=>{
       void loadComments(
        postId
       );
      }
     )
     .on(
      'postgres_changes',
      {
       event:'*',
       schema:'public',
       table:
        'comment_reactions'
      },
      ()=>{
       void loadComments(
        postId
       );
      }
     )
     .subscribe();

   return ()=>{
    supabase
     .removeChannel(
      channel
     );
   };
  },
  [
   commentOpen,
   commentPost?.id,
   loadComments
  ]
 );



/* PATCH_186L_R3_PAGE_CONTROL */
const communityPageBusyRef186L=
  useRef(false);

const [
  communityHasMore186L,
  setCommunityHasMore186L
]=useState(true);

const loadMoreCommunity186L=
  useCallback(
    async()=>{
      if(
        communityPageBusyRef186L.current ||
        !communityHasMore186L
      ){
        return;
      }

      communityPageBusyRef186L.current=
        true;

      try{
        const count=
          await load({
            append:true,
            offset:posts.length,
            limit:40
          });

        if(
          Number(count)<0
        ){
          return;
        }

        if(
          Number(count)<40
        ){
          setCommunityHasMore186L(
            false
          );
        }
      }
      finally{
        communityPageBusyRef186L.current=
          false;
      }
    },
    [
      communityHasMore186L,
      load,
      posts.length
    ]
  );

const refreshCommunity186L=
  useCallback(
    async()=>{
      if(
        communityPageBusyRef186L.current
      ){
        return;
      }

      communityPageBusyRef186L.current=
        true;

      try{
        const count=
          await load({
            append:false,
            offset:0,
            limit:40
          });

        if(
          Number(count)>=0
        ){
          setCommunityHasMore186L(
            Number(count)>=40
          );
        }
      }
      finally{
        communityPageBusyRef186L.current=
          false;
      }
    },
    [load]
  );

const shareOutside=async(p:any)=>{const {data,error}=await (supabase as any).rpc('request_external_post_share_v2',{p_post_id:p.id});if(error)return Alert.alert('Share',error.message);
  const r=Array.isArray(data)?data[0]:data;if(r?.share_allowed)return Share.share({message:`${p.author_name}\n\n${p.body}\n\nShared from Community`});
  Alert.alert('Approval Requested','The poster was notified. Share outside BUKLOD becomes available after approval.')};


 if(!featureEnabled('community_feed'))return <FeatureUnavailable title="Community"/>;
 return <>
 <FlatList
 /* PERF2_PROGRESSIVE_FEED_LIST */
 onEndReachedThreshold={0.45}
  onEndReached={() => {
    void loadMoreCommunity186L();
  }}

      /* PERF1_FLATLIST_COMMUNITY */
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={60}
      windowSize={5}
       style={shared.screen} contentContainerStyle={s.content} data={
      buildBuklodCommunityFeedRows186K(
        posts,
      )
    } keyExtractor={i=>i.id} /* PATCH_186L_R3_PULL_REFRESH_PAGE_ZERO */
    refreshing={busy}
    onRefresh={refreshCommunity186L}
  ListHeaderComponent={<View>
   {/* PATCH_161A_COMMUNITY_COMPACT */}
   <Text style={s.eyebrow}>
    BUKLOD
   </Text>

   <View
    style={{
     flexDirection:'row',
     gap:7,
     marginBottom:10
    }}
   >
    <View
     style={{
      flex:1,
      minHeight:42,
      borderRadius:12,
      backgroundColor:colors.green,
      alignItems:'center',
      justifyContent:'center'
     }}
    >
     <Text
      style={{
       fontSize:11,
       fontWeight:'900',
       color:'#FFFFFF'
      }}
     >
      COMMUNITY
     </Text>
    </View>

    <Pressable
     onPress={() =>
      router.push(
       '/reels' as any
      )
     }
     style={{
      flex:1,
      minHeight:42,
      borderRadius:12,
      borderWidth:1,
      borderColor:colors.green,
      backgroundColor:colors.white,
      alignItems:'center',
      justifyContent:'center'
     }}
    >
     <Text
      style={{
       fontSize:11,
       fontWeight:'900',
       color:colors.greenDark
      }}
     >
      BUKLOD REELS
     </Text>
    </Pressable>
   </View>

   <Text style={shared.muted}>
    Encourage, connect and grow together.
   </Text>
      {/* PATCH_173H_R4_PUBLIC_LOCATION_CHIPS_MOUNT */}
      <BuklodPublicLocationChips
        selectedScopeId={
          publicLocationScopeId
        }
        onChange={
          setPublicLocationScopeId
        }
      />
    {/* PATCH_162A_SPONSOR_COMMUNITY */}
<BuklodCommunitySponsoredAd audience="public" />
   <SectionTitle>SHARE SOMETHING</SectionTitle><Card>
<TextInput multiline value={body} onChangeText={setBody} placeholder="Share with your Community..." style={s.area}/>
    {!!mentions.length&&<Text style={s.mentioned}>{mentions.map(x=>`@${x.full_name}`).join(' ')}</Text>}
    <View
      /* PATCH_154L_COMPOSER_SPACING */
      style={[
        s.row,
        {
          marginBottom: 14,
        },
      ]}
    ><Pressable style={s.tool} onPress={async()=>{setMentionOpen(true);setMentionSearch('');await searchMentions('')}}><MaterialCommunityIcons name="account-plus-outline" size={17} color={colors.green}/><Text style={s.toolText}>Mention</Text></Pressable>
    <Pressable style={s.tool} onPress={()=>{setWallVideo186O(null);void pickPhoto();}}><MaterialCommunityIcons name="image-plus" size={17} color={colors.green}/><Text style={s.toolText}>{photoBusy
 ? 'Preparing...'
 : photos.length
 ? `${photos.length}/5 Photos`
 : 'Add Photos'}</Text></Pressable>
    <Pressable
     style={s.tool}
     disabled={
      busy||
      videoBusy186O
     }
     onPress={()=>
      void pickWallVideo186O()
     }
    >
     <MaterialCommunityIcons
      name="video-outline"
      size={17}
      color={colors.green}
     />
     <Text style={s.toolText}>
      {videoBusy186O
       ? 'Preparing...'
       : wallVideo186O
        ? 'Video Ready'
        : 'Add Video'}
     </Text>
    </Pressable></View>
    
    {!!wallVideo186O&&(
     <View
      style={{
       marginBottom:10,
       minHeight:58,
       borderWidth:1,
       borderColor:colors.line,
       borderRadius:14,
       paddingHorizontal:12,
       paddingVertical:9,
       flexDirection:'row',
       alignItems:'center',
       gap:10,
       backgroundColor:colors.white
      }}
     >
      <MaterialCommunityIcons
       name="video-check-outline"
       size={26}
       color={colors.greenDark}
      />
      <View style={{flex:1}}>
       <Text
        style={{
         color:colors.text,
         fontWeight:'900',
         fontSize:11
        }}
       >
        Video ready
       </Text>
       <Text
        style={{
         color:colors.muted,
         marginTop:2,
         fontSize:9
        }}
       >
        {wallVideo186O.durationSeconds}s
        {' | '}
        {wallVideo186O.sizeBytes
         ? `${(
            wallVideo186O.sizeBytes/
            1024/
            1024
           ).toFixed(1)} MB`
         : 'size unavailable'}
       </Text>
      </View>
      <Pressable
       onPress={()=>
        setWallVideo186O(null)
       }
       hitSlop={8}
      >
       <MaterialCommunityIcons
        name="close-circle"
        size={22}
        color={colors.muted}
       />
      </Pressable>
     </View>
    )}
{!!photos.length&&(
     <View style={s.communityComposerPhotos}>
      {photos.map((photo,index)=>
       <View
        key={photo.uri}
        style={s.communityComposerPhoto}
       >
        <Image
         source={{uri:photo.uri}}
         style={s.communityComposerPhotoImage}
        />

        <Pressable
         onPress={()=>removePhoto(index)}
         style={s.communityComposerPhotoRemove}
        >
         <MaterialCommunityIcons
          name="close"
          size={16}
          color="#FFFFFF"
         />
        </Pressable>
       </View>
      )}
     </View>
    )}
    <Button
     title={
      busy
       ? 'POSTING...'
       : 'POST'
     }
     onPress={publish}
    />
   </Card>
   <SectionTitle>COMMUNITY POSTS</SectionTitle>
  </View>}
  ListEmptyComponent={<Card><Text style={shared.muted}>No Public posts yet.</Text></Card>}
  renderItem={({item})=>{
    if (
      item?.__buklodInlineAd186K
    ) {
      return (
        <BuklodCommunityInlineAd />
      );
    }

    const counts =
      item.reaction_counts ||
      {};

    const ms =
      Array.isArray(
        item.mentions,
      )
        ? item.mentions
        : [];

    return <Card>
   <View
     style={{
       flexDirection:
         'row',
       alignItems:
         'center',
       gap: 9,
     }}
   >
     

     
   {/* PATCH_185A_R2_COMMUNITY_AUTHOR_PROFILE_PHOTO */}
   <View
    style={{
     flexDirection:'row',
     alignItems:'center',
     gap:10,
     marginBottom:6
    }}
   >
    
    <View style={{flex:1}}>
     
   {/* PATCH_185A_R5_COMMUNITY_AUTHOR_PROFILE_PHOTO */}
   <View
    style={{
     flexDirection:'row',
     alignItems:'center',
     gap:10,
     marginBottom:6
    }}
   >
    <ProfileAvatar
     userId={item.user_id}
     name={item.author_name||'BUKLOD Member'}
     size={42}
    />
    <View style={{flex:1}}>
     <Text
       style={[
         s.author,
         {
           flex: 1,
         },
       ]}
     >
       {
         item.author_name ||
         'BUKLOD Member'
       }
     </Text>
    
       {/* PATCH_186I_R3_AUTHOR_META_UNDER_NAME */}
       <Text
         style={s.meta}
         numberOfLines={1}
       >
         {item.author_rank_name||'Circle Starter V'}
         {item.cluster_name
           ? ` | ${item.cluster_name}`
           : ''}
       </Text>
       <Text style={s.meta}>{String(
     item.audience ||
     'group'
    ).toUpperCase()}
    {' | '}
    {formatSpecificDateTime(
     item.created_at
    )}</Text>
</View>
   </View>
    </View>
   </View>
   </View>

   
   <Text style={s.body}>{/* UI_002_R9_R2_SHARED_BODY_CLEAN */
String(repairMojibakeText(item.body) ?? '').replace(
  /^Shared from [^\r\n]+(?:\r?\n\s*|$)+/i,
  ''
)}</Text>{!!ms.length&&<Text style={s.mentioned}>{ms.map((x:any)=>`@${x.full_name}`).join(' ')}</Text>}


{!!item.media_url &&
 String(item.media_mime_type||'').startsWith('video/') &&
 <View style={{marginTop:12,minHeight:150,borderRadius:14,backgroundColor:'#101A14',alignItems:'center',justifyContent:'center',padding:18}}>
  <Text style={{fontSize:34,color:'#FFFFFF'}}>{'\u25B6'}</Text>
  <Text style={{marginTop:8,fontSize:12,fontWeight:'900',color:'#FFFFFF'}}>BUKLOD REEL</Text>
  <Text style={{marginTop:4,fontSize:10,color:'#D6E4DA'}}>Tap this post to watch the video.</Text>
 </View>}

    {renderCommunityMedia(item)}

    {/* COMMUNITY_ICON_REACTIONS_20260811 */}
<View style={s.rx}>
 {RX.map(r=>{
  const count=Number(counts[r.key]??0);
  const active=item.my_reaction===r.key;

  return (
   <Pressable
    key={r.key}
    accessibilityRole="button"
    accessibilityLabel={`${r.label}${count ? `, ${count}` : ''}`}
    onPress={e=>{
     e.stopPropagation();
     void react(item.id,r.key);
    }}
    style={[
     s.rxBtn,
     active&&s.rxBtnActive
    ]}
   >
    <MaterialCommunityIcons
     name={r.icon}
     size={20}
     color={
      active
       ? colors.greenDark
       : colors.text
     }
    />

    {count>0&&(
     <Text
      style={[
       s.rxCount,
       active&&s.rxCountActive
      ]}
     >
      {count}
     </Text>
    )}
   </Pressable>
  );
 })}
</View>
   <View style={s.footer}><Pressable onPress={e=>{e.stopPropagation();openComments(item)}} style={s.footBtn}><MaterialCommunityIcons name="comment-outline" size={19} color={colors.greenDark}/><Text style={s.footText}>Comments {Number(item.comment_count??0)}</Text></Pressable>
   <BuklodPostInternalShare
          postId={item.id}
          compact
        /></View>
  </Card>}}/>
{/* PATCH_161H_PHOTO_VIEWER */}
 <Modal
  visible={viewerOpen}
  animationType="fade"
  onRequestClose={()=>
   setViewerOpen(false)
  }
 >
  <GestureHandlerRootView
   style={{flex:1}}
   unstable_forceActive
  >
   <View style={s.communityViewerScreen}>

   <FlatList
    key={
     'viewer-'+
     viewerIndex+
     '-'+
     viewerItems.length
    }
    data={viewerItems}
    keyExtractor={(item,index)=>
     String(
      item?.media_path||
      item?.media_url||
      index
     )
    }
    horizontal={false}
    pagingEnabled
    showsVerticalScrollIndicator={false}
    initialScrollIndex={
     Math.min(
      viewerIndex,
      Math.max(
       0,
       viewerItems.length-1
      )
     )
    }
    getItemLayout={(_data,index)=>({
     length:
      COMMUNITY_VIEWER_HEIGHT,
     offset:
      COMMUNITY_VIEWER_HEIGHT*
      index,
     index
    })}
    onMomentumScrollEnd={event=>{
     const nextIndex=
      Math.round(
       event.nativeEvent
        .contentOffset.y/
       COMMUNITY_VIEWER_HEIGHT
      );

     setViewerIndex(
      Math.max(
       0,
       Math.min(
        nextIndex,
        viewerItems.length-1
       )
      )
     );
    }}
    renderItem={({item})=>
     <View
      style={{
       height:
        COMMUNITY_VIEWER_HEIGHT,
       alignItems:'center',
       justifyContent:'center'
      }}
     >
      <CommunityZoomPhoto
       uri={item.media_url}
      />
     </View>
    }
   />

   <View style={s.communityViewerTop}>
    <Text style={s.communityViewerCount}>
     {viewerIndex+1} / {viewerItems.length}
    </Text>

    <Pressable
     onPress={()=>
      setViewerOpen(false)
     }
     style={s.communityViewerClose}
    >
     <MaterialCommunityIcons
      name="close"
      size={27}
      color="#FFFFFF"
     />
    </Pressable>
   </View>

   {renderViewerPhotoActions()}

   {viewerItems.length>1&&(
    <Text
     style={[
      s.communityViewerHint,
      {
       bottom:
        Math.max(
         communityInsets.bottom+145,
         Platform.OS==='android'
          ? 190
          : 155
        )
      }
     ]}
    >
     Swipe vertically for more photos
    </Text>
   )}

  </View>
 </GestureHandlerRootView>
 </Modal>


 {/* PATCH_161H_COMMENT_DRAWER */}
 <Modal
  visible={commentOpen}
  transparent
  animationType="slide"
  onRequestClose={closeComments}
 >
  <KeyboardAvoidingView
   style={{flex:1}}
   behavior={
    Platform.OS==='ios'
     ? 'padding'
     : 'height'
   }
   keyboardVerticalOffset={0}
  >
   <View style={s.communityCommentOverlay}>

    <Pressable
     style={{flex:1}}
     onPress={closeComments}
    />

    <View style={s.communityCommentDrawer}>

     <View style={s.communityDrawerHandle}/>

     <View style={s.communityCommentHeader}>
      <View style={{flex:1}}>
       <Text style={s.communityCommentTitle}>
        Comments
       </Text>

       {!!commentPost&&(
        <Text
         numberOfLines={1}
         style={s.communityCommentPostMeta}
        >
         {commentPost.author_name||
          'BUKLOD Member'}
         {' • '}
         {comments.length}
         {' '}
         {comments.length===1
          ? 'comment'
          : 'comments'}
        </Text>
       )}
      </View>

      <Pressable
       onPress={closeComments}
       style={s.communityDrawerClose}
      >
       <MaterialCommunityIcons
        name="close"
        size={22}
        color={colors.text}
       />
      </Pressable>
     </View>


     <ScrollView
      style={{flex:1}}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
       s.communityCommentList
      }
     >
      {!comments.length&&(
       <Text style={s.communityCommentEmpty}>
        No comments yet. Be the first to respond.
       </Text>
      )}

      {comments.map(c=>{
       const parent=
        c.parent_id
         ? comments.find(
            x=>
             String(x.id)===
             String(c.parent_id)
           )
         : null;

       const totalReactions=
        commentReactionTotal(c);

       return (
        <View
         key={c.id}
         style={[
          s.communityCommentItem,
          c.parent_id&&
           s.communityReplyItem
         ]}
        >

         <ProfileAvatar
          userId={c.user_id}
          name={
           c.commenter_name||
           'BUKLOD Member'
          }
          size={34}
         />

         <View style={{flex:1}}>

          <View style={s.communityCommentBubble}>
           <Text style={s.communityCommentName}>
            {c.commenter_name||
             'BUKLOD Member'}
           </Text>

           <Text style={s.communityCommentMeta}>
            {formatClusterName(
             c.cluster_name
            )}
            {' • '}
            {formatSpecificDateTime(
             c.created_at
            )}
           </Text>

           {!!parent&&(
            <Text style={s.communityReplyingTo}>
             Replying to{' '}
             {parent.commenter_name||
              'BUKLOD Member'}
            </Text>
           )}

           <Text style={s.communityCommentBody}>
            {c.body}
           </Text>
          </View>


          <View style={s.communityCommentActions}>

           <Pressable
            onPress={()=>
             setReplyTo(c)
            }
           >
            <Text style={s.communityCommentActionText}>
             Reply
            </Text>
           </Pressable>

           <Pressable
            onPress={()=>
             openCommentReaction(c)
            }
            style={s.communityCommentReactButton}
           >
            <MaterialCommunityIcons
             name={
              c.my_reaction
               ? (
                  RX.find(
                   r=>
                    r.key===
                    c.my_reaction
                  )?.icon??
                  'emoticon-outline'
                 )
               : 'emoticon-outline'
             }
             size={16}
             color={
              c.my_reaction
               ? colors.greenDark
               : colors.muted
             }
            />

            <Text
             style={[
              s.communityCommentActionText,
              c.my_reaction&&
               s.communityCommentActionActive
             ]}
            >
             {c.my_reaction
              ? reactionLabel(
                 c.my_reaction
                )
              : 'React'}
             {totalReactions>0
              ? ` · ${totalReactions}`
              : ''}
            </Text>
           </Pressable>

          </View>

         </View>
        </View>
       );
      })}
     </ScrollView>


     {!!replyTo&&(
      <View style={s.communityReplyBanner}>
       <View style={{flex:1}}>
        <Text style={s.communityReplyBannerLabel}>
         Replying to
        </Text>

        <Text style={s.communityReplyBannerName}>
         {replyTo.commenter_name||
          'BUKLOD Member'}
        </Text>
       </View>

       <Pressable
        onPress={()=>
         setReplyTo(null)
        }
       >
        <MaterialCommunityIcons
         name="close"
         size={20}
         color={colors.greenDark}
        />
       </Pressable>
      </View>
     )}


     <View
      style={[
       s.communityCommentComposer,
       {
        paddingBottom:
         Math.max(
          communityInsets.bottom,
          10
         )
       }
      ]}
     >

      <TextInput
       value={commentText}
       onChangeText={setCommentText}
       multiline
       placeholder={
        replyTo
         ? 'Write a reply...'
         : 'Write a comment...'
       }
       style={s.communityCommentInput}
      />

      <Pressable
       disabled={
        commentBusy||
        !commentText.trim()
       }
       onPress={()=>
        void submitCommunityComment()
       }
       style={[
        s.communityCommentSend,
        (
         commentBusy||
         !commentText.trim()
        )&&{
         opacity:.4
        }
       ]}
      >
       <MaterialCommunityIcons
        name="send"
        size={20}
        color="#FFFFFF"
       />
      </Pressable>

     </View>

    </View>
   </View>
  </KeyboardAvoidingView>
 </Modal>


 {/* PATCH_161H_COMMENT_REACTION_PICKER */}
 <Modal
  visible={commentReactionOpen}
  transparent
  animationType="fade"
  onRequestClose={()=>{
   setCommentReactionOpen(false);
   setCommentReactionTarget(null);
  }}
 >
  <View style={s.communityReactionOverlay}>
   <Pressable
    style={{flex:1}}
    onPress={()=>{
     setCommentReactionOpen(false);
     setCommentReactionTarget(null);
    }}
   />

   <View style={s.communityReactionPicker}>
    {RX.map(item=>
     <Pressable
      key={item.key}
      onPress={()=>
       void reactToComment(
        item.key
       )
      }
      style={[
       s.communityReactionChoice,
       commentReactionTarget
        ?.my_reaction===
        item.key &&
        s.communityReactionChoiceActive
      ]}
     >
      <MaterialCommunityIcons
       name={item.icon}
       size={22}
       color={colors.greenDark}
      />

      <Text style={s.communityReactionChoiceText}>
       {item.label}
      </Text>
     </Pressable>
    )}
   </View>
  </View>
 </Modal>


 <Modal visible={mentionOpen} transparent animationType="slide" onRequestClose={()=>setMentionOpen(false)}><View style={s.overlay}><Pressable style={{flex:1}} onPress={()=>setMentionOpen(false)}/><View style={s.drawer}><Text style={s.drawerTitle}>Mention Members</Text>
  <TextInput style={s.search} placeholder="Search member..." value={mentionSearch} onChangeText={v=>{setMentionSearch(v);void searchMentions(v)}}/>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:7,paddingVertical:10}}>{mentionRows.map(m=>{const on=mentions.some(x=>x.user_id===m.user_id);return <Pressable key={m.user_id} onPress={()=>toggleMention(m)} style={[s.member,on&&s.memberOn]}><View style={{flex:1}}><Text style={s.memberName}>{m.full_name}</Text><Text style={s.memberMeta}>{m.church_name}{m.group_name?` | ${m.group_name}`:''}</Text></View>{on&&<MaterialCommunityIcons name="check-circle" size={21} color={colors.green}/>}</Pressable>})}</ScrollView>
  <Button title={`DONE (${mentions.length})`} onPress={()=>setMentionOpen(false)}/></View></View></Modal>
 
     {/* PATCH_186B_PHOTO_EDITOR_PUBLIC_MODAL */}
     <BuklodPhotoEditor
      visible={!!communityPhotoEditor}
      sourceUri={communityPhotoEditor?.uri ?? null}
      onCancel={() =>
       setCommunityPhotoEditor(null)
      }
      onDone={edited => {
       setPhotos(current =>
        current.length>=5
         ? current
         : [
            ...current,
            {
             uri:edited.uri,
             base64:edited.base64,
             sizeBytes:edited.sizeBytes
            }
           ].slice(0,5)
       );

       setCommunityPhotoEditor(null);
      }}
     />
</>;
}

const s=StyleSheet.create({
content:{
 paddingHorizontal:0,
 paddingTop:8,
 paddingBottom:50
},eyebrow:{fontSize:10,fontWeight:'900',color:colors.greenDark,letterSpacing:.8},label:{fontSize:10,fontWeight:'900',color:colors.muted,marginBottom:7},
wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},

audienceRow:{
 flexDirection:'row',
 gap:6
},

categoryRow:{
 flexDirection:'row',
 gap:5
},

compactChip:{
 minHeight:34,
 paddingVertical:7,
 paddingHorizontal:7,
 borderRadius:18,
 borderWidth:1,
 borderColor:colors.line,
 backgroundColor:colors.white,
 alignItems:'center',
 justifyContent:'center'
},

audienceChip:{
 flex:1
},

categoryChip:{
 flex:1
},

compactChipText:{
 fontSize:9,
 fontWeight:'900',
 color:colors.text
},

chip:{
 paddingVertical:8,
 paddingHorizontal:10,
 borderRadius:20,
 borderWidth:1,
 borderColor:colors.line,
 backgroundColor:colors.white
},

chipOn:{
 borderColor:colors.green,
 backgroundColor:colors.greenSoft
},

chipText:{
 fontSize:10,
 fontWeight:'900',
 color:colors.text
},

audienceHelp:{
 marginTop:5,
 fontSize:9,
 lineHeight:13,
 color:colors.muted
},

typeLabel:{
 marginTop:9,
 marginBottom:6,
 fontSize:9,
 fontWeight:'900',
 color:colors.muted
},
area:{
 minHeight:52,
 maxHeight:120,
 marginTop:9,
 paddingHorizontal:11,
 paddingVertical:9,
 borderWidth:1,
 borderColor:colors.line,
 borderRadius:11,
 textAlignVertical:'top',
 backgroundColor:colors.white,
 fontSize:13
},

mentioned:{
 marginTop:6,
 fontSize:10,
 fontWeight:'800',
 color:colors.greenDark
},
row:{
 flexDirection:'row',
 gap:7,
 marginTop:7
},

tool:{
 flex:1,
 minHeight:34,
 paddingVertical:6,
 borderWidth:1,
 borderColor:colors.line,
 borderRadius:10,
 alignItems:'center',
 justifyContent:'center',
 flexDirection:'row',
 gap:4
},

toolText:{
 fontSize:9.5,
 fontWeight:'900',
 color:colors.greenDark
},
preview:{width:'100%',height:210,borderRadius:12,marginTop:10,marginBottom:8},filter:{gap:7,paddingBottom:4},rank:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:9,marginTop:9,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},rankNo:{width:30,fontWeight:'900',color:colors.greenDark},rankName:{flex:1,fontWeight:'900',color:colors.text},rankPts:{fontSize:11,fontWeight:'900',color:colors.greenDark},
author:{fontSize:15,fontWeight:'900',color:colors.text},meta:{marginTop:3,fontSize:9.5,color:colors.muted},body:{marginTop:10,fontSize:14,lineHeight:21,color:colors.text},postImage:{width:'100%',height:240,borderRadius:12,marginTop:10},
rx:{
 flexDirection:'row',
 alignItems:'center',
 justifyContent:'space-between',
 gap:5,
 marginTop:10
},

rxBtn:{
 flex:1,
 minWidth:0,
 height:36,
 borderRadius:18,
 flexDirection:'row',
 alignItems:'center',
 justifyContent:'center',
 gap:3,
 backgroundColor:'#F4F6F4',
 borderWidth:1,
 borderColor:'transparent'
},

rxBtnActive:{
 backgroundColor:colors.greenSoft,
 borderColor:colors.green
},

rxCount:{
 fontSize:8.5,
 fontWeight:'900',
 color:colors.muted
},

rxCountActive:{
 color:colors.greenDark
},
footer:{marginTop:10,paddingTop:9,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line,flexDirection:'row',gap:8},footBtn:{flex:1,minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:10,backgroundColor:'#F7F7F7'},footText:{fontSize:10.5,fontWeight:'900',color:colors.greenDark},
overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.35)'},drawer:{minHeight:'58%',maxHeight:'82%',padding:18,paddingBottom:24,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:colors.background},drawerTitle:{fontSize:20,fontWeight:'900',color:colors.text,marginBottom:10},search:{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,backgroundColor:colors.white},
member:{minHeight:57,padding:11,borderWidth:1,borderColor:colors.line,borderRadius:12,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:colors.white},memberOn:{borderColor:colors.green,backgroundColor:colors.greenSoft},memberName:{fontSize:13,fontWeight:'900',color:colors.text},memberMeta:{marginTop:3,fontSize:9.5,color:colors.muted}
,

 communityComposerPhotos:{
  marginTop:10,
  marginBottom:8,
  flexDirection:'row',
  flexWrap:'wrap',
  gap:5
 },

 communityComposerPhoto:{
  width:'31.8%',
  height:92,
  position:'relative',
  backgroundColor:'#E8ECE9'
 },

 communityComposerPhotoImage:{
  width:'100%',
  height:'100%'
 },

 communityComposerPhotoRemove:{
  position:'absolute',
  top:4,
  right:4,
  width:26,
  height:26,
  alignItems:'center',
  justifyContent:'center',
  borderRadius:13,
  backgroundColor:'rgba(0,0,0,.68)'
 },


 communityMediaGrid:{
  marginTop:10,
  marginHorizontal:-12,
  flexDirection:'row',
  flexWrap:'wrap',
  gap:2,
  overflow:'hidden',
  backgroundColor:'#E7EBE8'
 },

 communityMediaTile:{
  overflow:'hidden',
  backgroundColor:'#DDE4DF'
 },

 communityMediaOne:{
  width:'100%',
  height:310
 },

 communityMediaHalfTall:{
  width:'49.7%',
  height:250
 },

 communityMediaWide:{
  width:'100%',
  height:210
 },

 communityMediaHalf:{
  width:'49.7%',
  height:165
 },

 communityMediaHalfSmall:{
  width:'49.7%',
  height:140
 },

 communityMediaImage:{
  width:'100%',
  height:'100%'
 },


 communityViewerScreen:{
  flex:1,
  backgroundColor:'#000000'
 },

 communityViewerImage:{
  width:'100%',
  height:'100%'
 },

 communityViewerTop:{
  position:'absolute',
  top:0,
  left:0,
  right:0,
  paddingTop:44,
  paddingHorizontal:16,
  flexDirection:'row',
  alignItems:'center',
  justifyContent:'space-between'
 },

 communityViewerCount:{
  color:'#FFFFFF',
  fontSize:13,
  fontWeight:'900',
  textShadowColor:'rgba(0,0,0,.7)',
  textShadowRadius:4
 },

 communityViewerClose:{
  width:42,
  height:42,
  borderRadius:21,
  backgroundColor:'rgba(0,0,0,.55)',
  alignItems:'center',
  justifyContent:'center'
 },

 communityViewerHint:{
  position:'absolute',
  bottom:132,
  alignSelf:'center',
  paddingHorizontal:12,
  paddingVertical:7,
  borderRadius:16,
  backgroundColor:'rgba(0,0,0,.58)',
  color:'#FFFFFF',
  fontSize:10,
  fontWeight:'800'
 },


 communityCommentOverlay:{
  flex:1,
  justifyContent:'flex-end',
  backgroundColor:'rgba(0,0,0,.30)'
 },

 communityCommentDrawer:{
  maxHeight:'88%',
  height:'82%',
  backgroundColor:colors.background,
  borderTopLeftRadius:18,
  borderTopRightRadius:18,
  overflow:'hidden'
 },

 communityDrawerHandle:{
  width:42,
  height:4,
  marginTop:8,
  marginBottom:6,
  borderRadius:2,
  alignSelf:'center',
  backgroundColor:'#BAC4BD'
 },

 communityCommentHeader:{
  minHeight:58,
  paddingHorizontal:13,
  paddingBottom:9,
  flexDirection:'row',
  alignItems:'center',
  borderBottomWidth:
   StyleSheet.hairlineWidth,
  borderBottomColor:
   colors.line,
  backgroundColor:
   colors.white
 },

 communityCommentTitle:{
  fontSize:17,
  fontWeight:'900',
  color:colors.text
 },

 communityCommentPostMeta:{
  marginTop:2,
  fontSize:9.5,
  color:colors.muted
 },

 communityDrawerClose:{
  width:38,
  height:38,
  alignItems:'center',
  justifyContent:'center'
 },

 communityCommentList:{
  paddingHorizontal:10,
  paddingTop:10,
  paddingBottom:18,
  gap:8
 },

 communityCommentEmpty:{
  paddingVertical:32,
  textAlign:'center',
  fontSize:11,
  color:colors.muted
 },

 communityCommentItem:{
  flexDirection:'row',
  alignItems:'flex-start',
  gap:7
 },

 communityReplyItem:{
  marginLeft:22
 },

 communityCommentBubble:{
  paddingHorizontal:10,
  paddingVertical:8,
  backgroundColor:'#F0F3F1',
  borderRadius:10
 },

 communityCommentName:{
  fontSize:11,
  fontWeight:'900',
  color:colors.text
 },

 communityCommentMeta:{
  marginTop:1,
  fontSize:8.5,
  color:colors.muted
 },

 communityReplyingTo:{
  marginTop:5,
  fontSize:9,
  fontWeight:'800',
  color:colors.greenDark
 },

 communityCommentBody:{
  marginTop:4,
  fontSize:12.5,
  lineHeight:18,
  color:colors.text
 },

 communityCommentActions:{
  marginTop:3,
  paddingLeft:5,
  flexDirection:'row',
  alignItems:'center',
  gap:14
 },

 communityCommentReactButton:{
  flexDirection:'row',
  alignItems:'center',
  gap:3
 },

 communityCommentActionText:{
  fontSize:9.5,
  fontWeight:'800',
  color:colors.muted
 },

 communityCommentActionActive:{
  color:colors.greenDark
 },

 communityReplyBanner:{
  paddingHorizontal:12,
  paddingVertical:7,
  flexDirection:'row',
  alignItems:'center',
  borderTopWidth:
   StyleSheet.hairlineWidth,
  borderTopColor:
   colors.line,
  backgroundColor:'#EDF5EF'
 },

 communityReplyBannerLabel:{
  fontSize:8,
  color:colors.muted
 },

 communityReplyBannerName:{
  marginTop:1,
  fontSize:10,
  fontWeight:'900',
  color:colors.greenDark
 },

 communityCommentComposer:{
  minHeight:62,
  paddingHorizontal:9,
  paddingTop:7,
  paddingBottom:10,
  flexDirection:'row',
  alignItems:'flex-end',
  gap:7,
  borderTopWidth:
   StyleSheet.hairlineWidth,
  borderTopColor:
   colors.line,
  backgroundColor:
   colors.white
 },

 communityCommentInput:{
  flex:1,
  minHeight:42,
  maxHeight:105,
  paddingHorizontal:10,
  paddingVertical:8,
  borderWidth:1,
  borderColor:colors.line,
  borderRadius:12,
  textAlignVertical:'top',
  backgroundColor:
   colors.background
 },

 communityCommentSend:{
  width:42,
  height:42,
  borderRadius:21,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:
   colors.green
 },


 communityReactionOverlay:{
  flex:1,
  justifyContent:'flex-end',
  backgroundColor:
   'rgba(0,0,0,.20)'
 },

 communityReactionPicker:{
  marginBottom:24,
  padding:8,
  flexDirection:'row',
  justifyContent:'space-between',
  gap:3,
  borderRadius:18,
  backgroundColor:
   colors.white,
  borderWidth:1,
  borderColor:
   colors.line
 },

 communityReactionChoice:{
  flex:1,
  minHeight:57,
  alignItems:'center',
  justifyContent:'center',
  gap:3,
  borderRadius:12
 },

 communityReactionChoiceActive:{
  backgroundColor:
   colors.greenSoft
 },

 communityReactionChoiceText:{
  fontSize:7.5,
  fontWeight:'800',
  textAlign:'center',
  color:colors.text
 }
,

 communityViewerActions:{
  position:'absolute',
  left:8,
  right:8,
  bottom:0,
  paddingHorizontal:8,
  paddingVertical:8,
  borderRadius:16,
  backgroundColor:'rgba(0,0,0,.60)'
 },

 communityViewerActionTitle:{
  marginBottom:6,
  paddingLeft:3,
  color:'#FFFFFF',
  fontSize:9,
  fontWeight:'800'
 },

 communityViewerReactionRow:{
  flexDirection:'row',
  alignItems:'center',
  gap:4
 },

 communityViewerReactionButton:{
  flex:1,
  minWidth:35,
  height:40,
  borderRadius:20,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'rgba(255,255,255,.14)'
 },

 communityViewerReactionButtonActive:{
  backgroundColor:colors.green
 },

 communityViewerReactionCount:{
  position:'absolute',
  top:1,
  right:3,
  minWidth:15,
  height:15,
  paddingHorizontal:3,
  borderRadius:8,
  overflow:'hidden',
  textAlign:'center',
  color:'#FFFFFF',
  backgroundColor:colors.greenDark,
  fontSize:8,
  fontWeight:'900'
 },

 communityViewerSaveButton:{
  minWidth:52,
  height:40,
  paddingHorizontal:6,
  borderRadius:20,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'rgba(255,255,255,.16)'
 },

 communityViewerSaveText:{
  marginTop:1,
  color:'#FFFFFF',
  fontSize:7.5,
  fontWeight:'800'
 },

 communityViewerReactionSummary:{
  marginTop:5,
  paddingLeft:3,
  color:'#E7EFEA',
  fontSize:8.5
 }
});

