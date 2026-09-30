/* BUKLOD_ROOT_PERFORMANCE_R3_COMMUNITY_REALTIME: existing broadcast implementation preserved */
/* PERF_EMERGENCY_R2_VISIBLE_POSTS: list-shape-drift-safely-skipped */
/* PERF_EMERGENCY_R2_MULTI_MEDIA_CACHE: existing-community-media-url-cache-preserved */
/* PERF_EMERGENCY_R2_POSTS_ONLY_REALTIME: existing Broadcast optimization preserved */
/* PERF_EMERGENCY_R2_STALE_LOAD: existing PATCH_166H guard preserved */
/* BUKLOD_SHARE_TARGET_187A */
import {
  useEffect as useIncomingShareEffect187A,
  useRef as useIncomingShareRef187A,
} from 'react';
import * as IncomingShareImageManipulator187A from 'expo-image-manipulator';
import {
  createVideoPlayer as createIncomingShareVideoPlayer187A,
} from 'expo-video';
import { useIncomingShare as useBuklodIncomingShare187A } from '@/lib/buklodIncomingShare';
import { uploadCommunityVideoFile, uploadCommunityPhotoFile, uploadCommunityGifFile, mapWithConcurrency } from '@/lib/uploadCommunityVideoFile';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';
import {
  attachCommunityPostMedia,
  discardIncompleteCommunityPost,
  extractCreatedRecordId,
} from '@/lib/buklodCommunityPostMedia';
import { enqueueCommunityPublish } from '@/lib/buklodCommunityPublishQueue';
import {
  BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS,
  BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE,
  formatVideoBytes,
  isReelMediaPath,
  readVideoDurationSeconds,
  readVideoSizeBytes,
  validateCommunityVideoUpload,
} from '@/lib/buklodCommunityWallMedia';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';
import { CommunityVideo } from '@/components/CommunityVideo';
import {
  BuklodCommunityPhotoCollage,
  communityPhotoCollageItems,
} from '@/components/BuklodCommunityPhotoCollage';
import { peekCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';
import {
  buildCommunityFeedWithInlineAds,
  isCommunityFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';
import { useBuklodCommunityAdViewability } from '@/hooks/useBuklodCommunityAdViewability';
/* PATCH_186H_SINGLE_COMMUNITY_AUTHOR_AVATAR */
/* PATCH_179D_FIX_COMMUNITY_IMAGE_STABLE_CACHE */
import BuklodPublicLocationChips from '@/components/BuklodPublicLocationChips';
import BuklodMaritesBoard from '@/components/BuklodMaritesBoard';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import BuklodCommunitySponsoredAd from '@/components/BuklodCommunitySponsoredAd';
import BuklodCommunityIgpatStrip from '@/components/BuklodCommunityIgpatStrip';
import BuklodCommunityContributionCard from '@/components/BuklodCommunityContributionCard';
import { BuklodCommunityGifPicker, BuklodCommunityGifPreview, type BuklodCommunityGifFile } from '@/components/BuklodCommunityGifPicker';
/* PATCH_160_COMMUNITY_AVATARS_TIME */
import { formatSpecificDateTime } from '@/lib/dateTime';
import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
import BuklodTappablePersonName from '@/components/BuklodTappablePersonName';
import {
  BuklodReactionAction,
  BUKLOD_PUBLIC_COMMUNITY_REACTIONS,
} from '@/components/BuklodReactionAction';
import {
  BuklodCommunityPostEngagement,
} from '@/components/BuklodCommunityPostEngagement';
import {
  BuklodCommunityReactionDetailsSheet,
} from '@/components/BuklodCommunityReactionDetailsSheet';
import {
  fetchBuklodPostCommentPreviews,
  type BuklodPostCommentPreview,
} from '@/lib/buklodPostCommentPreviews';
import {
  communityFeedCacheKey,
  keepStableCommunityMedia,
  readOfflineCache,
  readOfflineCacheSync,
  writeOfflineCache,
} from '@/lib/buklodOfflineSync';
import { SCALE_LIMITS } from '@/lib/performanceScale';
import {
  hydratePersonNamesOnRows,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import {
  BuklodCommunityCommentBubble,
} from '@/components/BuklodCommunityCommentBubble';
import {
  type BuklodCommunityReactionKey,
  type CommunityReactionDetailsTarget,
  sumCommunityReactionCounts,
} from '@/lib/buklodCommunityReactions';
import {
  useCallback,
 useEffect,
 useState,
 useRef,
 useMemo,
 } from 'react';
import {ActivityIndicator,
 Alert,
 FlatList,
 Image,
 Modal,
 Pressable,
 ScrollView,
 StyleSheet,
 Text,
 TextInput,
 View,
 Dimensions,
 KeyboardAvoidingView,
 Platform} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {Redirect,router} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {
  useSafeAreaInsets
} from 'react-native-safe-area-context';

import {
 GestureHandlerRootView,
 FlatList as GestureFlatList,
} from 'react-native-gesture-handler';
import {supabase} from '@/lib/supabase';
import { acquireSharedRealtimeSubscription } from '@/lib/performance';
import {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS
import {Button,Card,SectionTitle} from '@/components/UI';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {useBuklodPresentation} from '@/hooks/useBuklodPresentation';
import {useNetwork} from '@/providers/NetworkProvider';
import {createCommunityStyles} from '@/app/(tabs)/buklodCommunityStyles';
import {
  useBuklodScrollBottomInset,
  useBuklodDrawerBottomInset,
} from '@/lib/buklodSafeArea';
import {
  FLATLIST_TUNING,
  FLASHLIST_ESTIMATES,
} from '@/lib/performanceInstrumentation';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {FeatureUnavailable} from '@/components/FeatureUnavailable';
import {
  BuklodFocusFadeUp,
  BuklodFocusVisibleRow,
} from '@/components/HomeMotion';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';




import BuklodPostInternalShare
  from '@/components/BuklodPostInternalShare';
import { BuklodPhotoEditor, type BuklodPhotoEditorTool } from '@/components/BuklodPhotoEditor';
import { BuklodComposerPhotoEditSheet } from '@/components/BuklodComposerPhotoEditSheet';
import {
  deleteCommunityPost,
  setCommunityPostAuthorOnly,
  saveCommunityPostEdit,
  communityPostEditPhotos,
  communityPostIsVideo,
} from '@/lib/buklodCommunityPostOwnerActions';
import {
  BuklodContentOverflowMenu,
} from '@/components/BuklodContentOverflowMenu';
import {
  useBuklodContentReport,
} from '@/components/BuklodContentReportSheet';
import BuklodMentionText from '@/components/BuklodMentionText';
import {
  BuklodZoomablePhoto,
} from '@/components/BuklodZoomablePhoto';
import {
  isMaritesCommunityPost,
} from '@/lib/buklodMaritesBoard';
/* PATCH_186B_PHOTO_EDITOR_IMPORT */
/* PATCH_166H_REALTIME_DEBOUNCE_IS_EFFECT_LOCAL */
const CATEGORIES=['reflection','testimony','encouragement'] as const;
type Audience='group'|'local'|'public';
type FeedMode='for_you'|'following'|'latest';
type Reaction = BuklodCommunityReactionKey;
type Photo={
 id:string;
 uri:string;
 base64?:string;
 sizeBytes?:number;
};
type Mention={user_id:string;full_name:string;church_name:string;group_name:string};

function activeMentionQuery(value:string){
 const match=String(value??'').match(/(?:^|\s)@([^@\n\r\t ]*)$/);
 return match ? match[1] : null;
}

function insertSelectedMention(value:string,name:string){
 const safe=String(name??'').trim();
 if(!safe) return value;
 return String(value??'').replace(
  /(^|\s)@[^@\n\r\t ]*$/,
  (_match,prefix)=>`${prefix}@${safe} `
 );
}

let PERF2_MENTION_SEARCH_SEQ = 0;

/* PERF2_MENTION_SEARCH_DEBOUNCE */

// PATCH_161H_C_PHOTO_VIEWER_PLUS

function CommunityZoomPhoto({
 uri,
 mediaPath,
 active,
 onZoomedChange,
}:{
 uri?:string | null;
 mediaPath?:string | null;
 active?:boolean;
 onZoomedChange?:(zoomed:boolean)=>void;
}){
 return (
  <BuklodZoomablePhoto
   uri={String(uri ?? '')}
   mediaPath={mediaPath}
   active={active}
   onZoomedChange={onZoomedChange}
  />
 );
}


const COMMUNITY_VIEWER_HEIGHT=
 Dimensions.get('window').height;

export default function BuklodScreen(){
 const {
  activeScope,
  loading:scopeLoading,
  error:scopeError
 }=useBuklodScope();
 const {
  colors,
  shared,
  paletteId,
 }=useBuklodPresentation();

 if(scopeLoading && !activeScope){
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

 const {
  colors,
  shared,
  paletteId,
 }=useBuklodPresentation();
 const {
  openReport,
  reportSheet,
 } = useBuklodContentReport();
 const scrollBottomInset=
  useBuklodScrollBottomInset({
   extra:10,
  });
 const drawerBottomInset=
  useBuklodDrawerBottomInset();
 const s=useMemo(
  ()=>{
   const base=
    createCommunityStyles(colors);

   return {
    ...base,
    content:{
     ...base.content,
     paddingBottom:
      scrollBottomInset,
    },
   };
  },
  [paletteId, colors, scrollBottomInset]
 );

 const communityInsets=
  useSafeAreaInsets();

 /* PERF2_PROGRESSIVE_FEED */
 const communityMediaUrlCacheRef=
  useRef<Record<string,{url:string;at:number}>>({});

 const {featureEnabled}=useRuntimeConfig(); const {user,profile}=useAuth();
 const {isConnected,isInternetReachable}=useNetwork();
 const communityOnline=
  isConnected && isInternetReachable!==false;
 const communityOnlineRef=useRef(communityOnline);
 communityOnlineRef.current=communityOnline;

  const incomingShare187A = useBuklodIncomingShare187A();
  const incomingShareSignature187A = useIncomingShareRef187A('');

  async function readIncomingVideoDuration187A(
    uri: string
  ): Promise<number> {
    const player = createIncomingShareVideoPlayer187A(null);

    return await new Promise<number>((resolve, reject) => {
      let finished = false;
      let sourceSubscription: any = null;
      let statusSubscription: any = null;
      let timer: any = null;

      const finish = (
        error: Error | null,
        duration = 0
      ) => {
        if (finished) return;
        finished = true;

        try {
          sourceSubscription?.remove?.();
        } catch {}
        try {
          statusSubscription?.remove?.();
        } catch {}
        if (timer) clearTimeout(timer);
        try {
          player.release();
        } catch {}

        if (error) reject(error);
        else resolve(duration);
      };

      sourceSubscription = player.addListener(
        'sourceLoad',
        (event: any) => {
          const duration = Number(
            event?.duration ?? player.duration ?? 0
          );

          if (duration > 0) {
            finish(null, duration);
          }
          else {
            finish(
              new Error(
                'Could not read the shared video duration.'
              )
            );
          }
        }
      );

      statusSubscription = player.addListener(
        'statusChange',
        (event: any) => {
          if (event?.status === 'error') {
            finish(
              new Error(
                String(
                  event?.error?.message ??
                    'Could not open the shared video.'
                )
              )
            );
          }
        }
      );

      timer = setTimeout(() => {
        finish(
          new Error(
            'BUKLOD could not inspect the shared video.'
          )
        );
      }, 15000);

      void player
        .replaceAsync(uri)
        .catch((error: any) => {
          finish(
            new Error(
              String(
                error?.message ??
                  'Could not open the shared video.'
              )
            )
          );
        });
    });
  }

  useIncomingShareEffect187A(() => {
    if (incomingShare187A.isResolving) {
      return;
    }

    const raw: any[] =
      incomingShare187A.sharedPayloads ?? [];
    const resolved: any[] =
      incomingShare187A.resolvedSharedPayloads ?? [];

    if (!raw.length && !resolved.length) {
      return;
    }

    const signature = JSON.stringify({
      raw: raw.map((row: any) => [
        row?.shareType,
        row?.value,
        row?.mimeType,
      ]),
      resolved: resolved.map((row: any) => [
        row?.contentType,
        row?.contentUri,
        row?.contentMimeType,
        row?.contentSize,
      ]),
    });

    if (
      !signature ||
      incomingShareSignature187A.current === signature
    ) {
      return;
    }

    incomingShareSignature187A.current = signature;

    void (async () => {
      try {
        const sharedText = raw
          .filter(
            (row: any) =>
              row?.shareType === 'text' ||
              row?.shareType === 'url'
          )
          .map((row: any) =>
            String(row?.value ?? '').trim()
          )
          .filter(Boolean);

        const normalized = resolved.length
          ? resolved
          : raw.map((row: any) => ({
              contentType: row?.shareType,
              contentUri: row?.value,
              contentMimeType: row?.mimeType,
              contentSize: null,
              originalName: null,
            }));

        const gifRows = normalized.filter(
          (row: any) =>
            row?.contentType === 'image' &&
            String(row?.contentMimeType ?? '').toLowerCase() === 'image/gif' &&
            typeof row?.contentUri === 'string' &&
            row.contentUri.length > 0
        );

        const imageRows = normalized.filter(
          (row: any) =>
            row?.contentType === 'image' &&
            String(row?.contentMimeType ?? '').toLowerCase() !== 'image/gif' &&
            typeof row?.contentUri === 'string' &&
            row.contentUri.length > 0
        );

        const videoRows = normalized.filter(
          (row: any) =>
            row?.contentType === 'video' &&
            typeof row?.contentUri === 'string' &&
            row.contentUri.length > 0
        );

        if (
          !sharedText.length &&
          !imageRows.length &&
          !gifRows.length &&
          !videoRows.length
        ) {
          throw new Error(
            'This shared item type is not supported by BUKLOD yet.'
          );
        }

        if (gifRows.length) {
          incomingShare187A.clearSharedPayloads();
          Alert.alert(
            'Community',
            'Community accepts text and still photos only. GIF posting is not available.'
          );
          return;
        }

        if (videoRows.length) {
          incomingShare187A.clearSharedPayloads();
          Alert.alert(
            'BUKLOD IGPAT',
            'Videos belong in BUKLOD IGPAT. Opening the IGPAT creator.'
          );
          router.push('/igpat/create' as any);
          return;
        }

        if (sharedText.length) {
          setBody((current: string) =>
            [current.trim(), ...sharedText]
              .filter(Boolean)
              .join('\n\n')
          );
        }

        if (imageRows.length) {
          setWallVideo186O(null);

          const prepared: any[] = [];

          for (const row of imageRows) {
            const context =
              IncomingShareImageManipulator187A.ImageManipulator.manipulate(
                row.contentUri
              );

            const rendered = await context.renderAsync();
            const saved = await rendered.saveAsync({
              format: IncomingShareImageManipulator187A.SaveFormat.JPEG,
              compress: 0.86,
              base64: true,
            });

            if (!saved.base64) {
              throw new Error(
                'Could not prepare one of the shared photos.'
              );
            }

            prepared.push({
              uri: saved.uri,
              base64: saved.base64,
              sizeBytes: Math.ceil(
                saved.base64.length * 0.75
              ),
            });
          }

          setPhotos(prepared);
        }

        if (videoRows.length === 1) {
          const video = videoRows[0];
          const durationSeconds =
            await readIncomingVideoDuration187A(
              video.contentUri
            );

          setPhotos([]);

          const accepted = await acceptWallVideo186O({
            uri: video.contentUri,
            duration: durationSeconds * 1000,
            fileSize:
              Number(video.contentSize ?? 0) || undefined,
            mimeType:
              video.contentMimeType || 'video/mp4',
            fileName:
              video.originalName || 'shared-video.mp4',
            type: 'video',
          });

          if (!accepted) {
            throw new Error(
              'The shared video did not pass BUKLOD Community validation.'
            );
          }
        }

        incomingShare187A.clearSharedPayloads();

        Alert.alert(
          'Share to BUKLOD',
          'Ready in Public Community. Review the shared item, then tap POST PUBLIC.'
        );
      }
      catch (error: any) {
        Alert.alert(
          'Share to BUKLOD',
          String(
            error?.message ??
              'Could not import the shared item.'
          )
        );
      }
    })();
  }, [
    incomingShare187A.isResolving,
    incomingShare187A.sharedPayloads,
    incomingShare187A.resolvedSharedPayloads,
  ]);

 const [feedMode,setFeedMode]=useState<FeedMode>('for_you');
 const [
  publicLocationScopeId,
  setPublicLocationScopeId,
 ] = useState<string | null>(null);
 const initialPublicCommunityCacheKey=
  user
   ? `${communityFeedCacheKey(
       user.id,
       null
      )}:for_you`
   : null;
 const [posts,setPosts]=useState<any[]>(
  ()=>
   initialPublicCommunityCacheKey
    ? readOfflineCacheSync<any[]>(
       initialPublicCommunityCacheKey
      )??[]
    :[]
 );
 const [group,setGroup]=useState<any>(null),[body,setBody]=useState('');
 const [category]=useState<typeof CATEGORIES[number]>('reflection');

 // COMMUNITY_COMPACT_COMPOSER_20260811
 const [audience]=useState<Audience>('public');
 const [busy,setBusy]=useState(false),[photos,setPhotos]=useState<Photo[]>([]),[photoBusy,setPhotoBusy]=useState(false);
 const [publishNotice,setPublishNotice]=useState<string|null>(null);
 const [communityGif,setCommunityGif]=useState<BuklodCommunityGifFile|null>(null);
 const [communityGifPickerOpen,setCommunityGifPickerOpen]=useState(false);

 /* PATCH_186B_PHOTO_EDITOR_PUBLIC_STATE */
 const [
  communityPhotoEditor,
  setCommunityPhotoEditor
 ]=useState<Photo|null>(null);
 const [
  photoEditorTargetId,
  setPhotoEditorTargetId
 ]=useState<string|null>(null);
 const [
  photoEditSheetPhoto,
  setPhotoEditSheetPhoto
 ]=useState<Photo|null>(null);
 const [
  photoEditorInitialTool,
  setPhotoEditorInitialTool
 ]=useState<BuklodPhotoEditorTool>('draw');
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
 const [
  videoUploadPercent186O,
  setVideoUploadPercent186O
 ]=useState<number|null>(null);


 const [mentionRows,setMentionRows]=useState<Mention[]>([]),[mentions,setMentions]=useState<Mention[]>([]);
 const [commentMentionRows,setCommentMentionRows]=useState<Mention[]>([]);
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

 const [
  reactionDetailsPost,
  setReactionDetailsPost,
 ]=useState<any|null>(null);

 const [
  reactionDetailsFilter,
  setReactionDetailsFilter,
 ]=useState<string|null>(null);

 const openReactionDetails=
  (
   target:any,
   filter?:string|null
  )=>{
   setReactionDetailsFilter(
    filter??null
   );
   setReactionDetailsPost(
    target
   );
  };

 const openCommentReactionDetails=
  (
   comment:any,
   filter?:string|null
  )=>{
   const knownNames: Record<string, string> =
    {};

   for (const row of comments) {
    const userId = String(
     row?.user_id ?? ''
    ).trim();
    const name = String(
     row?.commenter_name ?? ''
    ).trim();

    if (userId && name) {
     knownNames[userId] = name;
    }
   }

   const target: CommunityReactionDetailsTarget =
    {
     comment_id: comment?.id,
     reaction_counts:
      comment?.reaction_counts ??
      {},
     total_reactions:
      sumCommunityReactionCounts(
       comment?.reaction_counts
      ),
     known_display_names:
      knownNames,
    };

   openReactionDetails(
    target,
    filter
   );
  };

 const [replyTo,setReplyTo]=
  useState<any|null>(null);

 const [viewerOpen,setViewerOpen]=
  useState(false);

 const [viewerItems,setViewerItems]=
  useState<any[]>([]);

 const [viewerIndex,setViewerIndex]=
  useState(0);

 const [viewerZoomed,setViewerZoomed]=
  useState(false);

 const [
  savingPhotoKey,
  setSavingPhotoKey
 ]=useState<string|null>(null);

/* PATCH_166H_STALE_LOAD_GUARD */
 const communityLoadSeqRef=useRef(0);
 const postReactBusyRef=useRef(false);
 const commentReactBusyRef=useRef(false);
/* PATCH_173H_R4_PUBLIC_LOCATION_STATE */
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
  const communityCacheKey=
    user
      ? `${communityFeedCacheKey(
          user.id,
          publicLocationScopeId
        )}:${feedMode}`
      : null;

  if(
    !appendPage186L &&
    communityCacheKey
  ){
    const cachedPosts=
      await readOfflineCache<any[]>(
        communityCacheKey
      );

    if(
      cachedPosts?.length &&
      communityLoadSeq===
        communityLoadSeqRef.current
    ){
      setPosts(cachedPosts);
    }

    if(!communityOnlineRef.current){
      return cachedPosts?.length ?? 0;
    }
  } else if (!communityOnlineRef.current) {
    return 0;
  }

  /*
   * PERF_MAIN_COMMUNITY_R1
   *
   * Group context is UI enrichment only and does not affect the public
   * feed RPC. Fetch both together so the feed no longer waits for an
   * unrelated round-trip first.
   */
  const [
    groupResult,
    rpcResult,
  ] = await Promise.all([
    withBuklodTimeout<any>(
      supabase
        .from('group_members')
        .select(
          'group_id,buklod_groups:group_id(id,name,leader_id)'
        )
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      5000,
      'Community group'
    ).catch(() => ({
      data: null,
      error: null,
    })),
    withBuklodTimeout<{data:any,error:any}>(
      (supabase as any).rpc(
        'get_buklod_public_community_feed_v7_page',
        {
          p_location_scope_id:
            publicLocationScopeId,
          p_mode: feedMode,
          p_limit: limit186L,
          p_offset: offset186L,
        }
      ),
      8000,
      'Community feed'
    ).catch((err:any)=>({
      data:null,
      error:{
        message:String(
          err?.message ??
          err ??
          'Community timed out.'
        )
      }
    })),
  ]);

  if(
    communityLoadSeq !==
    communityLoadSeqRef.current
  ){
    return -1;
  }

  const m =
    groupResult?.data;
  const g:any =
    m?.buklod_groups ?? null;
  setGroup(g);

  const data=rpcResult?.data;
  const error=rpcResult?.error;
  if(error){
    if(communityCacheKey){
      const cachedPosts=
        await readOfflineCache<any[]>(
          communityCacheKey
        );

      if(cachedPosts?.length){
        setPosts(cachedPosts);
        return cachedPosts.length;
      }
    }

    Alert.alert(
      'Community',
      error.message
    );

    return -1;
  }
  /* PATCH_154N_COMMUNITY_FEED_ROWS */
  let feedRows=
    (data??[]) as any[];

  const postIds=
    feedRows
      .map((p:any)=>p.id)
      .filter(Boolean);

  /*
   * PERF_MAIN_COMMUNITY_R1
   *
   * Community enrichment used to wait on each request one-by-one:
   * names -> my reactions -> media -> ranks -> clusters -> comments.
   * Keep the exact data contract, but execute independent work in two
   * bounded batches so mobile/network latency is paid in parallel rather
   * than multiplied across every round-trip.
   */
  const [
    hydratedFeedRows,
    myReactionResult,
    mediaResult,
  ] = await Promise.all([
    hydratePersonNamesOnRows(
      feedRows,
      'user_id',
      'author_name',
    ),
    postIds.length
      ? supabase
          .from('reactions')
          .select('post_id,reaction')
          .eq(
            'user_id',
            user.id
          )
          .in(
            'post_id',
            postIds
          )
      : Promise.resolve({
          data: [] as any[],
          error: null,
        }),
    postIds.length
      ? withBuklodTimeout<{data:any,error:any}>(
          (supabase as any).rpc(
            'get_buklod_post_media_v1',
            {
              p_post_ids:
                postIds
            }
          ),
          5000,
          'Community photos'
        ).catch((err:any)=>({
          data:null,
          error:{
            message:String(
              err?.message ??
              err ??
              'Photos timed out.'
            )
          }
        }))
      : Promise.resolve({
          data: [] as any[],
          error: null,
        }),
  ]);

  if(
    communityLoadSeq !==
    communityLoadSeqRef.current
  ){
    return -1;
  }

  feedRows =
    hydratedFeedRows;

  const myReactionByPost:
    Record<string,Reaction>={};

  const myReactionRows =
    myReactionResult?.data;
  const myReactionError =
    myReactionResult?.error;

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

  const next=
    feedRows.map(
      (p:any)=>{
        return{
          ...p,
          my_reaction:
            myReactionByPost[p.id]??null,
          media_url:
            peekCommunityMediaUrl(
              String(p.media_path??'').trim(),
              null
            ) ?? p.media_url
        };
      }
    );

  // PATCH_161H_MEDIA_LOAD
  const mediaMap:
   Record<string,any[]> =
   {};

  const mediaRows=
    mediaResult?.data;
  const mediaError=
    mediaResult?.error;

  if(mediaError){
    console.warn(
     'Community photos:',
     mediaError.message
    );
  }
  else{
    for(
     const row
     of mediaRows??[]
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
     ].push({
      ...row,
      media_url:
        peekCommunityMediaUrl(
          row.media_path,
          null
        ) ?? row.media_url,
     });
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

  const [
    rankResult,
    clusterMap,
    commentPreviewMap,
  ] = await Promise.all([
    authorIds.length
      ? withBuklodTimeout<{data:any}>(
          (supabase as any).rpc(
            'get_member_circle_ranks_v1',
            {
              p_user_ids: authorIds,
            }
          ),
          4000,
          'Community ranks'
        ).catch(() => ({
          data: null as any
        }))
      : Promise.resolve({
          data: null as any
        }),
    withBuklodTimeout(
      getClusterLabels(
        authorIds as string[]
      ),
      4000,
      'Community clusters'
    ).catch(() => (
      {} as Record<string, string>
    )),
    withBuklodTimeout(
      fetchBuklodPostCommentPreviews(
        postIds
      ),
      4000,
      'Community comments'
    ).catch(() => (
      {} as Record<string, unknown>
    )),
  ]);

  if(
    communityLoadSeq !==
    communityLoadSeqRef.current
  ){
    return -1;
  }

  const rankMap =
    new Map<string, string>();

  for (const row of rankResult?.data ?? []) {
    if (row?.user_id && row?.rank_name) {
      rankMap.set(
        row.user_id,
        row.rank_name
      );
    }
  }

  const preparedPosts186L=
    next.map((p:any)=>({
      ...p,
      cluster_name:
        clusterMap[p.user_id] ??
        null,
      author_rank_name:
        rankMap.get(p.user_id) ??
        'Circle Starter V',
      comment_preview:
        commentPreviewMap[p.id] ??
        null,
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
    setPosts(previous=>{
      const merged=
        keepStableCommunityMedia(
          previous,
          preparedPosts186L
        );

      if(communityCacheKey){
        void writeOfflineCache(
          communityCacheKey,
          merged.slice(
            0,
            SCALE_LIMITS.offlineCommunityCachePosts
          ),
          'network'
        );
      }

      return merged;
    });
  }

  return preparedPosts186L.length;
 },[user?.id, publicLocationScopeId, feedMode]);
/* PATCH_166H_INITIAL_LOAD */
 useEffect(()=>{
  void load();

  return()=>{
   communityLoadSeqRef.current+=1;
  };
 },[load]);
 /* PATCH_166H_SAFE_COMMUNITY_REALTIME */
 useEffect(() => {
    if (!user?.id) {
      return;
    }

    /*
     * BUKLOD PERFORMANCE 001-B R2
     *
     * Public Community root-post changes use Broadcast.
     *
     * Global Postgres Changes subscriptions for
     * community_posts / comments / reactions are removed.
     *
     * Comments and reactions must not cause a full Public
     * Community feed reload for every connected user.
     */

    let reloadTimer:
      ReturnType<typeof setTimeout> | null = null;

    const requestReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        void load();
      }, 900);
    };

    const channel =
      supabase
        .channel(
          'buklod:public-community:posts',
          {
            config: {
              private: false,
            },
          }
        )
        .on(
          'broadcast',
          {
            event: 'post_changed',
          },
          requestReload
        )
        .subscribe();

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [user?.id, load]);
 /* PATCH_186B_PHOTO_EDITOR_PUBLIC_PREPARE */
 const encodeCommunityPhotoFromAsset=
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

   return {
    uri:image.uri,
    base64:image.base64,
    sizeBytes
   };
  };

 /* PATCH_186B_PHOTO_EDITOR_PUBLIC_PICK */
 const removeComposerPhoto=
  (id:string)=>{
   setPhotos(
    current=>
     current.filter(
      photo=>photo.id!==id
     )
   );
  };

 const openComposerPhotoActions=
  (photo:Photo)=>{
   setPhotoEditSheetPhoto(photo);
  };

 const openCommunityPhotoEditor=
  (
   photo:Photo,
   tool:BuklodPhotoEditorTool
  )=>{
   setPhotoEditorTargetId(
    photo.id
   );
   setPhotoEditorInitialTool(tool);
   setCommunityPhotoEditor(photo);
  };

 const pickPhoto=
  async()=>{
   try{
    setPhotoBusy(true);

    const picked=
     await pickCommunityPhotos({
      remaining:
       COMMUNITY_MAX_PHOTOS-
       photos.length,
      maxPhotos:
       COMMUNITY_MAX_PHOTOS,
     });

    if(!picked.length){
     return;
    }

    setCommunityGif(null);
    setPhotos(current=>
     [...current,...picked].slice(
      0,
      COMMUNITY_MAX_PHOTOS
     )
    );
   }
   catch(e:any){
    Alert.alert(
     'Photos',
     e?.message||
      'Could not select photos.'
    );
   }
   finally{
    setPhotoBusy(false);
   }
  };

 const pickCommunityGallery=async()=>{
  if(busy||photoBusy||videoBusy186O){
   return;
  }

  try{
   setPhotoBusy(true);

   const P=await import('expo-image-picker');
   const allowed=await ensureImagePickerLibraryAccess(
    P.requestMediaLibraryPermissionsAsync
   );

   if(!allowed){
    Alert.alert(
     'Gallery Permission',
     'Please allow BUKLOD to access your photos and videos.'
    );
    return;
   }

   const currentCount=
    photos.length+(wallVideo186O?1:0);
   const remaining=
    Math.max(1,10-currentCount);

   const result=await P.launchImageLibraryAsync({
    mediaTypes:['images','videos'] as any,
    allowsMultipleSelection:true,
    selectionLimit:remaining,
    allowsEditing:false,
    quality:1,
   });

   if(result.canceled||!result.assets?.length){
    return;
   }

   const selectedVideos=result.assets.filter((asset:any)=>
    asset?.type==='video'||
    String(asset?.mimeType??'')
     .toLowerCase()
     .startsWith('video/')
   );

   if(selectedVideos.length>1){
    Alert.alert(
     'Gallery',
     'Choose only one video per Community Wall post.'
    );
    return;
   }

   const selectedImages=result.assets.filter(
    (asset:any)=>!selectedVideos.includes(asset)
   );

   const willHaveVideo=
    Boolean(selectedVideos[0]||wallVideo186O);
   const maxPhotos=
    willHaveVideo?9:10;
   const photoSlots=
    Math.max(0,maxPhotos-photos.length);
   const prepared:Photo[]=[];

   for(
    const [index,asset]
    of selectedImages
      .slice(0,photoSlots)
      .entries()
   ){
    const context=
     IncomingShareImageManipulator187A
      .ImageManipulator
      .manipulate(asset.uri);
    const rendered=
     await context.renderAsync();
    const saved=
     await rendered.saveAsync({
      format:
       IncomingShareImageManipulator187A
        .SaveFormat.JPEG,
      compress:.84,
      base64:true,
     });

    prepared.push({
     id:
      `gallery-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
     uri:saved.uri,
     base64:saved.base64,
     sizeBytes:
      saved.base64
       ? Math.ceil(saved.base64.length*.75)
       : Number((asset as any)?.fileSize??0)||undefined,
    });
   }

   setCommunityGif(null);

   if(prepared.length){
    setPhotos(current=>
     [...current,...prepared]
      .slice(0,willHaveVideo?9:10)
    );
   }

   if(selectedVideos[0]){
    setVideoBusy186O(true);
    await acceptWallVideo186O(
     selectedVideos[0]
    );
   }
  }
  catch(error:any){
   Alert.alert(
    'Gallery',
    error?.message||
     'Could not prepare the selected media.'
   );
  }
  finally{
   setPhotoBusy(false);
   setVideoBusy186O(false);
  }
 };

 const acceptWallVideo186O=
  async(asset:any)=>{
   const durationSeconds=
    readVideoDurationSeconds(asset);

   if(
    durationSeconds>
    BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS
   ){
    Alert.alert(
     'Video Too Long',
     BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE
    );
    return false;
   }

   let sizeBytes=
    await readVideoSizeBytes(
     asset,
     async (uri, options) => {
      const FS:any=
       await import(
        'expo-file-system/legacy'
       );

      return FS.getInfoAsync(
       uri,
       options as any
      );
     }
    );

   const validationError=
    validateCommunityVideoUpload({
     durationSeconds,
     sizeBytes,
     isReel:false,
    });

   if(validationError){
    Alert.alert(
     'Video',
     validationError
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

   setCommunityGif(null);
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

    const permissionGranted =
     await ensureImagePickerLibraryAccess(
      P.requestMediaLibraryPermissionsAsync
     );

    if(!permissionGranted){
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
 const selectComposerMention=(m:Mention)=>{
  setBody(current=>insertSelectedMention(current,m.full_name));
  setMentions(current=>
   current.some(x=>x.user_id===m.user_id)
    ? current
    : [...current,m]
  );
  setMentionRows([]);
 };

 const handleComposerTextChange=(value:string)=>{
  setBody(value);
  const query=activeMentionQuery(value);
  if(query===null){
   setMentionRows([]);
   return;
  }
  void searchMentions(query);
 };

 const searchCommentMentions=async(q:string)=>{
  const {data,error}=await (supabase as any).rpc(
   'search_post_mention_candidates_v2',
   {
    p_audience:'public',
    p_group_id:null,
    p_query:q,
    p_limit:20
   }
  );
  if(error){
   setCommentMentionRows([]);
   return;
  }
  setCommentMentionRows(data??[]);
 };

 const handleCommentTextChange=(value:string)=>{
  setCommentText(value);
  const query=activeMentionQuery(value);
  if(query===null){
   setCommentMentionRows([]);
   return;
  }
  void searchCommentMentions(query);
 };

 const selectCommentMention=(m:Mention)=>{
  setCommentText(current=>insertSelectedMention(current,m.full_name));
  setCommentMentionRows([]);
 };

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
    !wallVideo186O &&
    !communityGif
   ){
    return Alert.alert(
     'BUKLOD',
     'Write a message, add a GIF, photos, or a video.'
    );
   }

  if(
    communityGif &&
    (photos.length || wallVideo186O)
   ){
    return Alert.alert(
     'BUKLOD',
     'GIF cannot be mixed with photos or video.'
    );
   }

  if(
   photos.length+
   (wallVideo186O?1:0)>
   10
  ){
   return Alert.alert(
    'BUKLOD',
    'You can add up to 10 total media items per Wall post.'
   );
  }

 const snapshot={
   body:
    body.trim(),
   photos:
    [...photos],
   wallVideo:
    wallVideo186O as {
     uri:string;
     mimeType:string;
     sizeBytes:number;
     durationSeconds:number;
    }|null,
   communityGif:
    communityGif as BuklodCommunityGifFile|null,
   mentions:
    [...mentions],
   audience,
   category,
   groupId:
    group?.id??null,
   userId:
    user.id
 };

 setBody('');
 setPhotos([]);
 setWallVideo186O(null);
 setCommunityGif(null);
 setMentions([]);
 setBusy(false);
 const startNotice=
  snapshot.communityGif
   ? 'Uploading GIF in the background…'
   : snapshot.wallVideo
   ? 'Uploading video in the background…'
   : snapshot.photos.length
    ? 'Uploading photos in the background…'
    : 'Posting in the background…';
 setPublishNotice(startNotice);

 enqueueCommunityPublish(
  startNotice,
  async(setNotice)=>{
  const uploaded:
   Array<{
    media_path:string;
    media_mime_type:string;
    media_size_bytes:number;
   }>=[];

  let createdPostId:
   string|null=
   null;

  const createPost=async(
   first:{
    media_path:string;
    media_mime_type:string;
    media_size_bytes:number;
   }|null
  )=>{
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
       snapshot.audience,
      p_group_id:
       snapshot.audience==='group'
        ? snapshot.groupId
        : null,
      p_category:
       snapshot.category,
      p_body:
       snapshot.body ||
       (
        snapshot.wallVideo
         ? 'Shared a video.'
         : snapshot.communityGif
          ? 'Shared a GIF.'
          : snapshot.photos.length
          ? ''
          : 'Shared an update.'
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
      p_media_duration_seconds:
       snapshot.wallVideo
        ? snapshot.wallVideo.durationSeconds
        : null,
      p_is_reel:false,
      p_mentioned_user_ids:
       snapshot.mentions.map(
        x=>x.user_id
       )
     }
    );

   if(createError){
    throw createError;
   }

   createdPostId=
    extractCreatedRecordId(created);

   if(!createdPostId){
    throw new Error(
     'Post was created but its ID was not returned.'
    );
   }

   void load();
  };

  try{
   setNotice(startNotice);

   if(snapshot.communityGif){
    const gifPath=
     `${snapshot.userId}/post-gif-${Date.now()}-${Math.random().toString(36).slice(2)}.gif`;

    setNotice('Uploading GIF in the background…');
    setPublishNotice('Uploading GIF in the background…');

    const uploadedGif=
     await uploadCommunityGifFile({
      path:gifPath,
      uri:snapshot.communityGif.uri,
      sizeBytes:snapshot.communityGif.size,
     });

    uploaded.push({
     media_path:gifPath,
     media_mime_type:'image/gif',
     media_size_bytes:uploadedGif.sizeBytes
    });
   }

   if(snapshot.wallVideo){
    const lowerMime=
     snapshot.wallVideo
      .mimeType
      .toLowerCase();

    const extension=
     lowerMime.includes(
      'quicktime'
     ) ||
     snapshot.wallVideo
      .uri
      .toLowerCase()
      .includes('.mov')
      ? 'mov'
      : 'mp4';

    const videoPath=
     `${snapshot.userId}/post-video-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    setVideoUploadPercent186O(0);
    setNotice(
     'Uploading video in the background… 0%'
    );
    setPublishNotice(
     'Uploading video in the background… 0%'
    );

    await uploadCommunityVideoFile({
     path:videoPath,
     uri:snapshot.wallVideo.uri,
     contentType:
      snapshot.wallVideo.mimeType,
     onProgress:(progress)=>{
      const percent=
       Math.round(
        progress.ratio * 100
       );
      setVideoUploadPercent186O(
       progress.ratio
      );
      const notice=
       `Uploading video in the background… ${percent}%`;
      setNotice(notice);
      setPublishNotice(notice);
     },
    });

    uploaded.push({
     media_path:videoPath,
     media_mime_type:
      snapshot.wallVideo.mimeType,
     media_size_bytes:
      snapshot.wallVideo.sizeBytes
    });
   }

   if(snapshot.photos.length){
    setNotice(
     `Uploading photos in the background… 0/${snapshot.photos.length}`
    );
    setPublishNotice(
     `Uploading photos in the background… 0/${snapshot.photos.length}`
    );

    let finished=0;

    const photoUploads=
     await mapWithConcurrency(
      snapshot.photos,
      3,
      async(photo,index)=>{
       const path=
        `${snapshot.userId}/post-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.jpg`;

       const uploadedPhoto=
        await uploadCommunityPhotoFile({
         path,
         uri:photo.uri,
        });

       finished+=1;
       const notice=
        `Uploading photos in the background… ${finished}/${snapshot.photos.length}`;
       setNotice(notice);
       setPublishNotice(notice);

       return {
        media_path:path,
        media_mime_type:
         'image/jpeg',
        media_size_bytes:
         uploadedPhoto.sizeBytes ||
         photo.sizeBytes ||
         0
       };
      }
     );

    uploaded.push(
     ...photoUploads
    );
   }

   await createPost(uploaded[0]??null);

   if(uploaded.length && createdPostId){
    setNotice('Finishing your post…');
    setPublishNotice('Finishing your post…');
    await attachCommunityPostMedia(
     createdPostId,
     uploaded
    );
   }

   await load();
  }
  catch(e:any){
   await discardIncompleteCommunityPost({
    postId:createdPostId,
    mediaPaths:uploaded.map(x=>x.media_path),
   });

   setBody(snapshot.body);
   setPhotos(snapshot.photos);
   setWallVideo186O(snapshot.wallVideo);
   setCommunityGif(snapshot.communityGif);
   setMentions(snapshot.mentions);

   Alert.alert(
    'Could Not Post',
    e?.message||
    'Posting failed.'
   );

   await load();
   throw e;
  }
  finally{
   setBusy(false);
   setVideoUploadPercent186O(null);
   setPublishNotice(null);
  }
 }
 );

 };

/* BUKLOD_COMMUNITY_AUTHOR_FOLLOW_R1 */
 const toggleAuthorFollow=
  useCallback(
   async(
    targetUserId:string,
    nextFollowing:boolean
   )=>{
    const viewerId=
     String(user?.id??'').trim();
    const targetId=
     String(targetUserId??'').trim();

    if(
     !viewerId||
     !targetId||
     viewerId===targetId
    ){
     return;
    }

    const currentPost=
     posts.find(
      (post:any)=>
       String(post.user_id)===targetId
     );

    const previousFollowing=
     Boolean(
      currentPost?.is_following_author
     );

    setPosts(current=>
     current.map((post:any)=>
      String(post.user_id)===targetId
       ?{
         ...post,
         is_following_author:
          nextFollowing
        }
       :post
     )
    );

    const request=
     nextFollowing
      ? supabase
         .from('buklod_user_follows')
         .insert({
          follower_id:viewerId,
          followed_user_id:targetId
         })
      : supabase
         .from('buklod_user_follows')
         .delete()
         .eq('follower_id',viewerId)
         .eq('followed_user_id',targetId);

    const {error}=
     await request;

    if(error){
     setPosts(current=>
      current.map((post:any)=>
       String(post.user_id)===targetId
        ?{
          ...post,
          is_following_author:
           previousFollowing
         }
        :post
      )
     );

     Alert.alert(
      'Following',
      error.message
     );
     return;
    }

    if(
     feedMode==='following'&&
     !nextFollowing
    ){
     setPosts(current=>
      current.filter(
       (post:any)=>
        String(post.user_id)!==targetId
      )
     );
    }
   },
   [feedMode, posts, user?.id]
  );

 const react=async(
  postId:string,
  reaction:Reaction
)=>{
  if(postReactBusyRef.current){
    return;
  }

  postReactBusyRef.current=true;

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

  postReactBusyRef.current=false;
};


 
 // PATCH_161H_INTERACTIONS

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

    const hydratedRows=
      await hydratePersonNamesOnRows(
        rows,
        'user_id',
        'commenter_name',
      );

    const clusterMap=
     await getClusterLabels(
      hydratedRows.map(
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
     hydratedRows.map(
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
        is_owner:
         row.user_id===user?.id,
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
   [user?.id]
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
      resolvePersonDisplayName(
        replyTo.commenter_name,
        replyTo.user_id,
      )
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


 const reactToComment=
  async(
   target:any,
   reaction:Reaction
  )=>{
   if(!target?.id || commentReactBusyRef.current){
    return;
   }

   commentReactBusyRef.current=true;

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

   commentReactBusyRef.current=false;
  };

 const updateCommentBody=
  async(
   commentId:string,
   body:string
  )=>{
   const {error}=
    await (
     supabase as any
    ).rpc(
     'update_buklod_post_comment_v1',
     {
      p_comment_id:commentId,
      p_body:body
     }
    );

   if(error){
    throw error;
   }

   if(commentPost?.id){
    await loadComments(commentPost.id);
   }
  };

 const deleteCommentById=
  async(commentId:string)=>{
   const {error}=
    await (
     supabase as any
    ).rpc(
     'delete_buklod_post_comment_v1',
     {
      p_comment_id:commentId
     }
    );

   if(error){
    throw error;
   }

   if(commentPost?.id){
    await Promise.all([
     loadComments(commentPost.id),
     load()
    ]);
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
       true
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


     <BuklodReactionAction
      options={BUKLOD_PUBLIC_COMMUNITY_REACTIONS}
      counts={counts}
      mine={photo.my_reaction}
      onSummaryPress={key =>
       openReactionDetails(
        photo,
        key
       )
      }
      onSelect={key=>{
       void reactToCommunityPhoto(
        photo,
        key as Reaction
       );
      }}
     />


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
   setViewerZoomed(false);
   setViewerOpen(true);
  };


 const renderCommunityMedia=
  (item:any)=>{

   const rawMedia=
    (
     Array.isArray(item?.media_items) &&
     item.media_items.length
    )
     ? item.media_items
     : (
        item?.media_path ||
        item?.media_url
       )
        ? [{
           media_path:item?.media_path??null,
           media_url:item?.media_url??null,
           media_mime_type:
            item?.media_mime_type??
            'image/jpeg',
          }]
        : [];

   const videoMedia=
    rawMedia.find(
     (media:any)=>
      String(
       media?.media_mime_type??''
      )
       .toLowerCase()
       .startsWith('video/') &&
      Boolean(media?.media_url)
    )??null;

   const photos=
    communityPhotoCollageItems(
     rawMedia,
     null
    );

   if(videoMedia && photos.length){
    return (
     <View
      style={{
       overflow:'hidden',
       borderRadius:14,
       marginTop:12,
       backgroundColor:'#111'
      }}
     >
      <CommunityVideo
       uri={String(videoMedia.media_url)}
       height={220}
       autoPlay={
        activeCommunityVideoId===
         String(item?.id??'')
       }
      />
      <View style={{marginTop:2}}>
       <BuklodCommunityPhotoCollage
        items={photos}
        height={190}
        onPressPhoto={(index, photoItems)=>
         openPhotoViewer(
          photoItems,
          index
         )
        }
       />
      </View>
     </View>
    );
   }

   if(videoMedia){
    return (
     <CommunityVideo
      uri={String(videoMedia.media_url)}
      height={300}
      autoPlay={
       activeCommunityVideoId===
        String(item?.id??'')
      }
     />
    );
   }

   if(!photos.length){
    return null;
   }

   return (
    <BuklodCommunityPhotoCollage
     items={photos}
     onPressPhoto={(index, photoItems)=>
      openPhotoViewer(
       photoItems,
       index
      )
     }
    />
   );
  };





 useEffect(
  ()=>{
   if(
    !commentOpen ||
    !commentPost?.id ||
    !user?.id
   ){
    return;
   }

   const postId=
    String(
     commentPost.id
    );

   const release=
    acquireSharedRealtimeSubscription(
     `community-drawer:${user.id}:${postId}`,
     ()=>{
      void loadComments(
       postId
      );
     },
     emit=>{
      const channel=
       supabase
        .channel(
         `community-drawer:${user.id}:${postId}`
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
         payload=>emit(payload)
        )
        .subscribe();

      return ()=>{
       void supabase
        .removeChannel(
         channel
        );
      };
     }
    );

   return release;
  },
  [
   commentOpen,
   commentPost?.id,
   loadComments,
   user?.id
  ]
 );



/* PATCH_186L_R3_PAGE_CONTROL */
const communityPageBusyRef186L=
  useRef(false);

const [
  communityHasMore186L,
  setCommunityHasMore186L
]=useState(true);
const [
  communityRefreshing186L,
  setCommunityRefreshing186L
]=useState(false);
const [
  activeCommunityVideoId,
  setActiveCommunityVideoId
]=useState<string|null>(null);

useEffect(
 ()=>{
  setActiveCommunityVideoId(null);
 },
 [
  feedMode,
  publicLocationScopeId,
 ]
);

/* BUKLOD_COMMUNITY_FEED_MODES_R1 */
const selectCommunityFeedMode=
  useCallback(
    (nextMode:FeedMode)=>{
      if(nextMode===feedMode){
        return;
      }

      communityLoadSeqRef.current+=1;
      communityPageBusyRef186L.current=false;
      setCommunityHasMore186L(true);

      const nextCacheKey=
        user
          ? `${communityFeedCacheKey(
              user.id,
              publicLocationScopeId
            )}:${nextMode}`
          : null;
      const cachedNextPosts=
        nextCacheKey
          ? readOfflineCacheSync<any[]>(
              nextCacheKey
            )
          : null;

      setPosts(
        cachedNextPosts?.length
          ? cachedNextPosts
          : []
      );
      setFeedMode(nextMode);
    },
    [
      feedMode,
      publicLocationScopeId,
      user?.id,
    ]
  );

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
      setCommunityRefreshing186L(true);

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
        setCommunityRefreshing186L(false);
      }
    },
    [load]
  );

 const communityFeedRows =
  useMemo(
    () => {
      const visiblePosts =
        posts.filter(
          (post: any) =>
            /* PATCH_MARITES_STORYLINE_ONLY_R2C */
            !isMaritesCommunityPost(post) &&
            /*
             * BUKLOD_COMMUNITY_VIDEO_FB_LIKE_R1
             * Ordinary Wall videos stay in Community.
             * IGPAT/Reel media stays outside the Wall.
             */
            !isReelMediaPath(
              post.media_path
            ),
        );

      return buildCommunityFeedWithInlineAds(
        visiblePosts,
      );
    },
    [posts],
  );

 const {
  onViewableItemsChanged: onCommunityAdViewableItemsChanged,
  viewabilityConfig: communityAdViewabilityConfig,
  extraData: communityAdExtraData,
  isAdActive,
 } = useBuklodCommunityAdViewability();

 const onCommunityFeedViewableItemsChanged=
  useRef(
   ({
    viewableItems,
   }:{
    viewableItems:Array<{item?:any}>;
   })=>{
    onCommunityAdViewableItemsChanged({
     viewableItems,
    });

    let nextVideoId:string|null=null;

    for(const token of viewableItems){
     const row=token?.item;

     if(
      !row ||
      isCommunityFeedInlineAdRow(row)
     ){
      continue;
     }

     const mime=
      String(
       row.media_mime_type??''
      )
       .trim()
       .toLowerCase();

     if(
      mime.startsWith('video/') &&
      !isReelMediaPath(
       row.media_path
      )
     ){
      nextVideoId=
       String(row.id??'')||null;
      break;
     }
    }

    setActiveCommunityVideoId(
     current=>
      current===nextVideoId
       ? current
       : nextVideoId
    );
   }
  ).current;

 const communityFeedExtraData=
  `${communityAdExtraData}|video:${activeCommunityVideoId??''}`;

 if(!featureEnabled('community_feed'))return <FeatureUnavailable title="Community"/>;
 return <>
 <FlashList
 /* PERF2_PROGRESSIVE_FEED_LIST */
 onEndReachedThreshold={0.45}
  onEndReached={() => {
    void loadMoreCommunity186L();
  }}
      style={shared.screen} contentContainerStyle={s.content} data={
      communityFeedRows
    } keyExtractor={(i: any)=>i.id} extraData={communityFeedExtraData} onViewableItemsChanged={onCommunityFeedViewableItemsChanged} viewabilityConfig={communityAdViewabilityConfig} /* PATCH_186L_R3_PULL_REFRESH_PAGE_ZERO */
    refreshing={communityRefreshing186L}
    onRefresh={refreshCommunity186L}
  ListHeaderComponent={<BuklodFocusFadeUp duration={240} fromY={10} fromOpacity={0.78}><View>
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

    <ConnectPressable
     onPress={() =>
      router.push(
       '/igpat' as any
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
      BUKLOD IGPAT
     </Text>
    </ConnectPressable>
   </View>

   <BuklodMaritesBoard
    locationScopeId={
     publicLocationScopeId
    }
   />

   <BuklodCommunityContributionCard />

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

      {/* BUKLOD_COMMUNITY_FEED_MODES_R1 */}
      <View
       style={{
        flexDirection:'row',
        gap:7,
        marginTop:10,
        marginBottom:12
       }}
      >
       {([
        ['for_you','FOR YOU'],
        ['following','FOLLOWING'],
        ['latest','LATEST']
       ] as const).map(([mode,label])=>{
        const active=
         feedMode===mode;

        return(
         <ConnectPressable
          key={mode}
          accessibilityRole="button"
          accessibilityLabel={`Show ${label.toLowerCase()} Community posts`}
          onPress={()=>
           selectCommunityFeedMode(mode)
          }
          style={{
           flex:1,
           minHeight:38,
           borderRadius:999,
           borderWidth:1,
           borderColor:colors.green,
           backgroundColor:
            active
             ? colors.green
             : colors.white,
           alignItems:'center',
           justifyContent:'center',
           paddingHorizontal:8
          }}
         >
          <Text
           style={{
            fontSize:10,
            fontWeight:'900',
            color:
             active
              ? '#FFFFFF'
              : colors.greenDark
           }}
          >
           {label}
          </Text>
         </ConnectPressable>
        );
       })}
      </View>

    {/* BUKLOD_COMMUNITY_IGPAT_STRIP_R1 */}
<BuklodCommunityIgpatStrip />

    {/* PATCH_162A_SPONSOR_COMMUNITY */}
<BuklodCommunitySponsoredAd audience="public" />
   <SectionTitle>SHARE SOMETHING</SectionTitle><Card>
<TextInput multiline value={body} onChangeText={handleComposerTextChange} placeholder="Share with your Community... Type @ to mention someone" style={s.area}/>
    {!!mentionRows.length&&activeMentionQuery(body)!==null&&(
     <View style={{borderWidth:1,borderColor:colors.line,borderRadius:12,overflow:'hidden',marginTop:6,marginBottom:8,backgroundColor:colors.white}}>
      {mentionRows.slice(0,6).map(m=>(
       <Pressable key={m.user_id} onPress={()=>selectComposerMention(m)} style={{paddingHorizontal:12,paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line}}>
        <Text style={{fontWeight:'900',color:'#39D353'}}>@{m.full_name}</Text>
        {!!(m.church_name||m.group_name)&&<Text style={{marginTop:2,fontSize:10,color:colors.muted}}>{m.church_name}{m.group_name?` · ${m.group_name}`:''}</Text>}
       </Pressable>
      ))}
     </View>
    )}
    <View
      /* PATCH_154L_COMPOSER_SPACING */
      style={[
        s.row,
        {
          marginBottom: 14,
        },
      ]}
    >
    <Pressable style={s.tool} disabled={busy||photoBusy||videoBusy186O} onPress={()=>void pickCommunityGallery()}>
     <MaterialCommunityIcons name="image-multiple-outline" size={17} color={colors.green}/>
     <Text style={s.toolText}>{photoBusy||videoBusy186O?'Preparing...':wallVideo186O||photos.length?`Gallery (${photos.length+(wallVideo186O?1:0)}/10)`:'Gallery'}</Text>
    </Pressable>
   </View>
    {!!communityGif&&(
     <BuklodCommunityGifPreview
      file={communityGif}
      onRemove={()=>setCommunityGif(null)}
     />
    )}
    <BuklodCommunityGifPicker
     visible={communityGifPickerOpen}
     onClose={()=>setCommunityGifPickerOpen(false)}
     onPick={file=>{
      setCommunityGif(file);
      setPhotos([]);
      setWallVideo186O(null);
      setCommunityGifPickerOpen(false);
     }}
    />
    {!!publishNotice&&(
     <Text style={[shared.muted,{marginBottom:8,fontSize:12}]}>
      {publishNotice}
     </Text>
    )}
    <Text style={[shared.muted,{marginBottom:8,fontSize:11}]}>
      Gallery supports up to 10 media items per Wall post, including up to 1 video plus photos. Posting continues in the background so you can keep using BUKLOD.
      {photos.length
       ? ' Long-press a photo to highlight, draw, add text, emoji, or remove.'
       : ''}
    </Text>
    
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
         ? formatVideoBytes(
            wallVideo186O.sizeBytes
           )
         : 'size unavailable'}
       </Text>
      </View>
      <Pressable
       onPress={()=>
        setWallVideo186O(null)
       }
       hitSlop={BUKLOD_HIT_SLOP}
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
      {photos.map((photo)=>
       <Pressable
        key={photo.id}
        style={s.communityComposerPhoto}
        onLongPress={()=>
         openComposerPhotoActions(
          photo
         )
        }
        delayLongPress={BUKLOD_LONG_PRESS_MS}
       >
        <Image
         source={{uri:photo.uri}}
         style={s.communityComposerPhotoImage}
        />

        <Pressable
         onPress={()=>
          removeComposerPhoto(
           photo.id
          )
         }
         style={s.communityComposerPhotoRemove}
        >
         <MaterialCommunityIcons
          name="close"
          size={16}
          color="#FFFFFF"
         />
        </Pressable>
       </Pressable>
      )}
     </View>
    )}
    <Button
     title={
      publishNotice
       ? 'POSTING IN BACKGROUND'
       : 'POST'
     }
     onPress={publish}
    />
   </Card>
   <SectionTitle>COMMUNITY POSTS</SectionTitle>
  </View></BuklodFocusFadeUp>}
  ListEmptyComponent={
   <Card>
    <Text style={shared.muted}>
     {feedMode==='following'
      ? 'Follow BUKLOD members to see their posts here.'
      : 'No Public posts yet.'}
    </Text>
   </Card>
  }
  renderItem={({item,index}:{item:any,index:number})=>{
    if (
      isCommunityFeedInlineAdRow(
        item,
      )
    ) {
      return (
        <BuklodCommunityInlineAd
          slotId={item.id}
          active={isAdActive(item.id)}
        />
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

    return (
      <BuklodFocusVisibleRow index={index}>
    <Card>
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
    <BuklodTappableAvatar
     userId={item.user_id}
     name={resolvePersonDisplayName(item.author_name, item.user_id)}
     size={42}
    />
    <View style={{flex:1}}>
     <BuklodTappablePersonName
       userId={item.user_id}
       displayName={resolvePersonDisplayName(
         item.author_name,
         item.user_id,
       )}
       style={[
         s.author,
         {
           flex: 1,
         },
       ]}
     >
       {resolvePersonDisplayName(
         item.author_name,
         item.user_id,
       )}
     </BuklodTappablePersonName>
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
    {item.author_only
      ? ' | AKO LANG'
      : ''}
    {' | '}
    {formatSpecificDateTime(
     item.created_at
    )}</Text>
    {!!item.user_id&&item.user_id!==user?.id&&(
     <Pressable
      accessibilityRole="button"
      accessibilityLabel={
       item.is_following_author
        ? 'Unfollow this member'
        : 'Follow this member'
      }
      onPress={()=>
       void toggleAuthorFollow(
        String(item.user_id),
        !item.is_following_author
       )
      }
      style={{
       alignSelf:'flex-start',
       marginTop:6,
       paddingHorizontal:10,
       paddingVertical:5,
       borderRadius:999,
       borderWidth:1,
       borderColor:colors.green,
       backgroundColor:
        item.is_following_author
         ? colors.green
         : colors.white
      }}
     >
      <Text
       style={{
        fontSize:9,
        fontWeight:'900',
        color:
         item.is_following_author
          ? '#FFFFFF'
          : colors.greenDark
       }}
      >
       {item.is_following_author
        ? 'FOLLOWING'
        : 'FOLLOW'}
      </Text>
     </Pressable>
    )}
</View>
    {item.user_id===user?.id ? (
     <BuklodContentOverflowMenu
      title="Your post"
      body={String(
       repairMojibakeText(item.body) ??
        ''
      )}
      authorOnly={!!item.author_only}
      iconColor={colors.muted}
      allowPhotoEdit={!communityPostIsVideo(item)}
      maxPhotos={COMMUNITY_MAX_PHOTOS}
      photos={communityPostEditPhotos(item)}
      onEdit={async (nextBody, nextPhotos) => {
       const saved = await saveCommunityPostEdit({
        postId: item.id,
        userId: String(user?.id ?? ''),
        body: nextBody,
        photos: nextPhotos ?? [],
       });
       setPosts(current =>
        current.map(post =>
         post.id === item.id
          ? { ...post, ...saved }
          : post
        )
       );
      }}
      onToggleAuthorOnly={async () => {
       await setCommunityPostAuthorOnly(
        item.id,
        !item.author_only
       );
       setPosts(current =>
        current.map(post =>
         post.id === item.id
          ? {
             ...post,
             author_only: !item.author_only,
            }
          : post
        )
       );
      }}
      onDelete={async () => {
       await deleteCommunityPost(item.id);
       setPosts(current =>
        current.filter(
         post => post.id !== item.id
        )
       );
      }}
     />
    ) : (
     <BuklodContentOverflowMenu
      title="Post"
      iconColor={colors.muted}
      onReport={() =>
       openReport('post', item.id)
      }
     />
    )}
   </View>
    </View>
   </View>
   </View>
   <Text style={s.body}>{String(repairMojibakeText(item.body) ?? '').replace(
  /^Shared from [^\r\n]+(?:\r?\n\s*|$)+/i,
  ''
)}</Text>{!!ms.length&&<Text style={s.mentioned}>{ms.map((x:any)=>`@${x.full_name}`).join(' ')}</Text>}

    {renderCommunityMedia(item)}

    <BuklodCommunityPostEngagement
     reactionOptions={
      BUKLOD_PUBLIC_COMMUNITY_REACTIONS
     }
     reactionCounts={counts}
     myReaction={item.my_reaction}
     commentCount={item.comment_count}
     commentPreview={
      item.comment_preview
       ? {
          comment_id:
           item.comment_preview.comment_id,
          user_id:
           item.comment_preview.user_id,
          author_name:
           item.comment_preview.author_name,
          body:
           item.comment_preview.body,
          created_at:
           item.comment_preview.created_at,
         }
       : null
     }
     onReactionSummaryPress={key =>
      openReactionDetails(
       item,
       key
      )
     }
     onReact={key=>{
      void react(item.id, key as Reaction);
     }}
     onOpenComments={() =>
      openComments(item)
     }
     showCommentAction
     rightAction={
      <BuklodPostInternalShare
       postId={item.id}
       compact
       iconOnly
      />
     }
    />
  </Card>
      </BuklodFocusVisibleRow>
    );}}/>
{/* PATCH_161H_PHOTO_VIEWER */}
 <Modal
  visible={viewerOpen}
  animationType="fade"
  onRequestClose={()=>{
   setViewerZoomed(false);
   setViewerOpen(false);
  }}
 >
  <GestureHandlerRootView
   style={{flex:1}}
   unstable_forceActive
  >
   <View style={s.communityViewerScreen}>

   <GestureFlatList
    key={
     'viewer-'+
     viewerIndex+
     '-'+
     viewerItems.length
    }
    style={{flex:1,width:'100%'}}
    data={viewerItems}
    keyExtractor={(item,index)=>
     String(
      item?.media_path||
      item?.media_url||
      index
     )
    }
    horizontal={false}
    pagingEnabled={!viewerZoomed}
    scrollEnabled={!viewerZoomed}
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
    renderItem={({item,index})=>
     <View
      style={{
       width:'100%',
       height:
        COMMUNITY_VIEWER_HEIGHT,
       alignItems:'center',
       justifyContent:'center'
      }}
     >
      <CommunityZoomPhoto
       uri={item.media_url}
       mediaPath={item.media_path}
       active={index===viewerIndex}
       onZoomedChange={setViewerZoomed}
      />
     </View>
    }
   />

   <View style={s.communityViewerTop}>
    <Text style={s.communityViewerCount}>
     {viewerIndex+1} / {viewerItems.length}
    </Text>

    <Pressable
     onPress={()=>{
      setViewerZoomed(false);
      setViewerOpen(false);
     }}
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
         {resolvePersonDisplayName(
          commentPost.author_name,
          commentPost.user_id,
         )}
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
       const metaParts=[
        formatClusterName(c.cluster_name),
       ].filter(Boolean);

       return (
        <View
         key={c.id}
         style={[
          s.communityCommentItem,
          c.parent_id&&
           s.communityReplyItem
         ]}
        >
         <BuklodTappableAvatar
          userId={c.user_id}
          name={resolvePersonDisplayName(
           c.commenter_name,
           c.user_id,
          )}
          size={34}
         />

         <View style={{flex:1, minWidth:0}}>
          <BuklodCommunityCommentBubble
           comment={c}
           currentUserId={user?.id}
           reactionOptions={
            BUKLOD_PUBLIC_COMMUNITY_REACTIONS
           }
           isReply={Boolean(c.parent_id)}
           metaLine={metaParts.join(' • ') || null}
           timeLabel={
            formatSpecificDateTime(
             c.created_at
            )
           }
           onReply={()=>{
            setReplyTo(c);
            setCommentText(
             `@${resolvePersonDisplayName(
              c.commenter_name,
              c.user_id,
             )} `
            );
           }}
           onReact={key=>
            void reactToComment(
             c,
             key as Reaction
            )
           }
           onReactionSummaryPress={key =>
            openCommentReactionDetails(
             c,
             key
            )
           }
           onEdit={body=>
            updateCommentBody(
             String(c.id),
             body
            )
           }
           onDelete={()=>
            deleteCommentById(
             String(c.id)
            )
           }
           onReport={()=>
            openReport(
             'comment',
             String(c.id)
            )
           }
          />
         </View>
        </View>
       );
      })}
     </ScrollView>


     {!!replyTo&&(
      <View style={s.communityReplyBanner}>
       <View style={{flex:1}}>
        <BuklodMentionText
         text={`@${resolvePersonDisplayName(
          replyTo.commenter_name,
          replyTo.user_id,
         )}`}
         style={s.communityReplyBannerName}
         mentionStyle={s.communityReplyBannerName}
        />
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
         drawerBottomInset
       }
      ]}
     >

      <TextInput
       value={commentText}
       onChangeText={handleCommentTextChange}
       multiline
       placeholder={
        replyTo
         ? 'Write a reply...'
         : 'Write a comment...'
       }
       style={s.communityCommentInput}
      />

      {!!commentMentionRows.length&&activeMentionQuery(commentText)!==null&&(
       <View style={{position:'absolute',left:12,right:62,bottom:64,borderWidth:1,borderColor:colors.line,borderRadius:12,overflow:'hidden',backgroundColor:colors.white,zIndex:20}}>
        {commentMentionRows.slice(0,5).map(m=>(
         <Pressable key={m.user_id} onPress={()=>selectCommentMention(m)} style={{paddingHorizontal:12,paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line}}>
          <Text style={{fontWeight:'900',color:'#39D353'}}>@{m.full_name}</Text>
         </Pressable>
        ))}
       </View>
      )}

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



     {/* PATCH_186B_PHOTO_EDITOR_PUBLIC_MODAL */}
     <BuklodComposerPhotoEditSheet
      visible={!!photoEditSheetPhoto}
      onClose={()=>
       setPhotoEditSheetPhoto(null)
      }
      onSelectTool={tool=>{
       if(!photoEditSheetPhoto){
        return;
       }

       openCommunityPhotoEditor(
        photoEditSheetPhoto,
        tool
       );
      }}
      onRemove={()=>{
       if(!photoEditSheetPhoto){
        return;
       }

       removeComposerPhoto(
        photoEditSheetPhoto.id
       );
      }}
     />

     <BuklodPhotoEditor
      visible={!!communityPhotoEditor}
      sourceUri={communityPhotoEditor?.uri ?? null}
      initialTool={photoEditorInitialTool}
      onCancel={() =>{
       setCommunityPhotoEditor(null);
       setPhotoEditorTargetId(null);
      }}
      onDone={edited => {
       const nextPhoto:Photo={
        id:
         photoEditorTargetId||
         `photo-${Date.now()}`,
        uri:edited.uri,
        base64:edited.base64,
        sizeBytes:edited.sizeBytes
       };

       setPhotos(current=>{
        if(photoEditorTargetId){
         return current.map(photo=>
          photo.id===photoEditorTargetId
           ? nextPhoto
           : photo
         );
        }

        if(
         current.length>=
          COMMUNITY_MAX_PHOTOS
        ){
         return current;
        }

        return [
         ...current,
         nextPhoto
        ].slice(
         0,
         COMMUNITY_MAX_PHOTOS
        );
       });

       setCommunityPhotoEditor(null);
       setPhotoEditorTargetId(null);
      }}
     />

     <BuklodCommunityReactionDetailsSheet
      visible={!!reactionDetailsPost}
      target={reactionDetailsPost}
      initialFilter={reactionDetailsFilter}
      onClose={()=>{
       setReactionDetailsPost(null);
       setReactionDetailsFilter(null);
      }}
     />
     {reportSheet}
</>;
}
