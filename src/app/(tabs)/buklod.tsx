import { BuklodExpandableWallCaption } from '@/components/BuklodExpandableWallCaption';
/* BUKLOD_ROOT_PERFORMANCE_R3_COMMUNITY_REALTIME: existing broadcast implementation preserved */
/* PERF_EMERGENCY_R2_VISIBLE_POSTS: list-shape-drift-safely-skipped */
/* PERF_EMERGENCY_R2_MULTI_MEDIA_CACHE: existing-community-media-url-cache-preserved */
/* PERF_EMERGENCY_R2_POSTS_ONLY_REALTIME: existing Broadcast optimization preserved */
/* PERF_EMERGENCY_R2_STALE_LOAD: existing PATCH_166H guard preserved */
/* BUKLOD_SHARE_TARGET_187A */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { loadBuklodNotificationPost } from '@/lib/buklodNotificationPost';
import { useBuklodConnectUnread } from '@/hooks/useBuklodConnectUnread';
import { BackHandler } from 'react-native';
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
import { pickCommunityPhotos, pickCommunityGallery } from '@/lib/buklodPickCommunityPhotos';
import {
  attachCommunityPostMedia,
  discardIncompleteCommunityPost,
  extractCreatedRecordId,
  loadCommunityPostMediaByPostIds,
} from '@/lib/buklodCommunityPostMedia';
import { enqueueCommunityPublish } from '@/lib/buklodCommunityPublishQueue';
import {
  BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS,
  BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE,
  formatVideoBytes,
  readVideoDurationSeconds,
  readVideoSizeBytes,
  validateCommunityVideoUpload,
} from '@/lib/buklodCommunityWallMedia';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';
import { CommunityVideo, enableCommunityVideoSound } from '@/components/CommunityVideo';
import {
  BuklodCommunityPhotoCollage,
  communityPhotoCollageItems,
} from '@/components/BuklodCommunityPhotoCollage';
import {
  peekCommunityMediaUrl,
  prefetchCommunityMedia,
  resolveCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';
import { allowBackgroundCommunityPhotoPrefetch } from '@/lib/communityMediaPrefetchPolicy';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { arrangeCommunityForFairDiscovery } from '@/lib/buklodFairDiscovery';
import {
 COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE,
 COMMUNITY_VIDEO_DISCOVERY_LIMIT,
 COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST,
 lastCommunityVideoCursor,
 appendUniqueCommunityVideos,
 type CommunityVideoCursor,
} from '@/lib/buklodVideoDiscovery';

import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodVideoCompanionAd from '@/components/BuklodVideoCompanionAd';
import {
  buildCommunityFeedWithInlineAds,
  isCommunityFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';
import { useBuklodCommunityAdViewability } from '@/hooks/useBuklodCommunityAdViewability';
/* PATCH_186H_SINGLE_COMMUNITY_AUTHOR_AVATAR */
/* PATCH_179D_FIX_COMMUNITY_IMAGE_STABLE_CACHE */
import BuklodPublicLocationChips from '@/components/BuklodPublicLocationChips';
import BuklodMaritesBoard from '@/components/BuklodMaritesBoard';
import BuklodCommunityContributionCard from '@/components/BuklodCommunityContributionCard';
import { getBuklodCardTone, isBuklodDarkPaletteId } from '@/lib/buklodCardTones';
import { assertCommunityVideoQuotaAvailable } from '@/lib/buklodCommunityContributionEconomy';
import BuklodLifeWallCard from '@/components/BuklodLifeWallCard';
import KabihasnangLigawWallCard from '@/components/KabihasnangLigawWallCard';
import BuklodCommunityWallProfileBubbles from '@/components/BuklodCommunityWallProfileBubbles';
import {
  type BuklodCommunityComposerIntent,
} from '@/components/BuklodCommunityWallEngagementLayer';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
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
  writeOfflineCache,
} from '@/lib/buklodOfflineSync';
import {
  applyCommunityWallMetadata,
  applyCommunityWallMediaHydration,
  preservePendingCommunityWallMedia,
} from '@/lib/communityWallHydration';
import {
  classifyNetworkQuality,
  communityFirstPageLimit,
} from '@/lib/buklodNetworkQuality';
import { shouldReportCommunityFeedFailure } from '@/lib/communityFeedTelemetry';
import { SCALE_LIMITS } from '@/lib/performanceScale';
import {
  hydratePersonNamesOnRows,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import BuklodCommunityCommentThread from '@/components/BuklodCommunityCommentThread';
import BuklodCommunityCommentComposer from '@/components/BuklodCommunityCommentComposer';
import {
  type BuklodCommentMedia,
  encodeBuklodCommentMediaBody,
  buklodCommentHasSendableContent,
} from '@/lib/buklodCommentMediaBody';
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
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';
import {createCommunityStyles} from '@/app/(tabs)/buklodCommunityStyles';
import {
  useBuklodScrollBottomInset,
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
import BuklodMentionField from '@/components/BuklodMentionField';
import {
  mentionsStillInText,
  type BuklodMention,
} from '@/lib/buklodMentionCompose';
import { notifyBuklodCommunityMentions } from '@/lib/buklodNotifyMentions';
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
type CommunityFeedMode='for_you'|'following'|'latest';
const COMMUNITY_FEED_TABS:ReadonlyArray<{key:CommunityFeedMode;label:string}>=[
 {key:'for_you',label:'For You'},
 {key:'following',label:'Following'},
 {key:'latest',label:'Latest'},
];
type Reaction = BuklodCommunityReactionKey;
type Photo={
 id:string;
 uri:string;
 base64?:string;
 sizeBytes?:number;
};
type Mention=BuklodMention;

type CommunityWallVideoDescriptor={
 post:any;
 media:any;
 uri:string;
 mediaPath:string;
 durationSeconds?:number;
};

function communityWallVideoDescriptor(
 post:any
):CommunityWallVideoDescriptor|null{
 const attached=
  (
   Array.isArray(post?.media_items)
    ? post.media_items
    : []
  ).find(
   (media:any)=>
    String(
     media?.media_mime_type??
     ''
    )
     .trim()
     .toLowerCase()
     .startsWith('video/')
  );

 const fallback=
  String(
   post?.media_mime_type??
   ''
  )
   .trim()
   .toLowerCase()
   .startsWith('video/')
   ? post
   : null;

 const media=
  attached??
  fallback;

 const uri=
  String(
   media?.media_url??
   ''
  ).trim();

 if(!media||!uri){
  return null;
 }

 return{
  post,
  media,
  uri,
  mediaPath:
   String(
    media?.media_path??
    ''
   ).trim(),
  durationSeconds:
   Number(
    post?.media_duration_seconds??
    0
   )||undefined,
 };
}

/* BUKLOD_COMMUNITY_VIDEO_FULLSCREEN_SWIPE_R4 */

/*
 * BUKLOD_COMMUNITY_WARM_FEED_R1
 *
 * Keep the last prepared first page in memory across Community Wall remounts.
 * The Wall can repaint immediately on return while disk/network refresh in the
 * background. This is presentation cache only; Supabase remains authoritative.
 */
const communityWarmFeedMemory =
  new Map<string, any[]>();

/* BUKLOD_WALL_REMOTE_GUARD_R4
 * Normalize thrown transport failures so Community actions always return to
 * an actionable UI state. Reads are additionally time-bounded; writes stay
 * authoritative and are not locally timed out because a timed-out write may
 * already have committed and must never be blindly replayed.
 */
async function communityRpc(
 name:string,
 args:Record<string,unknown>
):Promise<any>{
 try{
  return await (supabase as any).rpc(name,args);
 }
 catch(error:any){
  return {
   data:null,
   error:{
    message:String(
     error?.message??
     error??
     'Community request failed.'
    )
   }
  };
 }
}

async function communityReadRpc(
 name:string,
 args:Record<string,unknown>,
 timeoutMs=7000
):Promise<any>{
 return withBuklodTimeout(
  communityRpc(name,args),
  timeoutMs,
  `Community ${name}`
 ).catch((error:any)=>({
  data:null,
  error:{
   message:String(
    error?.message??
    error??
    'Community request timed out.'
   )
  }
 }));
}

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
 const { focusPostId } = useLocalSearchParams<{focusPostId?:string}>();
 const openingPublicPost = typeof focusPostId==='string' && !!focusPostId.trim();
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
 /*
  * BUKLOD_PUBLIC_SHELL_NONBLOCKING_R1
  *
  * /buklod is the canonical PUBLIC route. The feed does not require scope
  * metadata to begin loading, so do not hide the entire wall behind the scope
  * spinner. Scope controls hydrate in the background.
  */
 if(scopeLoading && !activeScope){
  return <LegacyPublicBuklodScreen/>;
 }

 /*
  * BUKLOD_COMMUNITY_BACK_NO_FALSE_UNAVAILABLE_R7
  *
  * /buklod is the canonical public surface. Scope state can briefly be null
  * while returning through browser/native history; keep the mature public wall
  * mounted instead of flashing a false "Community unavailable" state.
  */
 if(!activeScope){
  return <LegacyPublicBuklodScreen/>;
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
 if(activeScope.scope_type!=='PUBLIC' && !openingPublicPost){
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
 const wallComposerTone = getBuklodCardTone('peach', isBuklodDarkPaletteId(paletteId));
 const wallGalleryTone = getBuklodCardTone('sky', isBuklodDarkPaletteId(paletteId));
 const { showFeedback }=useBuklodFeedback();
 const {
  unreadCount: connectUnread,
  personalUnread: connectPersonalUnread,
  communityUnread: connectCommunityUnread,
  refresh: refreshConnectUnread,
 }=useBuklodConnectUnread();
 useFocusEffect(useCallback(()=>{
  void refreshConnectUnread();
 },[refreshConnectUnread]));

 const reportCommunityFailure=useCallback((
  error:unknown,
  title:string,
  message:string,
  outcome:string,
 )=>{
  const base=buildBuklodUserFeedback(error,{
   context:'general',
   fallbackTitle:title,
   fallbackMessage:message,
  });
  const feedback={
   ...base,
   tone:'error' as const,
   title,
   message,
   nextStep:'Try again. If it repeats, open Need Help.',
   supportCode:base.supportCode??'SYS-500',
   retryable:true,
   needsSupport:true,
  };
  showFeedback(feedback,{
   autoHideMs:null,
   helpParams:{
    category:'TECHNICAL',
    errorCode:feedback.supportCode,
    message:feedback.message,
    sourceRoute:'/(tabs)/buklod',
   },
  });
  void trackBuklodFeedbackEvent({
   event:'error_shown',
   category:feedback.category,
   supportCode:feedback.supportCode,
   route:'/(tabs)/buklod',
   feature:'Community Wall',
   outcome,
  });
 },[showFeedback]);
 const {
  openReport,
  reportSheet,
 } = useBuklodContentReport();
 const scrollBottomInset=
  useBuklodScrollBottomInset({
   extra:10,
  });
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
          Alert.alert('Community', 'Video sharing is disabled in this BUKLOD Main release.');
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
        reportCommunityFailure(
          error,
          'Shared item not imported',
          "BUKLOD couldn't import the shared item right now.",
          'incoming_share_failed',
        );
      }
    })();
  }, [
    incomingShare187A.isResolving,
    incomingShare187A.sharedPayloads,
    incomingShare187A.resolvedSharedPayloads,
  ]);

 const [posts,setPosts]=useState<any[]>([]),[group,setGroup]=useState<any>(null),[body,setBody]=useState('');
 const notificationParams = useLocalSearchParams<{
  focusPostId?:string;
  focusComments?:string;
 }>();
 const focusPostId = typeof notificationParams.focusPostId==='string'
  ? notificationParams.focusPostId.trim() : '';
 const focusComments = notificationParams.focusComments==='1';
 const [focusedPost,setFocusedPost]=useState<any|null>(null);
 const [focusLoading,setFocusLoading]=useState(false);
 const [focusUnavailable,setFocusUnavailable]=useState(false);
 const [category,setCategory]=useState<
  'reflection'|'testimony'|'encouragement'|'discussion'
 >('reflection');
 const [composerIntent,setComposerIntent]=useState<BuklodCommunityComposerIntent>('post');
 const composerInputRef=useRef<any>(null);

 const activateComposerIntent=(intent:BuklodCommunityComposerIntent)=>{
  setComposerIntent(intent);
  setCategory(
   intent==='ask'||intent==='need_help'
    ? 'discussion'
    : intent==='offer'
      ? 'encouragement'
      : 'reflection'
  );
  setTimeout(()=>composerInputRef.current?.focus?.(),0);
 };

 // Home Today transfers a draft only; publishing still requires the existing composer.
 const homeTodayParams = useLocalSearchParams<{ homeTodayDraft?: string; homeTodayIntent?: string }>();
 const consumedHomeTodayIntent = useRef<string | null>(null);
 useEffect(() => {
  const intent = homeTodayParams.homeTodayIntent;
  if (!intent || consumedHomeTodayIntent.current === intent) return;
  consumedHomeTodayIntent.current = intent;
  const draft = String(homeTodayParams.homeTodayDraft ?? '').trim();
  if (draft) setBody(current => current.trim() ? current.trim() + '\n\n' + draft : draft);
  setComposerIntent('post');
  setCategory('reflection');
  router.setParams({ homeTodayDraft: undefined, homeTodayIntent: undefined });
 }, [homeTodayParams.homeTodayDraft, homeTodayParams.homeTodayIntent]);

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


 const [mentions,setMentions]=useState<Mention[]>([]);
 const [composerVideoOpen,setComposerVideoOpen]=useState(false);
 const [commentOpen,setCommentOpen]=
  useState(false);

 const [commentPost,setCommentPost]=
  useState<any|null>(null);

 const [comments,setComments]=
  useState<any[]>([]);

 const [commentText,setCommentText]=
  useState('');
 const [commentMentions,setCommentMentions]=
  useState<Mention[]>([]);
 const [commentMedia,setCommentMedia]=
  useState<BuklodCommentMedia|null>(null);
 const [commentMediaPreview,setCommentMediaPreview]=
  useState<string|null>(null);

 const [commentBusy,setCommentBusy]=useState(false);
 const [commentLoading,setCommentLoading]=useState(false);
 const [commentLoadError,setCommentLoadError]=useState<string|null>(null);
 const [commentNotice,setCommentNotice]=useState<string|null>(null);
 const activeCommentPostIdRef=useRef<string|null>(null);
 const commentAccountIdRef=useRef(String(user?.id??''));
 commentAccountIdRef.current=String(user?.id??'');
 const commentLoadSeqRef=useRef(0);
 const commentSendInFlightRef=useRef(false);
 // In-memory, account-scoped drafts survive accidental sheet dismissal.
 const commentDraftsRef=useRef(new Map<string,{
  text:string; mentions:Mention[];
  media:BuklodCommentMedia|null; preview:string|null;
  reply:any|null;
 }>());
 useEffect(()=>{
  // Account changes invalidate pending results and private local drafts.
  activeCommentPostIdRef.current=null;
  ++commentLoadSeqRef.current;
  commentDraftsRef.current.clear();
  setCommentOpen(false);
  setCommentPost(null);
  setComments([]);
  setCommentText('');
  setCommentMentions([]);
  setCommentMedia(null);
  setCommentMediaPreview(null);
  setReplyTo(null);
  setCommentLoadError(null);
  setCommentNotice(null);
  setCommentLoading(false);
 },[user?.id]);

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
  videoViewerOpen,
  setVideoViewerOpen
 ]=useState(false);

 const [
  videoViewerIndex,
  setVideoViewerIndex
 ]=useState(0);

 const [
  videoViewerFreshUrls,
  setVideoViewerFreshUrls
 ]=useState<Record<string,string>>({});

 const [
  wallVideoFreshUrls,
  setWallVideoFreshUrls
 ]=useState<Record<string,string>>({});

 const wallVideoFailedUriRef=
  useRef<Record<string,string>>({});

 const [
  videoViewerResolvingPostId,
  setVideoViewerResolvingPostId
 ]=useState<string|null>(null);

 const wallVideoPosts=
  useMemo(
   ()=>
    posts.filter(
     (post:any)=>
      !isMaritesCommunityPost(post)&&
      !Boolean(post?.is_reel)&&
      Boolean(
       communityWallVideoDescriptor(
        post
       )
      )
    ),
   [posts]
  );

 // The fullscreen playlist is independent of the Wall's rendered page.
 // Only small metadata pages are read; actual video URLs are resolved when
 // entering the viewer / approaching playback. No offscreen downloads.
 const [videoViewerPosts,setVideoViewerPosts]=useState<any[]>([]);
 const [videoViewerSession,setVideoViewerSession]=useState(0);
 const [videoViewerLoadingMore,setVideoViewerLoadingMore]=useState(false);
 const [videoViewerHasMore,setVideoViewerHasMore]=useState(true);
 const [videoViewerLoadError,setVideoViewerLoadError]=useState(false);
 const videoViewerCursorRef=useRef<CommunityVideoCursor|null>(null);
 const videoViewerScanBusyRef=useRef(false);
 const videoViewerScanSeqRef=useRef(0);
 const videoViewerHasMoreRef=useRef(true);

 const closeVideoViewer=
  useCallback(()=>{
   if(Platform.OS==='web'){
    const browserWindow=
     (globalThis as any)?.window;

    if(
     browserWindow?.history?.state?.__BUKLOD_VIDEO_VIEWER_R6__
    ){
     browserWindow.history.back();
     return;
    }
   }

    videoViewerScanSeqRef.current+=1;
    videoViewerScanBusyRef.current=false;
    setVideoViewerLoadingMore(false);
    setVideoViewerOpen(false);
  },[]);

 useEffect(()=>{
  if(
   Platform.OS!=='web'||
   !videoViewerOpen
  ){
   return;
  }

  const browserWindow=
   (globalThis as any)?.window;

  if(
   !browserWindow?.history?.pushState
  ){
   return;
  }

  const key=
   '__BUKLOD_VIDEO_VIEWER_R6__';

  if(!browserWindow.history.state?.[key]){
   browserWindow.history.pushState(
    {
     ...(browserWindow.history.state??{}),
     [key]:true
    },
    '',
    browserWindow.location.href
   );
  }

  const onPopState=()=>{
   videoViewerScanSeqRef.current+=1;
   videoViewerScanBusyRef.current=false;
   setVideoViewerLoadingMore(false);
   setVideoViewerOpen(false);
  };

  browserWindow.addEventListener(
   'popstate',
   onPopState
  );

  return ()=>{
   browserWindow.removeEventListener(
    'popstate',
    onPopState
   );
  };
 },[videoViewerOpen]);

 /* BUKLOD_VIDEO_VIEWER_ONE_STEP_BACK_R6 */
 const [
  savingPhotoKey,
  setSavingPhotoKey
 ]=useState<string|null>(null);

/* PATCH_166H_STALE_LOAD_GUARD */
 const communityLoadSeqRef=useRef(0);
 const postReactBusyRef=useRef(false);
 const commentReactBusyRef=useRef(false);
/* PATCH_173H_R4_PUBLIC_LOCATION_STATE */
const [
  publicLocationScopeId,
  setPublicLocationScopeId,
] = useState<string | null>(null);

useEffect(()=>{
  // Keep account and location contexts isolated even during slow requests.
  videoViewerScanSeqRef.current+=1;
  videoViewerHasMoreRef.current=true;
  videoViewerCursorRef.current=null;
  videoViewerScanBusyRef.current=false;
  setVideoViewerPosts([]);
  setVideoViewerLoadingMore(false);
  setVideoViewerLoadError(false);
  setVideoViewerOpen(false);
},[user?.id,publicLocationScopeId]);

/*
 * BUKLOD_COMMUNITY_FEED_MODES_ALL_R2
 *
 * For You / Following / Latest now use the same server-backed feed contract on
 * web and native. Mode caches stay isolated so switching tabs never paints a
 * stale list from another mode.
 */
const [
  communityFeedMode,
  setCommunityFeedMode,
] = useState<CommunityFeedMode>('for_you');

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

  const weakNetworkLimit=
    communityFirstPageLimit(
      classifyNetworkQuality()
    );
  const limit186L=
    Math.max(
      1,
      Math.min(
        Number(
          options?.limit??weakNetworkLimit
        )||weakNetworkLimit,
        100
      )
    );
  const communityLoadSeq=++communityLoadSeqRef.current;
  const communityBaseCacheKey=
    user
      ? communityFeedCacheKey(
          user.id,
          publicLocationScopeId
        )
      : null;

  const communityCacheKey=
    communityBaseCacheKey
      ? communityBaseCacheKey+
        ':mode:'+
        communityFeedMode
      : null;

  if(
    !appendPage186L &&
    communityCacheKey
  ){
    const warmPosts=
      communityWarmFeedMemory.get(
        communityCacheKey
      );

    if(
      warmPosts?.length &&
      communityLoadSeq===
        communityLoadSeqRef.current
    ){
      setPosts(warmPosts);
    }

    const cachedPostsPromise=
      readOfflineCache<any[]>(
        communityCacheKey
      );

    /*
     * Do not hold the feed RPC behind AsyncStorage. Paint disk cache when it
     * arrives only if no warmer/newer rows are already on screen.
     */
    void cachedPostsPromise
      .then(cachedPosts=>{
        if(
          !cachedPosts?.length ||
          communityLoadSeq!==
            communityLoadSeqRef.current
        ){
          return;
        }

        communityWarmFeedMemory.set(
          communityCacheKey,
          cachedPosts
        );

        setPosts(previous=>
          previous.length
            ? previous
            : cachedPosts
        );
      })
      .catch(()=>undefined);

    if(!communityOnlineRef.current){
      const cachedPosts=
        warmPosts?.length
          ? warmPosts
          : await cachedPostsPromise
              .catch(()=>null);

      if(
        cachedPosts?.length &&
        communityLoadSeq===
          communityLoadSeqRef.current
      ){
        setPosts(cachedPosts);
      }

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
          p_mode:
            communityFeedMode,
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

    if (shouldReportCommunityFeedFailure('community_feed_failed')) {
      reportCommunityFailure(
        error,
        'Community unavailable',
        "BUKLOD couldn't refresh Community right now. If saved posts are available, they remain safe.",
        'community_feed_failed',
      );
    }

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
  /*
   * BUKLOD_FB_LIKE_COMMUNITY_MEDIA_R1
   *
   * Feed rows must not wait several seconds for media enrichment.
   * Reuse this same promise for the initial fast path and background hydration.
   */
  const communityMediaPromise: Promise<Record<string, any[]>> =
    postIds.length
      ? loadCommunityPostMediaByPostIds(postIds)
      : Promise.resolve({});

  const followBackAuthorIds=
    [...new Set(
      feedRows
        .map((p:any)=>String(p.user_id??'').trim())
        .filter(Boolean)
    )];

  const [
    hydratedFeedRows,
    myReactionResult,
    mediaResult,
    followsViewerResult,
  ] = await Promise.all([
    hydratePersonNamesOnRows(
      feedRows,
      'user_id',
      'author_name',
    ),
    postIds.length
      ? withBuklodTimeout<any>(
          supabase
            .from('reactions')
            .select('post_id,reaction')
            .eq(
              'user_id',
              user.id
            )
            .in(
              'post_id',
              postIds
            ),
          5000,
          'Community my reactions'
        ).catch(() => ({
          data: [] as any[],
          error: null,
        }))
      : Promise.resolve({
          data: [] as any[],
          error: null,
        }),
    withBuklodTimeout<{data:any,error:any}>(
      communityMediaPromise.then(mediaByPost=>({
        data:Object.values(
          mediaByPost
        ).flat(),
        error:null,
      })),
      650,
      'Community media initial'
    ).catch(()=>({
      data: [] as any[],
      error: null,
    })),
    followBackAuthorIds.length
      ? withBuklodTimeout<any>(
          supabase
            .from('buklod_user_follows')
            .select('follower_id')
            .eq('followed_user_id', user.id)
            .in('follower_id', followBackAuthorIds),
          5000,
          'Community follow back'
        ).catch(() => ({
          data: [] as any[],
          error: null,
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

  const followsViewer=
    new Set(
      (followsViewerResult?.data??[])
        .map((row:any)=>String(row.follower_id??'').trim())
        .filter(Boolean)
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

   // Keep Latest chronological and Following untouched. The For You page
   // reserves opportunities for underexposed posts and diverse authors,
   // without an impression write or any extra backend request.
   const presentedFeedRows=
     communityFeedMode==='for_you'
       ? arrangeCommunityForFairDiscovery(feedRows)
       : feedRows;

   const next=
     presentedFeedRows.map(
      (p:any)=>{
        return{
          ...p,
          author_follows_viewer:
            followsViewer.has(String(p.user_id??'').trim()),
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
        row.media_url ??
        peekCommunityMediaUrl(
          row.media_path,
          null
        ),
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
    (p.media_path || p.media_url) &&
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

  /*
   * BUKLOD_COMMUNITY_PROGRESSIVE_MEDIA_R1
   *
   * The first page already has the canonical posts + media rows at this
   * point. Paint them now instead of waiting for rank, cluster labels and
   * comment previews. Those enrichments are non-layout metadata and can land
   * on the same rows a moment later.
   *
   * IMPORTANT: no Community photo sizing/crop/aspect-ratio rule changes here.
   */
  if(
    !appendPage186L &&
    communityLoadSeq ===
      communityLoadSeqRef.current
  ){
    setPosts(previous=>{
      const merged =
        keepStableCommunityMedia(
          previous,
          // A refresh with media metadata still pending must not momentarily
          // remove previously visible photos on a slow connection.
          !Array.isArray(mediaResult?.data) || mediaResult.data.length === 0
            ? preservePendingCommunityWallMedia(previous, next)
            : next
        );

      if(communityCacheKey){
        const warmRows=
          merged.slice(
            0,
            SCALE_LIMITS.offlineCommunityCachePosts
          );

        communityWarmFeedMemory.set(
          communityCacheKey,
          warmRows
        );

        void writeOfflineCache(
          communityCacheKey,
          warmRows,
          'network'
        );
      }

      return merged;
    });

    /*
     * BUKLOD_FB_LIKE_COMMUNITY_MEDIA_R1_BACKGROUND
     *
     * Post rows stay visible while media finishes.
     * The original request is reused; no second media fetch is started.
     */
    if(
      !Array.isArray(mediaResult?.data) ||
      mediaResult.data.length === 0
    ){
      void communityMediaPromise
        .then(mediaByPost=>{
          if(
            communityLoadSeq !==
              communityLoadSeqRef.current
          ){
            return;
          }

          if(
            !mediaByPost ||
            !Object.keys(mediaByPost).length
          ){
            return;
          }

          setPosts(current=>{
            const merged = applyCommunityWallMediaHydration(current, mediaByPost);

            if(communityCacheKey){
              const warmRows=
                merged.slice(
                  0,
                  SCALE_LIMITS.offlineCommunityCachePosts
                );

              communityWarmFeedMemory.set(
                communityCacheKey,
                warmRows
              );

              void writeOfflineCache(
                communityCacheKey,
                warmRows,
                'network'
              );
            }

            return merged;
          });
        })
        .catch(error=>{
          console.warn(
            'Community media background:',
            error?.message ??
              error
          );
        });
    }
    /*
     * Pre-sign and prefetch only the first visible burst. Signing is already
     * batched by buklodMediaUrl, so this does not create one request per photo.
     */
    if (allowBackgroundCommunityPhotoPrefetch(Platform.OS, classifyNetworkQuality())) {
    const firstVisibleMedia=
      next
        .slice(0,20)
        .flatMap((post:any)=>
          Array.isArray(post.media_items)
            ? post.media_items
            : []
        )
        .filter((item:any)=>
          !String(
            item?.media_mime_type??
            ''
          )
            .toLowerCase()
            .startsWith('video/')
        )
        .slice(0,32);

    void Promise
      .all(
        firstVisibleMedia.map(
          async(item:any)=>{
            const path=
              String(
                item?.media_path??
                ''
              ).trim();

            const direct=
              peekCommunityMediaUrl(
                path,
                item?.media_url
              ) ??
              String(
                item?.media_url??
                ''
              ).trim();

            if(direct){
              return direct;
            }

            if(!path){
              return null;
            }

            return resolveCommunityMediaUrl(
              path,
              null
            );
          }
        )
      )
      .then(urls=>{
        if(
          communityLoadSeq !==
            communityLoadSeqRef.current
        ){
          return;
        }

        prefetchCommunityMedia(urls);
      })
      .catch(()=>undefined);
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
      // Rank and comment enrichment must not replace media downloaded after
      // the 650ms initial-media deadline.
      const merged = applyCommunityWallMetadata(previous, preparedPosts186L);

      if(communityCacheKey){
        communityWarmFeedMemory.set(
          communityCacheKey,
          merged.slice(
            0,
            SCALE_LIMITS.offlineCommunityCachePosts
          )
        );
      }

      return merged;
    });
  }

  // Preserve the older-page media RPC after the fast first-paint budget.
  if (appendPage186L && (!Array.isArray(mediaResult?.data) || mediaResult.data.length === 0)) {
    void communityMediaPromise
      .then(mediaByPost => {
        if (communityLoadSeq !== communityLoadSeqRef.current || !Object.keys(mediaByPost ?? {}).length) return;
        setPosts(current => applyCommunityWallMediaHydration(current, mediaByPost));
      })
      .catch(error => console.warn('Community older-page media:', error?.message ?? error));
  }

  return preparedPosts186L.length;
 },[
  user?.id,
  publicLocationScopeId,
  communityFeedMode,
 ]);
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
    reportCommunityFailure(
     e,
     'Photos not selected',
     "BUKLOD couldn't prepare the selected photos right now.",
     'photo_picker_failed',
    );
   }
   finally{
    setPhotoBusy(false);
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

    if(sizeBytes){
     const quota=await assertCommunityVideoQuotaAvailable(sizeBytes);
     if(quota.allowed===false){
      Alert.alert('Monthly Video Allowance','This video would exceed your current monthly Community Wall video allowance.');
      return false;
     }
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

 const pickWallGallery186O=
  async()=>{
   if(
    busy ||
    videoBusy186O
   ){
    return;
   }

   try{
    setVideoBusy186O(true);

    const picked=
     await pickCommunityGallery({
      photoRemaining:
       COMMUNITY_MAX_PHOTOS-
       photos.length,
      hasVideo:!!wallVideo186O,
     });

    if(!picked){
     return;
    }

    if(
     picked.photos.length ||
     picked.videoAsset
    ){
     setCommunityGif(null);
    }

    if(picked.photos.length){
     setPhotos(current=>
      [
       ...current,
       ...picked.photos.map(photo=>({
        id:photo.id,
        uri:photo.uri,
       })),
      ].slice(0, COMMUNITY_MAX_PHOTOS)
     );
    }

    if(picked.videoAsset){
     await acceptWallVideo186O(
      picked.videoAsset
     );
    }
   }
   catch(error:any){
    reportCommunityFailure(
     error,
     'Gallery not opened',
     "BUKLOD couldn't open your gallery right now.",
     'gallery_pick_failed',
    );
   }
   finally{
    setVideoBusy186O(false);
   }
  };



 const publish=async()=>{
  if(!user)return;

  if(communityGif){
   return Alert.alert(
    'Community',
    'GIF posting is not available in Community.'
   );
  }

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
     'A GIF stays on its own. Gallery can hold 1 video and up to 10 photos.'
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
    mentionsStillInText(
     body,
     mentions
    ),
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
   ? 'Uploading GIF in the backgroundâ€¦'
   : snapshot.wallVideo
   ? 'Uploading video… Keep BUKLOD open'
   : snapshot.photos.length
    ? 'Uploading photos… Keep BUKLOD open'
    : 'Posting in the backgroundâ€¦';
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
    await communityRpc('create_buklod_community_post_v3',
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
       snapshot.wallVideo
        ? null
        : first?.media_path??
          null,
      p_media_mime_type:
       snapshot.wallVideo
        ? null
        : first?.media_mime_type??
          null,
      p_media_size_bytes:
       snapshot.wallVideo
        ? null
        : first?.media_size_bytes??
          null,
      /* BUKLOD_WALL_VIDEO_DURATION_PERSIST_R3 */
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

    setNotice('Uploading GIF in the backgroundâ€¦');
    setPublishNotice('Uploading GIF in the backgroundâ€¦');

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
     'Uploading video… Keep BUKLOD open 0%'
    );
    setPublishNotice(
     'Uploading video… Keep BUKLOD open 0%'
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
       `Uploading video… Keep BUKLOD open ${percent}%`;
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
     `Uploading photos… Keep BUKLOD open 0/${snapshot.photos.length}`
    );
    setPublishNotice(
     `Uploading photos… Keep BUKLOD open 0/${snapshot.photos.length}`
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
         wallPreview: true,
        });

       finished+=1;
       const notice=
        `Uploading photos… Keep BUKLOD open ${finished}/${snapshot.photos.length}`;
       setNotice(notice);
       setPublishNotice(notice);

       return {
        media_path:uploadedPhoto.path,
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
    setNotice('Finishing your postâ€¦');
    setPublishNotice('Finishing your postâ€¦');
    await attachCommunityPostMedia(
     createdPostId,
     uploaded
    );
   }

   if(
    createdPostId &&
    snapshot.mentions.length
   ){
    void notifyBuklodCommunityMentions({
     postId:createdPostId,
     mentionedUserIds:
      snapshot.mentions.map(
       mention=>mention.user_id
      ),
     context:'post',
    });
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

   reportCommunityFailure(
    e,
    'Post not published',
    "BUKLOD couldn't publish your post. Your composer content was restored.",
    'post_publish_failed',
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

/* BUKLOD_COMMUNITY_AUTHOR_FOLLOW_ALL_R2 */
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

    const previousFollowing=
     Boolean(
      posts.find(
       (post:any)=>
        String(post.user_id)===targetId
      )?.is_following_author
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

     reportCommunityFailure(
      error,
      'Following not updated',
      "BUKLOD couldn't update this follow right now.",
      'community_follow_failed',
     );
     return;
    }

    if(
     communityFeedMode==='following'&&
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
   [
    communityFeedMode,
    posts,
    reportCommunityFailure,
    user?.id
   ]
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
    ) ?? (focusedPost?.id===postId ? focusedPost : null);

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
  setFocusedPost((currentPost:any)=>
    currentPost?.id===postId
      ? changeReaction(currentPost,previous,nextReaction)
      : currentPost
  );

  const {error}=
    await communityRpc('set_buklod_post_reaction_v3',
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
    setFocusedPost((currentPost:any)=>
      currentPost?.id===postId
        ? changeReaction(currentPost,nextReaction,previous)
        : currentPost
    );

    reportCommunityFailure(
      error,
      'Reaction not saved',
      "BUKLOD couldn't save your reaction. The previous reaction was restored.",
      'post_reaction_failed',
    );
  }

  postReactBusyRef.current=false;
};


 
 // PATCH_161H_INTERACTIONS

 const loadComments=
  useCallback(
   async(postId:string)=>{
    const targetId=String(postId);
    const requestAccountId=String(user?.id??'');
    if(
     !targetId ||
     activeCommentPostIdRef.current!==targetId ||
     commentAccountIdRef.current!==requestAccountId
    )return;
    const requestId=++commentLoadSeqRef.current;
    const isCurrent=()=>(
     requestId===commentLoadSeqRef.current &&
     activeCommentPostIdRef.current===targetId &&
     commentAccountIdRef.current===requestAccountId
    );
    setCommentLoading(true);
    setCommentLoadError(null);
    try{
     const [commentsResult,reactionsResult]=await Promise.all([
      communityReadRpc('get_buklod_post_comments_v4',{p_post_id:targetId}),
      communityReadRpc('get_buklod_comment_reactions_v1',{p_post_id:targetId}),
     ]);
     if(!isCurrent())return;
     if(commentsResult.error)throw commentsResult.error;
     const rows=(commentsResult.data??[]) as any[];
     // Independent enrichments run together, with bounded fallbacks.
     const [hydratedRows,clusterMap]=await Promise.all([
      withBuklodTimeout(
       hydratePersonNamesOnRows(rows,'user_id','commenter_name'),
       5000,'Community comment names'
      ).catch(()=>rows),
      withBuklodTimeout(
       getClusterLabels(rows.map((row:any)=>row.user_id)),
       5000,'Community comment clusters'
      ).catch(()=>({} as Record<string,string>)),
     ]);
     if(!isCurrent())return;
     const reactionMap=new Map<string,any>();
     for(const row of (reactionsResult.data??[])){
      reactionMap.set(String(row.comment_id),row);
     }
     setComments(hydratedRows.map((row:any)=>{
      const reaction=reactionMap.get(String(row.id));
      return {
       ...row,
       cluster_name:clusterMap[row.user_id]??null,
       is_owner:row.user_id===user?.id,
       reaction_counts:reaction?.reaction_counts??{},
       my_reaction:reaction?.my_reaction??null,
      };
     }));
    }catch(error:any){
     if(!isCurrent())return;
     setCommentLoadError(
      "Comments couldn't load. Check your connection and tap Retry."
     );
     reportCommunityFailure(
      error,
      'Comments unavailable',
      "BUKLOD couldn't load comments right now.",
      'comments_load_failed',
     );
    }finally{
     if(isCurrent())setCommentLoading(false);
    }
   },
   [user?.id]
  );

 const openComments=
  async(post:any)=>{
   const postId=String(post.id);
   const saved=commentDraftsRef.current.get(String(user?.id??'')+':'+postId);
   activeCommentPostIdRef.current=postId;
   ++commentLoadSeqRef.current;
   setCommentPost(post);
   setComments([]);
   setCommentText(saved?.text??'');
   setCommentMentions(saved?.mentions??[]);
   setCommentMedia(saved?.media??null);
   setCommentMediaPreview(saved?.preview??null);
   setReplyTo(saved?.reply??null);
   setCommentLoadError(null);
   setCommentNotice(null);
   setCommentOpen(true);
   await loadComments(String(post.id));
  };

 const closeComments=
  ()=>{
   const postId=activeCommentPostIdRef.current;
   if(postId){
    const key=String(user?.id??'')+':'+postId;
    if(buklodCommentHasSendableContent(commentText,commentMedia)){
     const drafts=commentDraftsRef.current;
     drafts.delete(key);
     drafts.set(key,{
      text:commentText,
      mentions:commentMentions,
      media:commentMedia,
      preview:commentMediaPreview,
      reply:replyTo,
     });
     if(drafts.size>8)drafts.delete(drafts.keys().next().value!);
    }else{
     commentDraftsRef.current.delete(key);
    }
   }
   activeCommentPostIdRef.current=null;
   ++commentLoadSeqRef.current;
   setCommentLoading(false);
   setCommentLoadError(null);
   setCommentNotice(null);
   setCommentOpen(false);
   setReplyTo(null);
   setCommentText('');
   setCommentMentions([]);
   setCommentMedia(null);
   setCommentMediaPreview(null);
  };

 const submitCommunityComment=
  async()=>{
   if(
    !commentPost?.id ||
    !buklodCommentHasSendableContent(commentText,commentMedia) ||
    commentSendInFlightRef.current
   )return;

   const postId=String(commentPost.id);
   const authorId=String(user?.id??'');
   const initialMedia=commentMedia;
   const replyTarget=replyTo;
   let finalBody=commentText.trim();
   const mentionIds=mentionsStillInText(
    finalBody,commentMentions
   ).map(mention=>mention.user_id);
   const replyRootId=replyTarget
    ? String(replyTarget.parent_id??replyTarget.id)
    : null;

   if(replyTarget){
    const replyName=String(resolvePersonDisplayName(
     replyTarget.commenter_name,replyTarget.user_id
    ));
    const mention='@'+replyName;
    if(
     finalBody &&
     !finalBody.toLowerCase().startsWith(mention.toLowerCase())
    ){
     finalBody=mention+' '+finalBody;
    }
    if(replyTarget.user_id && !mentionIds.includes(String(replyTarget.user_id))){
     mentionIds.push(String(replyTarget.user_id));
    }
   }

   // A ref closes the double-tap gap before React commits busy state.
   commentSendInFlightRef.current=true;
   setCommentBusy(true);
   setCommentNotice(null);
   try{
    let mediaForBody=initialMedia;
    if(
     initialMedia?.kind==='image' &&
     initialMedia.ref &&
     !initialMedia.ref.startsWith('http') &&
     user?.id
    ){
     const path=
      user.id+'/comment-photo-'+Date.now()+'-'+
      Math.random().toString(36).slice(2)+'.jpg';
     await uploadCommunityPhotoFile({path,uri:initialMedia.ref});
     mediaForBody={kind:'image',ref:path};
    }
    const body=encodeBuklodCommentMediaBody(mediaForBody,finalBody);
    const {error}=await communityRpc('add_buklod_post_comment_v4',{
     p_post_id:postId,
     p_body:body,
     p_parent_id:replyRootId,
    });
    if(error)throw error;

    // One confirmed mutation: update just this post, not the whole feed.
    if(commentAccountIdRef.current===authorId){
     setPosts(current=>current.map(post=>
      String(post.id)===postId
       ? {...post,comment_count:Number(post.comment_count??0)+1}
       : post
     ));
    }
    commentDraftsRef.current.delete(authorId+':'+postId);
    if(
     activeCommentPostIdRef.current===postId &&
     commentAccountIdRef.current===authorId
    ){
     setCommentText('');
     setCommentMentions([]);
     setCommentMedia(null);
     setCommentMediaPreview(null);
     setReplyTo(null);
     setCommentNotice('Comment posted.');
    }
    void notifyBuklodCommunityMentions({
     postId,
     mentionedUserIds:mentionIds,
     context:'comment',
    });
    void loadComments(postId);
   }catch(error:any){
    if(commentAccountIdRef.current===authorId){
     if(activeCommentPostIdRef.current===postId){
      setCommentNotice('Comment not posted. Your draft is saved here; try again.');
     }
     reportCommunityFailure(
      error,
      'Comment not posted',
      error?.message??"BUKLOD couldn't post your comment right now.",
      'comment_post_failed',
     );
    }
   }finally{
    commentSendInFlightRef.current=false;
    setCommentBusy(false);
   }
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
    await communityRpc('set_buklod_comment_reaction_v1',
     {
      p_comment_id:
       targetId,
      p_reaction:
       reaction
     }
    );

   if(error){
    reportCommunityFailure(
     error,
     'Reaction not saved',
     "BUKLOD couldn't save your reaction right now.",
     'comment_reaction_failed',
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
    await communityRpc('update_buklod_post_comment_v1',
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
    await communityRpc('delete_buklod_post_comment_v1',
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
    await communityRpc('set_buklod_photo_reaction_v1',
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
    reportCommunityFailure(
     error,
     'Photo reaction not saved',
     "BUKLOD couldn't save your photo reaction right now.",
     'photo_reaction_failed',
    );
    return;
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
    reportCommunityFailure(
     e,
     'Photo not saved',
     "BUKLOD couldn't save this photo right now.",
     'save_photo_failed',
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

 const resolveFreshVideoUrl=
  useCallback(
   async(post:any)=>{
    const postId=
     String(post?.id??'').trim();

    if(!postId){
     return null;
    }

    const mediaMap=
     await loadCommunityPostMediaByPostIds(
      [postId],
      {
       forceFreshVideoUrls:true
      }
     );

    const freshVideo=
     (
      Array.isArray(
       mediaMap?.[postId]
      )
       ? mediaMap[postId]
       : []
     ).find(
      (media:any)=>
       String(
        media?.media_mime_type??
        ''
       )
        .trim()
        .toLowerCase()
        .startsWith('video/')
     );

    const freshUrl=
     String(
      freshVideo?.media_url??
      ''
     ).trim();

    return freshUrl||null;
   },
   []
  );

 const refreshWallVideoUrl=
  useCallback(
   async(
    post:any,
    failedUri?:string
   )=>{
    const postId=
     String(post?.id??'').trim();

    if(!postId){
     return null;
    }

    const failed=
     String(failedUri??'').trim();

    if(
     failed&&
     wallVideoFailedUriRef
      .current[postId]===failed
    ){
     return null;
    }

    if(failed){
     wallVideoFailedUriRef
      .current[postId]=failed;
    }

    try{
     const freshUrl=
      await resolveFreshVideoUrl(
       post
      );

     if(
      freshUrl&&
      freshUrl!==failed
     ){
      setWallVideoFreshUrls(
       current=>({
        ...current,
        [postId]:freshUrl
       })
      );
      return freshUrl;
     }

     return null;
    }
    catch{
     return null;
    }
   },
   [resolveFreshVideoUrl]
  );

 const refreshVideoViewerUrl=
  useCallback(
   async(post:any)=>{
    const postId=
     String(post?.id??'').trim();

    if(!postId){
     return null;
    }

    setVideoViewerResolvingPostId(
     postId
    );

    try{
     const freshUrl=
      await resolveFreshVideoUrl(
       post
      );

     if(freshUrl){
      setVideoViewerFreshUrls(
       current=>({
        ...current,
        [postId]:freshUrl
       })
      );

      setWallVideoFreshUrls(
       current=>({
        ...current,
        [postId]:freshUrl
       })
      );

      return freshUrl;
     }

     return null;
    }
    catch{
     return null;
    }
    finally{
     setVideoViewerResolvingPostId(
      current=>
       current===postId
        ? null
        : current
     );
    }
   },
   [resolveFreshVideoUrl]
  );

 /* BUKLOD_WALL_VIDEO_PLAYABLE_REFRESH_R6 */

  const loadMoreVideoViewer=
   useCallback(async()=>{
    if(
     !user?.id||
     videoViewerScanBusyRef.current||
     !videoViewerHasMoreRef.current
    ) return;

    const requestSeq=videoViewerScanSeqRef.current;
    videoViewerScanBusyRef.current=true;
    setVideoViewerLoadingMore(true);
    setVideoViewerLoadError(false);

    try{
     // Video-only keyset pages avoid the public Wall RPC's 100-row candidate
     // cap and large OFFSET scans. Only the next small page is hydrated.
     for(let scan=0;scan<COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST;scan+=1){
      const pageSize=COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE;
      const cursor=videoViewerCursorRef.current;
      const {data,error}=await withBuklodTimeout<any>(
       (supabase as any).rpc(
        'get_buklod_public_community_video_page_v1',
        {
         p_location_scope_id:publicLocationScopeId??null,
         p_cursor_created_at:cursor?.created_at??null,
         p_cursor_id:cursor?.id??null,
         p_limit:pageSize,
        }
       ),
       8000,
       'Community video discovery'
      );

      if(requestSeq!==videoViewerScanSeqRef.current)return;
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      if(rows.length===0){
       videoViewerHasMoreRef.current=false;
       setVideoViewerHasMore(false);
       break;
      }

      const videoRows=rows;
      const videoIds=videoRows.map((post:any)=>String(post.id));
      const [mediaByPost,myReactions]=await Promise.all([
       videoIds.length
        ? loadCommunityPostMediaByPostIds(videoIds)
        : Promise.resolve({} as Record<string,any[]>),
       videoIds.length
        ? withBuklodTimeout<any>(
           supabase.from('reactions')
            .select('post_id,reaction')
            .eq('user_id',user.id)
            .in('post_id',videoIds),
           5000,
           'Community video reactions'
          ).catch(()=>({data:[]}))
        : Promise.resolve({data:[]}),
      ]);
      if(requestSeq!==videoViewerScanSeqRef.current)return;

      const reactionById=new Map<string,string>(
       (myReactions?.data??[]).map((row:any)=>[
        String(row.post_id),String(row.reaction),
       ])
      );
      const prepared=(await Promise.all(videoRows.map(async(post:any)=>{
       const mediaItems=(mediaByPost[String(post.id)]??[])
        .filter((item:any)=>Boolean(item?.media_path||item?.media_url));
       const primaryPath=String(post.media_path??'').trim();
       const primaryVideo=String(post.media_mime_type??'')
        .toLowerCase().startsWith('video/');
       const primaryUrl=primaryVideo
        ? (peekCommunityMediaUrl(primaryPath,null)??
           (primaryPath
            ? await resolveCommunityMediaUrl(primaryPath,null)
            : null))
        : null;
       const candidate={
        ...post,
        media_url:primaryUrl,
        media_items:mediaItems,
        my_reaction:reactionById.get(String(post.id))??null,
       };
       return communityWallVideoDescriptor(candidate)?candidate:null;
      }))).filter(Boolean);
      if(requestSeq!==videoViewerScanSeqRef.current)return;

      // Advance only after hydration succeeds; a transient signing or network
      // failure retries this exact keyset page without losing entries.
      videoViewerCursorRef.current=lastCommunityVideoCursor(rows);
      if(rows.length<pageSize){
       videoViewerHasMoreRef.current=false;
       setVideoViewerHasMore(false);
      }
      if(prepared.length){
       setVideoViewerPosts(current=>{
        return appendUniqueCommunityVideos(current,prepared);
       });
       break;
      }
      if(rows.length<pageSize)break;
     }
    }
    catch{
     if(requestSeq===videoViewerScanSeqRef.current){
      setVideoViewerLoadError(true);
     }
    }
    finally{
     if(requestSeq===videoViewerScanSeqRef.current){
      videoViewerScanBusyRef.current=false;
      setVideoViewerLoadingMore(false);
     }
    }
   },[publicLocationScopeId,user?.id]);

  useEffect(()=>{
   if(videoViewerOpen){
    void loadMoreVideoViewer();
   }
  },[videoViewerOpen,loadMoreVideoViewer]);

 const openVideoViewer=
  (postId:string)=>{
   const index=
     wallVideoPosts.findIndex(
     (post:any)=>
      String(post?.id)===
      String(postId)
    );

   if(index<0){
    return;
   }

   const target=
     wallVideoPosts[index];

    videoViewerScanSeqRef.current+=1;
    videoViewerScanBusyRef.current=false;
    videoViewerCursorRef.current=null;
    videoViewerHasMoreRef.current=true;
    setVideoViewerHasMore(true);
    setVideoViewerLoadingMore(false);
    setVideoViewerLoadError(false);
    setVideoViewerPosts([target]);
    setVideoViewerIndex(0);
    setVideoViewerSession(current=>current+1);
   setVideoViewerOpen(true);
   enableCommunityVideoSound();

   /*
    * BUKLOD_VIDEO_FULLSCREEN_FRESH_URL_R5
    * A Wall URL may be a short-lived signed URL. Refresh it when opening the
    * fullscreen player so a second player instance never relies only on the
    * feed's older URL.
    */
   void refreshVideoViewerUrl(
    target
   );
  };


 const renderCommunityMedia=
  (item:any)=>{

    const wallVideo=
      communityWallVideoDescriptor(
        item
      );

    if(wallVideo){
      const postId=
       String(item?.id??'');

      const wallUri=
       String(
        wallVideoFreshUrls[
         postId
        ]??
        wallVideo.uri
       ).trim();

      return (
        <>
          <View
            /* BUKLOD_COMMUNITY_VIDEO_FULL_BLEED_R4 */
            style={{
              marginHorizontal:-12,
              position:'relative',
            }}
          >
            <CommunityVideo
              key={
                postId+
                ':'+
                wallUri
              }
              uri={wallUri}
              height={Math.min(
                520,
                Math.max(
                  300,
                  Dimensions.get('window').width*
                    (Platform.OS==='web'
                      ? 0.56
                      : 0.78)
                )
              )}
              edgeToEdge
              autoPlay
              active={
                visibleVideoPostId===postId &&
                !videoViewerOpen
              }
              expectedDurationSeconds={
                wallVideo.durationSeconds
              }
              onPlaybackError={()=>{
               void refreshWallVideoUrl(
                item,
                wallUri
               );
              }}
              onOpenFullscreen={()=>
                openVideoViewer(
                  String(item.id)
                )
              }
            />
          </View>
          <BuklodVideoCompanionAd
            contentId={postId}
            expectedDurationSeconds={wallVideo.durationSeconds}
          />
          {communityPhotoCollageItems(
            item?.media_items,
            null
          ).length>0&&(
            <View style={{marginHorizontal:-12,marginTop:8}}>
             <BuklodCommunityPhotoCollage
              items={communityPhotoCollageItems(
               item?.media_items,
               null
              )}
              contentFit="cover"
              preserveSinglePhotoAspectRatio
              onPressPhoto={(index, photos)=>
               openPhotoViewer(
                photos,
                index
               )
              }
             />
            </View>
          )}
        </>
      );
    }

   const media=
    communityPhotoCollageItems(
     item?.media_items,
     {
      media_path:
       item?.media_path ??
       null,
      media_url:
       item?.media_url ??
       null,
      media_mime_type:
       item?.media_mime_type ??
       'image/jpeg',
     }
    );

   if(!media.length){
    return null;
   }

   return (
    <View style={{marginHorizontal:-12}}>
     <BuklodCommunityPhotoCollage
      items={media}
      contentFit="cover"
      preserveSinglePhotoAspectRatio
      onPressPhoto={(index, photos)=>
       openPhotoViewer(
        photos,
        index
       )
      }
     />
    </View>
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



/* BUKLOD_COMMUNITY_BACK_ENDPOINT_R2 */
const communityFeedRefBackR2 = useRef<any>(null);
const communityScrollYRefBackR2 = useRef(0);

// A notification brings an older post into the existing Wall feed, even when
// it is absent from the paginated first page. Detail RPC still enforces access.
useEffect(()=>{
  if(!focusPostId || !user?.id){
    setFocusedPost(null);
    setFocusLoading(false);
    setFocusUnavailable(false);
    return;
  }
  let current=true;
  setFocusedPost(null);
  setFocusLoading(true);
  setFocusUnavailable(false);
  let openedComments=false;
  void loadBuklodNotificationPost(focusPostId,user.id,post=>{
      if(!current)return;
      setFocusedPost(post);
      setFocusLoading(false);
      if(focusComments){
        openedComments=true;
        void openComments(post);
      }
    })
    .then(post=>{
      if(!current)return;
      setFocusedPost(post);
      setFocusUnavailable(!post);
      if(post && focusComments && !openedComments)void openComments(post);
    })
    .catch(error=>{
      if(!current)return;
      console.warn('Notification Wall post:',error);
      setFocusUnavailable(true);
    })
    .finally(()=>{
      if(current)setFocusLoading(false);
    });
  return ()=>{current=false;};
},[focusPostId,focusComments,user?.id]);

useEffect(()=>{
  if(!focusedPost || String(focusedPost.id)!==focusPostId)return;
  const timer=setTimeout(()=>{
    try{
      communityFeedRefBackR2.current?.scrollToIndex?.({
        index:0,animated:true,viewPosition:0,
      });
    }catch{
      communityFeedRefBackR2.current?.scrollToOffset?.({
        offset:0,animated:true,
      });
    }
  },180);
  return ()=>clearTimeout(timer);
},[focusedPost?.id,focusPostId]);
/* PATCH_186L_R3_PAGE_CONTROL */
const communityPageBusyRef186L=
  useRef(false);

const [
  communityHasMore186L,
  setCommunityHasMore186L
]=useState(true);

const selectCommunityFeedMode=
  useCallback(
    (nextMode:CommunityFeedMode)=>{
      if(
        nextMode===communityFeedMode
      ){
        return;
      }

      /*
       * Invalidate an older in-flight mode request before painting another
       * mode. Warm memory is mode-specific so switching back is immediate.
       */
      communityLoadSeqRef.current+=1;
      communityPageBusyRef186L.current=false;
      setCommunityHasMore186L(true);

      const baseKey=
        user
          ? communityFeedCacheKey(
              user.id,
              publicLocationScopeId
            )
          : null;

      const modeKey=
        baseKey
          ? baseKey+
            ':mode:'+
            nextMode
          : null;

      setPosts(
        modeKey
          ? communityWarmFeedMemory.get(
              modeKey
            ) ?? []
          : []
      );

      setCommunityFeedMode(
        nextMode
      );
    },
    [
      communityFeedMode,
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

 /* BUKLOD_COMMUNITY_BACK_ENDPOINT_R2_HANDLER */
useFocusEffect(
  useCallback(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        const scrolled = Math.max(
          communityScrollYRefBackR2.current,
          Number(
            communityFeedRefBackR2.current?.getAbsoluteLastScrollOffset?.() || 0
          ),
        );
        if (scrolled > 12) {
          if (typeof communityFeedRefBackR2.current?.scrollToTop === 'function') {
            communityFeedRefBackR2.current.scrollToTop({ animated: true });
          } else {
            communityFeedRefBackR2.current?.scrollToOffset?.({
              offset: 0,
              animated: true,
              skipFirstItemOffset: true,
            });
          }
        } else {
          void refreshCommunity186L();
        }

        // Community Wall is the Android Back endpoint.
        // Never navigate away or exit while this route is focused.
        return true;
      },
    );

    return () => subscription.remove();
  }, [refreshCommunity186L]),
);
const communityFeedRows =
  useMemo(
    () => {
      const visiblePosts =
        posts.filter(
          (post: any) =>
            /* PATCH_MARITES_STORYLINE_ONLY_R2C */
            !isMaritesCommunityPost(post) &&
            !Boolean(post.is_reel),
        );

      const selectedPosts = focusedPost
        ? [focusedPost,...visiblePosts.filter(post=>String(post.id)!==String(focusedPost.id))]
        : visiblePosts;

      return buildCommunityFeedWithInlineAds(
         selectedPosts,
      );
    },
     [posts,focusedPost],
  );

 const {
  onViewableItemsChanged: onCommunityAdViewableItemsChanged,
  viewabilityConfig: communityAdViewabilityConfig,
  extraData: communityAdExtraData,
  isAdActive,
  visibleVideoPostId,
 } = useBuklodCommunityAdViewability();

 const maritesVisibilityRefreshRef = useRef<(() => void) | null>(null);
 if(!featureEnabled('community_feed'))return <FeatureUnavailable title="Community"/>;
 return <>
 <FlashList
    maintainVisibleContentPosition={{ disabled: true }}
    ref={communityFeedRefBackR2}
    onScroll={(event:any) => {
      communityScrollYRefBackR2.current =
        Number(event?.nativeEvent?.contentOffset?.y ?? 0);
      maritesVisibilityRefreshRef.current?.();
    }}
    scrollEventThrottle={16}
 /* PERF2_PROGRESSIVE_FEED_LIST */
 /* BUKLOD_COMMUNITY_FAST_SCROLL_BUFFER_R3 */
 drawDistance={Platform.OS==='web' ? 1800 : 400}
 onEndReachedThreshold={0.45}
  onEndReached={() => {
    void loadMoreCommunity186L();
  }}
      style={shared.screen} contentContainerStyle={s.content} data={
      communityFeedRows
    } keyExtractor={(i: any)=>i.id} extraData={communityAdExtraData} onViewableItemsChanged={onCommunityAdViewableItemsChanged} viewabilityConfig={communityAdViewabilityConfig} /* PATCH_186L_R3_PULL_REFRESH_PAGE_ZERO */
    refreshing={busy}
    onRefresh={refreshCommunity186L}
  ListHeaderComponent={<BuklodFocusFadeUp duration={240} fromY={10} fromOpacity={0.78}><View>
  {focusPostId && (focusLoading || focusUnavailable) && (
   <Text accessibilityRole="text" style={{color:focusUnavailable?'#9A3F22':colors.greenDark,fontWeight:'700',marginBottom:10}}>
    {focusUnavailable
      ? 'This post is unavailable, deleted, or outside your allowed audience.'
      : 'Opening the selected post in Wall…'}
   </Text>
  )}
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
    <Pressable
     accessibilityRole="button"
     accessibilityLabel="Open My Bible"
     accessibilityHint="Opens the complete Bible reader with book and chapter selection"
     onPress={()=>
      router.push('/bible/read?source=my_bible' as any)
     }
     style={({pressed})=>({
      width:42,
      height:42,
      borderRadius:12,
      alignItems:'center',
      justifyContent:'center',
      backgroundColor:'#3DDC4A',
      opacity:pressed?0.72:1,
     })}
    >
     <MaterialCommunityIcons
      name="book-open-variant"
      size={23}
      color="#FFFFFF"
     />

    </Pressable>
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

    {/* BUKLOD_DZAS_WALL_SHORTCUT_R1 */}
    <Pressable
     accessibilityRole="button"
     accessibilityLabel="Open 702 DZAS Radio"
     onPress={()=>
      router.push(
       '/personal-home/radio' as any
      )
     }
     style={({pressed})=>({
      minWidth:68,
      height:42,
      borderRadius:12,
      paddingHorizontal:10,
      flexDirection:'row',
      alignItems:'center',
      justifyContent:'center',
      gap:5,
      borderWidth:1,
      borderColor:colors.line,
      backgroundColor:colors.white,
      opacity:pressed?0.72:1,
     })}
    >
     <MaterialCommunityIcons
      name="radio"
      size={16}
      color={colors.green}
     />
     <Text
      style={{
       fontSize:10,
       fontWeight:'900',
       color:colors.green,
      }}
     >
      DZAS
     </Text>
    </Pressable>

   </View>

   {Platform.OS !== 'web' ? (
    <BuklodCommunityWallProfileBubbles />
   ) : null}

   <BuklodFirstViewAd
    placement="community_entry"
    placementId="public_wall_entry"
   />

   {/* BUKLOD_LIFE_WALL_ENTRY_R1 */}
   <BuklodLifeWallCard />

   {/* Home-only BUKLOD Today; story remains a Community Wall post card. */}
   <KabihasnangLigawWallCard />

   <BuklodMaritesBoard
    playbackBlocked={commentOpen}
    visibilityRefreshRef={maritesVisibilityRefreshRef}
    onOpenComments={(postId, story) => void openComments({ id: postId, author_name: story.author_name, user_id: story.user_id, body: story.body, avatar_url: story.avatar_url })}
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
   <SectionTitle>SHARE SOMETHING</SectionTitle><Card style={{ backgroundColor: wallComposerTone.surface, borderColor: wallComposerTone.border }}>
<BuklodMentionField
 focusRef={composerInputRef}
 value={body}
 onChangeText={setBody}
 mentions={mentions}
 onMentionsChange={setMentions}
 audience={audience}
 groupId={audience==='group'?group?.id??null:null}
 excludeUserId={user?.id}
 placeholder={
  composerIntent==='ask'
   ? 'Ano ang gusto mong itanong sa Community?'
   : composerIntent==='need_help'
    ? 'Anong tulong ang kailangan mo?'
    : composerIntent==='offer'
     ? 'Ano ang maitutulong o maibabahagi mo?'
     : 'Share with your Community...'
 }
 style={s.area}
/>
    <View
      /* PATCH_154L_COMPOSER_SPACING */
      style={[
        s.row,
        {
          marginBottom: 14,
        },
      ]}
    >
     <Pressable
      style={({ pressed }) => [s.tool, { backgroundColor: wallGalleryTone.soft, borderColor: wallGalleryTone.border }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      disabled={busy || videoBusy186O}
      onPress={()=>void pickWallGallery186O()}
     >
      <MaterialCommunityIcons name="image-multiple-outline" size={17} color={wallGalleryTone.ink}/>
      <Text style={[s.toolText, { color: wallGalleryTone.ink }]}>
       {videoBusy186O
        ? 'Preparing...'
        : 'Gallery'}
      </Text>
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
    <Text style={[shared.muted,{marginBottom:8,fontSize:10}]}>
      1 video and up to {COMMUNITY_MAX_PHOTOS} photos. Tap a photo to open it. Hold a photo to edit or remove it. Video up to 1 GB / 30 min.
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
       <Pressable onPress={()=>setComposerVideoOpen(true)}>
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
       </Pressable>
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
     <View style={{marginBottom:10}}>
      <BuklodCommunityPhotoCollage
       items={photos.map(photo=>({
        media_url:photo.uri,
       }))}
       width={Dimensions.get('window').width-64}
       height={220}
       contentFit="cover"
       preserveSinglePhotoAspectRatio
       onPressPhoto={(index, items)=>
        openPhotoViewer(items, index)
       }
       onLongPressPhoto={index=>{
        const photo=photos[index];
        if(photo){
         openComposerPhotoActions(photo);
        }
       }}
      />
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

   <View
    style={{
     flexDirection:'row',
     gap:7,
     marginTop:4,
     marginBottom:8,
    }}
   >
    {COMMUNITY_FEED_TABS.map(tab=>{
     const selected=
      communityFeedMode===tab.key;

     return (
      <Pressable
       key={tab.key}
       accessibilityRole="button"
       accessibilityState={{selected}}
       onPress={()=>
        selectCommunityFeedMode(
         tab.key
        )
       }
       style={({pressed})=>({
        flex:1,
        minHeight:36,
        borderRadius:12,
        borderWidth:1,
        borderColor:
         selected
          ? colors.green
          : colors.line,
        backgroundColor:
         selected
          ? colors.green
          : colors.white,
        alignItems:'center',
        justifyContent:'center',
        opacity:pressed?0.76:1,
       })}
      >
       <Text
        style={{
         fontSize:10,
         fontWeight:'900',
         color:
          selected
           ? '#FFFFFF'
           : colors.greenDark,
        }}
       >
        {tab.label}
       </Text>
      </Pressable>
     );
    })}
   </View>

   <SectionTitle>
    {communityFeedMode==='following'
      ? 'FOLLOWING POSTS'
      : communityFeedMode==='latest'
       ? 'LATEST POSTS'
       : 'COMMUNITY POSTS'}
   </SectionTitle>
  </View></BuklodFocusFadeUp>}
  ListEmptyComponent={
   <Card>
    <Text style={shared.muted}>
     {communityFeedMode==='following'
       ? 'No posts from people you follow yet.'
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
    <Card style={focusPostId===String(item.id)?{borderColor:colors.green,borderWidth:2}:undefined}>
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
     <View
      style={{
       flexDirection:'row',
       alignItems:'center',
       gap:6,
      }}
     >
      {!!item.user_id&&(
       <Pressable
        accessibilityRole="button"
        accessibilityLabel={
         item.is_following_author
          ? 'Unfollow this member'
          : item.author_follows_viewer
           ? 'Follow back this member'
           : 'Follow this member'
        }
        onPress={()=>
         void toggleAuthorFollow(
          String(item.user_id),
          !item.is_following_author
         )
        }
        style={({pressed})=>({
         minHeight:32,
         paddingHorizontal:10,
         borderRadius:999,
         borderWidth:1,
         borderColor:colors.green,
         backgroundColor:
          item.is_following_author
           ? colors.green
           : colors.white,
         alignItems:'center',
         justifyContent:'center',
         opacity:pressed?0.72:1,
        })}
       >
        <Text
         style={{
          fontSize:8.5,
          fontWeight:'900',
          color:
           item.is_following_author
            ? '#FFFFFF'
            : colors.greenDark,
         }}
        >
         {item.is_following_author
          ? 'FOLLOWING'
          : item.author_follows_viewer
           ? 'FOLLOW BACK'
           : 'FOLLOW'}
        </Text>
       </Pressable>
      )}
      <BuklodContentOverflowMenu
       title="Post"
       iconColor={colors.muted}
       onReport={() =>
        openReport('post', item.id)
       }
      />
     </View>
    )}
   </View>
    </View>
   </View>
   </View>
   <BuklodExpandableWallCaption
    key={String(item.id)}
    text={String(repairMojibakeText(item.body) ?? '').replace(
     /^Shared from [^\r\n]+(?:\r?\n\s*|$)+/i,
     ''
    )}
    style={s.body}
    knownNames={ms.map((mention:any)=>String(mention.full_name??''))}
   />
   {!!ms.filter((mention:any)=>!String(item.body??'').toLowerCase().includes(`@${String(mention.full_name??'').toLowerCase()}`)).length&&(
    <BuklodMentionText
     text={ms.filter((mention:any)=>!String(item.body??'').toLowerCase().includes(`@${String(mention.full_name??'').toLowerCase()}`)).map((mention:any)=>`@${mention.full_name}`).join(' ')}
     style={s.mentioned}
    />
   )}

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
{/* BUKLOD_COMMUNITY_VIDEO_FULLSCREEN_SWIPE_R4 */}
 <Modal
  visible={videoViewerOpen}
  animationType="fade"
  onRequestClose={
   closeVideoViewer
  }
 >
  <GestureHandlerRootView
   style={{flex:1}}
   unstable_forceActive
  >
   <View
    style={{
     flex:1,
     backgroundColor:'#000000'
    }}
   >
    <GestureFlatList
     key={
      'video-viewer-'+
       videoViewerSession
     }
     style={{
      flex:1,
      width:'100%'
     }}
     data={videoViewerPosts}
     keyExtractor={(post,index)=>
      String(
       post?.id??
       index
      )
     }
     pagingEnabled
     snapToInterval={COMMUNITY_VIEWER_HEIGHT}
     snapToAlignment="start"
     decelerationRate="fast"
     showsVerticalScrollIndicator={false}
     initialScrollIndex={
      Math.min(
       videoViewerIndex,
       Math.max(
        0,
        videoViewerPosts.length-1
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
       Math.max(
        0,
        Math.min(
         Math.round(
          event.nativeEvent
           .contentOffset.y/
          COMMUNITY_VIEWER_HEIGHT
         ),
         videoViewerPosts.length-1
        )
       );

      setVideoViewerIndex(
       nextIndex
      );

      const nextPost=
       videoViewerPosts[
        nextIndex
       ];

      if(nextPost){
       void refreshVideoViewerUrl(
        nextPost
       );
      }
       if(nextIndex>=videoViewerPosts.length-3 &&
          videoViewerPosts.length<COMMUNITY_VIDEO_DISCOVERY_LIMIT){
        void loadMoreVideoViewer();
       }
     }}
      onEndReached={()=>{
       if(videoViewerOpen && videoViewerPosts.length<COMMUNITY_VIDEO_DISCOVERY_LIMIT){
        void loadMoreVideoViewer();
       }
      }}
      onEndReachedThreshold={0.8}
     renderItem={({item,index})=>{
      const descriptor=
       communityWallVideoDescriptor(
        item
       );

      const postId=
       String(
        item?.id??
        ''
       );

      const fullscreenUri=
       String(
        videoViewerFreshUrls[
         postId
        ]??
        descriptor?.uri??
        ''
       ).trim();

      if(!descriptor||!fullscreenUri){
       return (
        <View
         style={{
          width:'100%',
          height:
           COMMUNITY_VIEWER_HEIGHT,
          backgroundColor:'#000000'
         }}
        />
       );
      }

      return (
       <View
        style={{
         width:'100%',
         height:
          COMMUNITY_VIEWER_HEIGHT,
         backgroundColor:'#000000',
         alignItems:'center',
         justifyContent:'center'
        }}
       >
        <CommunityVideo
         key={
          postId+
          ':'+
          fullscreenUri
         }
         uri={
          fullscreenUri
         }
         height={COMMUNITY_VIEWER_HEIGHT}
         fullscreen
         active={
          index===
          videoViewerIndex
         }
         autoPlay={
          index===
          videoViewerIndex
         }
         controlsBottomInset={
          Math.max(
           communityInsets.bottom+168,
           188
          )
         }
         expectedDurationSeconds={
          descriptor.durationSeconds
         }
         onPlaybackError={()=>{
          void refreshVideoViewerUrl(
           item
          );
         }}
        />

        {videoViewerResolvingPostId===
         postId&&(
         <View
          pointerEvents="none"
          style={{
           position:'absolute',
           top:'48%',
           alignSelf:'center',
           paddingHorizontal:12,
           paddingVertical:7,
           borderRadius:16,
           backgroundColor:
            'rgba(0,0,0,.46)'
          }}
         >
          <Text
           style={{
            color:'#FFFFFF',
            fontSize:10,
            fontWeight:'800'
           }}
          >
           Refreshing videoâ€¦
          </Text>
         </View>
        )}
       </View>
      );
     }}
    />

    <View
     style={[
      s.communityViewerTop,
      {
       pointerEvents:'box-none'
      } as any
     ]}
    >
     <Text
      style={
       s.communityViewerCount
      }
     >
      {videoViewerIndex+1}
      {' / '}
      {videoViewerPosts.length}
     </Text>

     <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close full screen video"
      onPress={
       closeVideoViewer
      }
      style={
       s.communityViewerClose
      }
     >
      <MaterialCommunityIcons
       name="close"
       size={27}
       color="#FFFFFF"
      />
     </Pressable>
    </View>

    {!!videoViewerPosts[
      videoViewerIndex
    ]&&(()=>{
     const activePost=
      videoViewerPosts[
       videoViewerIndex
      ];
     const counts=
      activePost?.reaction_counts||
      {};

     return (
      <View
       style={{
        position:'absolute',
        left:8,
        right:8,
        bottom:
         Math.max(
          communityInsets.bottom+
           (Platform.OS==='web'
            ? 78
            : 72),
          84
         ),
        paddingHorizontal:8,
        paddingTop:4,
        paddingBottom:4,
        borderRadius:14,
        /* BUKLOD_VIDEO_VIEWER_NO_CONTROL_OVERLAP_R6 */
        backgroundColor:
         'rgba(0,0,0,.16)',
        borderWidth:0
       }}
      >
       <Text
        numberOfLines={1}
        style={{
         marginBottom:2,
         color:'#FFFFFF',
         textShadowColor:'rgba(0,0,0,.55)',
         textShadowRadius:3,
         fontSize:12,
         fontWeight:'900'
        }}
       >
        {resolvePersonDisplayName(
         activePost.author_name,
         activePost.user_id,
        )}
       </Text>

       {!!String(
        repairMojibakeText(
         activePost.body
        )??''
       ).trim()&&(
        <Text
         numberOfLines={2}
         style={{
          marginBottom:4,
          color:'rgba(255,255,255,.88)',
          textShadowColor:'rgba(0,0,0,.55)',
          textShadowRadius:3,
          fontSize:10.5,
          lineHeight:14
         }}
        >
         {String(
          repairMojibakeText(
           activePost.body
          )??''
         )}
        </Text>
       )}

       <BuklodCommunityPostEngagement
        reactionOptions={
         BUKLOD_PUBLIC_COMMUNITY_REACTIONS
        }
        reactionCounts={counts}
        myReaction={
         activePost.my_reaction
        }
        commentCount={
         activePost.comment_count
        }
        commentPreview={null}
        onReactionSummaryPress={key =>
         openReactionDetails(
          activePost,
          key
         )
        }
        onReact={key=>{
         void react(
          activePost.id,
          key as Reaction
         );
        }}
        onOpenComments={()=>
         openComments(
          activePost
         )
        }
        showCommentAction
        rightAction={
         <BuklodPostInternalShare
          postId={
           activePost.id
          }
          compact
          iconOnly
         />
        }
       />
      </View>
     );
    })()}

    {videoViewerPosts.length>1&&(
     <Text
      style={[
       s.communityViewerHint,
       {
        bottom:
         Math.max(
          communityInsets.bottom+118,
          Platform.OS==='android'
           ? 158
           : 128
         )
       }
      ]}
     >
      Swipe vertically for next video
     </Text>
    )}

    {videoViewerIndex>=videoViewerPosts.length-2 &&
     videoViewerPosts.length<COMMUNITY_VIDEO_DISCOVERY_LIMIT &&
     (videoViewerHasMore||videoViewerLoadingMore||videoViewerLoadError)&&(
     <Pressable
      accessibilityRole="button"
      disabled={videoViewerLoadingMore}
      onPress={()=>void loadMoreVideoViewer()}
      style={{
       position:'absolute',top:100,alignSelf:'center',
       paddingHorizontal:14,paddingVertical:8,
       backgroundColor:'rgba(0,0,0,.62)',borderRadius:16,
      }}
     >
      <Text style={{color:'#FFFFFF',fontSize:12,fontWeight:'700'}}>
       {videoViewerLoadingMore
        ? 'Finding recent videos...'
        : videoViewerLoadError
         ? 'Could not load more — tap to retry'
         : 'Load more recent videos'}
      </Text>
     </Pressable>
    )}
   </View>
  </GestureHandlerRootView>
 </Modal>

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
         {' · '}
         {commentLoading&&!comments.length?'…':comments.length}
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
      contentContainerStyle={s.communityCommentList}
     >
      {!!commentLoadError&&(
       <View style={{
        padding:12,borderRadius:12,backgroundColor:'#FFF1E5',
        flexDirection:'row',alignItems:'center',gap:10,
       }}>
        <Text style={{flex:1,color:'#8E4A1E',fontSize:12}}>
         {commentLoadError}
        </Text>
        <Pressable
         accessibilityRole="button"
         accessibilityLabel="Retry loading comments"
         onPress={()=>commentPost?.id&&void loadComments(String(commentPost.id))}
         style={{paddingHorizontal:12,paddingVertical:8,borderRadius:10,backgroundColor:'#FFFFFF'}}
        >
         <Text style={{fontWeight:'800',color:'#8E4A1E'}}>Retry</Text>
        </Pressable>
       </View>
      )}
      {commentLoading&&!comments.length?(
       <View style={{paddingVertical:36,alignItems:'center',gap:12}}>
        <ActivityIndicator size="small" color={colors.green}/>
        <Text style={{color:colors.muted}}>Loading comments…</Text>
       </View>
      ):comments.length?(
      <BuklodCommunityCommentThread
       comments={comments}
       currentUserId={user?.id}
       reactionOptions={
        BUKLOD_PUBLIC_COMMUNITY_REACTIONS
       }
       formatTime={formatSpecificDateTime}
       formatMeta={c=>{
        const meta=formatClusterName(
         (c as any).cluster_name
        );
        return meta||null;
       }}
       onReply={(target)=>{
        const replyName=resolvePersonDisplayName(
         target.commenter_name,target.user_id
        );
        setReplyTo(target);
        // A reply banner provides context; don't prefill a sendable @name-only draft.
        setCommentMentions(current=>[
         ...current.filter(item=>item.user_id!==String(target.user_id)),
         {user_id:String(target.user_id),full_name:String(replyName)},
        ]);
       }}
       onReact={(c,key)=>
        void reactToComment(
         c,
         key as Reaction
        )
       }
       onReactionSummaryPress={(c,key)=>
        openCommentReactionDetails(
         c,
         key
        )
       }
       onEdit={(commentId,body)=>
        updateCommentBody(
         commentId,
         body
        )
       }
       onDelete={commentId=>
        deleteCommentById(
         commentId
        )
       }
       onReport={commentId=>
        openReport(
         'comment',
         commentId
        )
       }
      />

      ):!commentLoadError?(
       <View style={{paddingVertical:48,alignItems:'center',gap:10}}>
        <MaterialCommunityIcons name="comment-outline" size={34} color={colors.green}/>
        <Text style={{color:colors.muted,textAlign:'center',fontSize:13}}>
         No comments yet. Be the first to respond.
        </Text>
       </View>
      ):null}
     </ScrollView>


     {!!replyTo&&(
      <View style={s.communityReplyBanner}>
       <View style={{flex:1}}>
        <Text style={s.communityReplyBannerLabel}>
         Replying to
        </Text>
        <Text
         numberOfLines={1}
         style={s.communityReplyBannerName}
        >
         {resolvePersonDisplayName(
          replyTo.commenter_name,
          replyTo.user_id,
         )}
        </Text>
        <Text
         numberOfLines={2}
         style={{
          marginTop:2,
          fontSize:11,
          color:colors.muted,
         }}
        >
         {String(replyTo.body||'').trim()}
        </Text>
       </View>

       <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
        onPress={()=>{
         setCommentMentions(current=>current.filter(
          mention=>mention.user_id!==String(replyTo.user_id)
         ));
         setReplyTo(null);
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

     {!!commentNotice&&(
      <View
       accessible
       accessibilityLiveRegion="polite"
       style={{
        paddingHorizontal:14,paddingVertical:7,
        backgroundColor:commentNotice.startsWith('Comment not posted')
         ? '#FFF1E5' : '#E8F5EE',
       }}
      >
       <Text style={{
        fontSize:12,fontWeight:'700',
        color:commentNotice.startsWith('Comment not posted')
         ? '#8E4A1E' : colors.greenDark,
       }}>
        {commentNotice}
       </Text>
      </View>
     )}
     <BuklodCommunityCommentComposer
      value={commentText}
      onChangeText={next=>{
       setCommentText(next);
       if(commentNotice)setCommentNotice(null);
      }}
      mentions={commentMentions}
      onMentionsChange={setCommentMentions}
      audience={audience}
      groupId={audience==='group'?group?.id??null:null}
      excludeUserId={user?.id}
      placeholder={
       replyTo
        ? 'Write a reply...'
        : 'Write a comment...'
      }
      busy={commentBusy}
      layout="stacked"
      focusRequestKey={replyTo?.id??null}
      media={commentMedia}
      mediaPreviewUri={commentMediaPreview}
      onMediaChange={(next,preview)=>{
       setCommentNotice(null);
       setCommentMedia(next);
       setCommentMediaPreview(preview??null);
      }}
      onSend={()=>
       void submitCommunityComment()
      }
     />

    </View>
   </View>
  </KeyboardAvoidingView>
 </Modal>


 <Modal
  visible={composerVideoOpen&&!!wallVideo186O}
  animationType="fade"
  onRequestClose={()=>setComposerVideoOpen(false)}
 >
  <View style={{flex:1,backgroundColor:'#000',justifyContent:'center'}}>
   {!!wallVideo186O&&(
    <CommunityVideo
     uri={wallVideo186O.uri}
     height={Math.min(520, Dimensions.get('window').height*0.7)}
    />
   )}
   <Pressable
    onPress={()=>setComposerVideoOpen(false)}
    style={{position:'absolute',top:48,right:16}}
   >
    <MaterialCommunityIcons name="close" size={28} color="#FFFFFF"/>
   </Pressable>
  </View>
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



