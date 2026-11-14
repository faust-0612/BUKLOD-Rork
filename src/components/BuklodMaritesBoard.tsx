import { buklodVisual } from '@/lib/buklodVisual';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  BuklodFocusFadeUp,
} from '@/components/HomeMotion';
import {
  BuklodTappableAvatar,
} from '@/components/BuklodTappableAvatar';
import BuklodMaritesPhotoCollage from '@/components/BuklodMaritesPhotoCollage';
import BuklodPostMusicPicker from '@/components/BuklodPostMusicPicker';
import BuklodMaritesStoryAudio, { type MaritesMusicPlaybackState } from '@/components/BuklodMaritesStoryAudio';
import { loadBuklodPostCreatives, type BuklodPostMusicTrack } from '@/lib/buklodPostCreatives';
import { BuklodComposerPhotoEditSheet } from '@/components/BuklodComposerPhotoEditSheet';
import {
  BuklodPhotoEditor,
  type BuklodPhotoEditorTool,
} from '@/components/BuklodPhotoEditor';
import {
  BuklodContentOverflowMenu,
} from '@/components/BuklodContentOverflowMenu';
import {
  deleteCommunityPost,
  saveCommunityPostEdit,
  setCommunityPostAuthorOnly,
  updateCommunityPost,
  type CommunityEditPhoto,
} from '@/lib/buklodCommunityPostOwnerActions';
import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';
import {
  BUKLOD_PUBLIC_COMMUNITY_REACTIONS,
  rememberCommunityReaction,
} from '@/components/BuklodReactionAction';
import {
  deleteMaritesStory,
  filterMaritesStoriesForViewer,
  isActiveMaritesStory,
  getMaritesStoryPhotos,
  isCommunityMaritesStory,
  isMaritesEmojiOnlyBody,
  loadAllMaritesStories,
  loadMaritesStories,
  mergeMaritesStories,
  type MaritesLoadResult,
  MARITES_MAX_CHARS,
  MARITES_MAX_PHOTOS,
  MARITES_QUICK_EMOJI,
  maritesAgeLabel,
  publishMaritesStory,
  setMaritesStoryAuthorOnly,
  setMaritesStoryReaction,
  sumMaritesReactionCounts,
  topMaritesReactionKey,
  updateMaritesStory,
  withMaritesPostMarker,
  parseCommunityMaritesPostId,
  type MaritesStory,
} from '@/lib/buklodMaritesBoard';
import {
  resolveMaritesVisibleRows,
} from '@/lib/buklodMaritesFeedPages';
import {
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from 'expo-router';
import { selectVisibleMaritesVideo, quickVideoDurationSeconds } from '@/lib/buklodMaritesPlayback';
import { createMaritesVisibilityScheduler } from '@/lib/buklodMaritesViewportMeasure';
import { useAuth } from '@/providers/AuthProvider';
import { subscribeBuklodPublicPostChanges } from '@/lib/buklodPublicCommunityRealtime';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import {
  GestureHandlerRootView,
  ScrollView as GestureScrollView,
} from 'react-native-gesture-handler';
import {
  BuklodZoomablePhoto,
} from '@/components/BuklodZoomablePhoto';

type Props = {
  /** Reserved for future scoped RPC filter. */
  locationScopeId?: string | null;
  playbackBlocked?: boolean;
  /** Parent Wall pauses media while a fullscreen Marites story owns playback. */
  onViewerVisibilityChange?: (visible: boolean) => void;
  visibilityRefreshRef?: React.MutableRefObject<(() => void) | null>;
  onOpenComments?: (postId: string, story: MaritesStory) => void;
};

function useMaritesPlaybackActive() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  return focused && foreground;
}

function MaritesQuickVideo({ uri, autoPlay = false, muted = false }: { uri: string; autoPlay?: boolean; muted?: boolean }) {
  const active = useMaritesPlaybackActive();
  // Cache only remote video bytes; preserve local picker and browser playback.
  const source = useMemo(
    () => Platform.OS !== 'web' && /^https?:\/\//i.test(uri)
      ? { uri, useCaching: true }
      : uri,
    [uri],
  );
  const player = useVideoPlayer(source, instance => {
    instance.audioMixingMode = 'mixWithOthers';
    instance.showNowPlayingNotification = false;
    instance.staysActiveInBackground = false;
    instance.loop = autoPlay;
    instance.muted = muted;
  });
  const [status, setStatus] = useState<string>(() => player.status);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setStatus(player.status);
    const subscription = player.addListener('statusChange', event => {
      setStatus(event.status);
    });
    return () => subscription.remove();
  }, [player]);
  useEffect(() => {
    player.muted = muted;
    if (autoPlay && active) player.play();
    else player.pause();
  }, [player, autoPlay, muted, active]);
  useEffect(() => {
    setSlow(false);
    if (status === 'readyToPlay' || status === 'error' || !active) return;
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(timer);
  }, [status, uri, active]);
  // A failed/expired URL used to look exactly like an empty black story.
  // Keep the video mounted only while visible, but always surface its state.
  return (
    <View style={{ flex: 1, backgroundColor: '#151515' }}>
      <VideoView player={player} nativeControls={!autoPlay && active} contentFit="contain" style={{ width: '100%', height: '100%' }} />
      {(status === 'error' || (active && status !== 'readyToPlay')) && (
        <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          {status === 'error' ? (
            <MaterialCommunityIcons name="alert-circle-outline" size={27} color="#FFFFFF" />
          ) : !slow ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <MaterialCommunityIcons name="wifi-alert" size={27} color="#FFFFFF" />
          )}
          <Text style={{ color: '#FFFFFF', marginTop: 8, textAlign: 'center', fontSize: 12, fontWeight: '700' }}>
            {status === 'error' ? 'Video unavailable' : slow ? 'Video is taking longer to load' : 'Loading video…'}
          </Text>
        </View>
      )}
    </View>
  );
}

type MaritesComposerPhoto = {
  id: string;
  uri: string;
};

/*
 * MARITES_COMPACT_STABLE_R20
 *
 * Keep the lightweight story strip warm across Community Wall remounts.
 * Stories are short-lived already, so a small freshness window prevents
 * repeated remote/media signing work without turning this into durable state.
 */
const MARITES_COMPACT_CARD_WIDTH = buklodVisual.size.storyWidth;
const MARITES_COMPACT_CARD_HEIGHT = buklodVisual.size.storyHeight;
const MARITES_COMPACT_FOOTER_HEIGHT = 40;
const MARITES_MEMORY_FRESH_MS = 20_000;

type MaritesMemoryEntry = {
  rows: MaritesStory[];
  remoteUpdatedAt: number;
};

const maritesMemory = new Map<string, MaritesMemoryEntry>();
const maritesRefreshes = new Map<string, Promise<MaritesLoadResult>>();

function maritesMemoryKey(
  locationScopeId: string | null | undefined,
  userId: string | null | undefined
) {
  return `${locationScopeId || 'public'}:${userId || 'anonymous'}`;
}

function storyEditPhotos(story: MaritesStory): CommunityEditPhoto[] {
  const uris = getMaritesStoryPhotos(story);
  const paths = story.photo_paths ?? [];

  return uris.map((uri, index) => ({
    id: `${paths[index] || uri}-${index}`,
    uri,
    mediaPath: paths[index] || null,
  }));
}

function createStyles(
  colors: ReturnType<
    typeof useBuklodPresentation
  >['colors']
) {
  return StyleSheet.create({
    section: {
      marginTop: 2,
      marginBottom: 8,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 6,
    },
    headingActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 7,
      flexShrink: 1,
    },
    title: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: colors.greenDark,
    },
    hint: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      flexShrink: 1,
    },
    shareButton: {
      minHeight: buklodVisual.size.touch,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: `${colors.green}10`,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      flexShrink: 0,
    },
    shareButtonText: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.greenDark,
    },
    row: {
      paddingRight: 8,
      gap: 7,
    },
    cardShell: {
      flexShrink: 0,
    },
    storyCard: {
      width: MARITES_COMPACT_CARD_WIDTH,
      height: MARITES_COMPACT_CARD_HEIGHT,
      borderRadius: buklodVisual.radius.card,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: `${colors.green}10`,
      overflow: 'hidden',
    },
    cardMenuBtn: {
      position: 'absolute',
      top: 5,
      right: 5,
      zIndex: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    storyPhotoFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.line,
    },
    mediaFill: {
      ...StyleSheet.absoluteFill,
    },
    emojiFillText: {
      width: '100%',
      height: '100%',
      fontSize: 56,
      lineHeight: 64,
      textAlign: 'center',
      textAlignVertical: 'center',
      includeFontPadding: false,
    },
    textFill: {
      ...StyleSheet.absoluteFill,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 34,
      justifyContent: 'center',
    },
    bodyFill: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    photoCaption: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 44,
      justifyContent: 'flex-end',
    },
    photoCaptionText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.65)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    authorFooter: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: MARITES_COMPACT_FOOTER_HEIGHT,
      paddingHorizontal: 6,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.94)',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    authorFooterOnPhoto: {
      // Author metadata overlays the FULL media; no gray/opaque image truncation.
      backgroundColor: 'rgba(8, 16, 12, 0.16)',
      borderTopWidth: 0,
    },
    authorName: {
      flex: 1,
      fontSize: 11,
      fontWeight: '900',
      color: colors.text,
    },
    authorNameOnPhoto: {
      color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.9)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    age: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.muted,
    },
    ageOnPhoto: {
      color: 'rgba(255,255,255,0.82)',
    },
    reactionPill: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.greenDark,
      marginLeft: 1,
    },
    reactionPillOnPhoto: {
      color: '#FFFFFF',
    },
    viewReactions: {
      marginTop: 12,
      marginBottom: 4,
    },
    fullscreen: {
      flex: 1,
      backgroundColor: '#050807',
    },
    fullscreenTapArea: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenPhotoWrap: {
      flex: 1,
      width: '100%',
    },
    fullscreenPhoto: {
      width: '100%',
      height: '100%',
    },
    fullscreenPhotoPage: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 72,
      paddingBottom: 128,
      paddingHorizontal: 10,
    },
    fullscreenEmoji: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    fullscreenEmojiText: {
      fontSize: 120,
      lineHeight: 132,
      textAlign: 'center',
    },
    fullscreenTextWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    fullscreenBodyText: {
      fontSize: 22,
      lineHeight: 30,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    fullscreenFooter: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 48,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    fullscreenFooterText: {
      color: '#FFFFFF',
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '700',
      marginBottom: 10,
    },
    fullscreenMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    fullscreenAuthor: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    fullscreenMeta: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
    },
    fullscreenHeader: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    fullscreenHeaderBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    fullscreenStoryNav: {
      position: 'absolute',
      left: 10,
      right: 10,
      top: '46%',
      zIndex: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fullscreenStoryNavBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.48)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    fullscreenReactionDock: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 110,
      zIndex: 30,
      alignItems: 'flex-start',
    },
    fullscreenHint: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      alignItems: 'center',
      zIndex: 15,
    },
    fullscreenHintText: {
      marginTop: 8,
      color: 'rgba(255,255,255,0.72)',
      fontSize: 10,
      fontWeight: '700',
    },
    emptyNote: {
      marginTop: 5,
      fontSize: 8.5,
      fontWeight: '600',
      color: colors.muted,
      lineHeight: 12,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(8, 16, 12, 0.52)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '88%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.white,
      paddingHorizontal: 8,
      paddingTop: 14,
      paddingBottom: 24,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      minHeight: 104,
      textAlignVertical: 'top',
    },
    charCount: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      textAlign: 'right',
    },
    emojiRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
      marginBottom: 10,
    },
    emojiChip: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    emojiText: {
      fontSize: 18,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    toolBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
    },
    toolText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.greenDark,
    },
    previewPhoto: {
      width: 88,
      height: 88,
      borderRadius: 12,
      backgroundColor: colors.line,
    },
    composerPhotoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    composerPhotoWrap: {
      width: 88,
      height: 88,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.line,
    },
    composerPhotoRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    composerPhotoHint: {
      marginTop: -4,
      marginBottom: 10,
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      lineHeight: 13,
    },
    viewPhotoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    viewPhotoTile: {
      width: '48%',
      height: 140,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.line,
    },
    viewPhotoImage: {
      width: '100%',
      height: '100%',
    },
    postBtn: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postBtnText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    viewBody: {
      fontSize: 16,
      lineHeight: 23,
      color: colors.text,
      marginBottom: 10,
    },
    viewPhoto: {
      width: '100%',
      height: 220,
      borderRadius: 14,
      marginBottom: 10,
      backgroundColor: colors.line,
    },
    localBadge: {
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: `${colors.green}12`,
    },
    localBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      lineHeight: 13,
    },
  });
}

function MaritesStoryCard({
  story,
  colors,
  onPress,
  menu,
  onComments,
  autoPlayVideo = false,
}: {
  story: MaritesStory;
  autoPlayVideo?: boolean;
  colors: ReturnType<
    typeof useBuklodPresentation
  >['colors'];
  onPress: () => void;
  menu?: React.ReactNode;
  onComments?: () => void;
}) {
  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const hasPhoto = getMaritesStoryPhotos(story).length > 0;
  const hasVideo = Boolean(story.video_uri);
  const hasMedia = hasPhoto || hasVideo;
  const photoUris = getMaritesStoryPhotos(story);
  const body = story.body.trim();
  const emojiOnly =
    !hasPhoto && isMaritesEmojiOnlyBody(body);
  const displayName = resolvePersonDisplayName(
    story.author_name,
    story.user_id
  );
  const age = maritesAgeLabel(story.created_at);
  const reactionTotal = sumMaritesReactionCounts(
    story.reaction_counts
  );
  const topReactionKey = topMaritesReactionKey(
    story.reaction_counts
  );
  const topReactionEmoji =
    BUKLOD_PUBLIC_COMMUNITY_REACTIONS.find(
      (option) => option.key === topReactionKey
    )?.emoji ?? null;

  return (
    <View style={styles.storyCard}>
    <Pressable
      onPress={onPress}
      style={StyleSheet.absoluteFill}
    >
      {hasVideo && <View style={styles.storyPhotoFill}>{autoPlayVideo ? <MaritesQuickVideo uri={story.video_uri!} autoPlay muted /> : <View style={{ flex: 1, backgroundColor: '#151515', alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="play-circle-outline" size={44} color="#fff" /></View>}</View>}
      {hasPhoto && !hasVideo && (
        <BuklodMaritesPhotoCollage
          uris={photoUris}
          mediaPaths={story.photo_paths}
          width={MARITES_COMPACT_CARD_WIDTH}
          height={MARITES_COMPACT_CARD_HEIGHT}
          style={styles.storyPhotoFill}
        />
      )}

      {!hasPhoto && !hasVideo && emojiOnly && (
        <View style={styles.mediaFill}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.3}
            numberOfLines={4}
            style={styles.emojiFillText}
          >
            {body}
          </Text>
        </View>
      )}

      {!hasPhoto && !hasVideo && !emojiOnly && !!body && (
        <View style={styles.textFill}>
          <Text
            numberOfLines={6}
            style={styles.bodyFill}
          >
            {body}
          </Text>
        </View>
      )}

      {hasPhoto && !!body && (
        <View style={styles.photoCaption}>
          <Text
            numberOfLines={3}
            style={styles.photoCaptionText}
          >
            {body}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.authorFooter,
          hasMedia && styles.authorFooterOnPhoto,
        ]}
        onStartShouldSetResponder={() => true}
      >
        <BuklodTappableAvatar
          userId={story.user_id}
          uri={story.avatar_url}
          name={story.author_name}
          size={20}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.authorName,
            hasMedia && styles.authorNameOnPhoto,
          ]}
        >
          {displayName}
        </Text>
        <Text
          style={[
            styles.age,
            hasMedia && styles.ageOnPhoto,
          ]}
        >
          {story.author_only ? 'Ako lang · ' : ''}
          {age}
        </Text>
        {reactionTotal > 0 && topReactionEmoji ? (
          <Text
            style={[
              styles.reactionPill,
              hasMedia && styles.reactionPillOnPhoto,
            ]}
          >
            {topReactionEmoji} {reactionTotal}
          </Text>
        ) : null}
      </View>
    </Pressable>
    {onComments ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Open story comments" onPress={onComments} style={{ position: 'absolute', right: 5, bottom: MARITES_COMPACT_FOOTER_HEIGHT + 6, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="comment-text-outline" size={21} color="#FFFFFF" />
      </Pressable>
    ) : null}
    {menu}
    </View>
  );
}

export default function BuklodMaritesBoard({
  locationScopeId,
  onOpenComments,
  playbackBlocked = false,
  onViewerVisibilityChange,
  visibilityRefreshRef,
}: Props) {
  const { user, profile } = useAuth();
  const { colors } = useBuklodPresentation();
  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );
  const cacheKey = useMemo(
    () => maritesMemoryKey(locationScopeId, user?.id),
    [locationScopeId, user?.id]
  );

  const [stories, setStories] = useState<
    MaritesStory[]
  >(() => (maritesMemory.get(cacheKey)?.rows ?? []).filter(story => isActiveMaritesStory(story)));
  const loadGenerationRef = useRef(0);
  const [composerOpen, setComposerOpen] =
    useState(false);
  const storyStripOffset = useRef(0);
  const stripViewportRef = useRef<View>(null);
  const [visibleVideoIndex, setVisibleVideoIndex] = useState(-1);
  const playbackActive = useMaritesPlaybackActive();
  const [viewStory, setViewStory] =
    useState<MaritesStory | null>(null);
  const maritesViewerVisible = viewStory !== null;
  // Includes server-expiration dismissal and programmatic close, not only Back.
  useEffect(() => {
    onViewerVisibilityChange?.(maritesViewerVisible);
  }, [maritesViewerVisible, onViewerVisibilityChange]);
  useEffect(() => () => onViewerVisibilityChange?.(false), [onViewerVisibilityChange]);
  const [storyZoomed, setStoryZoomed] =
    useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] =
    useState(false);
  const longPressHandledRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<MaritesComposerPhoto[]>(
    []
  );
  const [quickVideo, setQuickVideo] = useState<{ uri: string; durationSeconds: number; mimeType: string } | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [composerMusicTrack, setComposerMusicTrack] = useState<BuklodPostMusicTrack | null>(null);
  const [composerMusicClipStart, setComposerMusicClipStart] = useState(0);
  const [previewMusic, setPreviewMusic] = useState<{ track: BuklodPostMusicTrack; start: number } | null>(null);
  const [previewMusicStatus, setPreviewMusicStatus] = useState<MaritesMusicPlaybackState>({ playing: false, duration: 0, error: '' });
  const [viewerMusic, setViewerMusic] = useState<{ storyId: string; track: BuklodPostMusicTrack; start: number } | null>(null);
  const [viewerMusicEnabled, setViewerMusicEnabled] = useState(true);
  const [viewerMusicStatus, setViewerMusicStatus] = useState<MaritesMusicPlaybackState>({ playing: false, duration: 0, error: '' });
  const [posting, setPosting] = useState(false);
  const postingGuardRef = useRef(false);
  const [expiryTick, setExpiryTick] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoEditorSource, setPhotoEditorSource] =
    useState<MaritesComposerPhoto | null>(null);
  const [photoEditorTargetId, setPhotoEditorTargetId] =
    useState<string | null>(null);
  const [photoEditSheetPhoto, setPhotoEditSheetPhoto] =
    useState<MaritesComposerPhoto | null>(null);
  const [photoEditorInitialTool, setPhotoEditorInitialTool] =
    useState<BuklodPhotoEditorTool>('draw');

  useEffect(() => {
    const timer = setInterval(() => setExpiryTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  const activeStories = useMemo(() => stories.filter((story) => isActiveMaritesStory(story)), [stories, expiryTick]);
  // A story can expire while its fullscreen viewer is still open.
  // Close it instead of leaving expired content visible indefinitely.
  useEffect(() => {
    if (viewStory && !activeStories.some((story) => story.id === viewStory.id)) {
      setViewStory(null);
      setStoryZoomed(false);
      setReactionPickerOpen(false);
    }
  }, [activeStories, viewStory]);


  const load = useCallback(async (forceRemote = false) => {
    const generation = ++loadGenerationRef.current;
    const userId = user?.id ?? null;

    if (!userId) {
      setStories([]);
      return;
    }

    const cached = maritesMemory.get(cacheKey);

    if (cached) {
      const visibleCached = filterMaritesStoriesForViewer(
        cached.rows,
        userId
      );

      if (!forceRemote) {
        setStories(visibleCached);
      }

      if (
        !forceRemote &&
        cached.remoteUpdatedAt > 0 &&
        Date.now() - cached.remoteUpdatedAt <
          MARITES_MEMORY_FRESH_MS
      ) {
        return;
      }
    } else {
      try {
        const localRows = filterMaritesStoriesForViewer(
          await loadMaritesStories(),
          userId
        );

        if (generation !== loadGenerationRef.current) {
          return;
        }

        setStories(localRows);
        maritesMemory.set(cacheKey, {
          rows: localRows,
          remoteUpdatedAt: 0,
        });
      } catch (localError) {
        console.warn(
          'Marites Story local cache:',
          String(
            (localError as Error)?.message ??
              localError
          )
        );
      }
    }

    let refreshPromise =
      !forceRemote
        ? maritesRefreshes.get(cacheKey)
        : undefined;

    if (!refreshPromise) {
      const nextPromise = loadAllMaritesStories(
        locationScopeId,
        userId
      );

      refreshPromise = nextPromise;
      maritesRefreshes.set(cacheKey, nextPromise);

      void nextPromise.then(
        () => {
          if (maritesRefreshes.get(cacheKey) === nextPromise) {
            maritesRefreshes.delete(cacheKey);
          }
        },
        () => {
          if (maritesRefreshes.get(cacheKey) === nextPromise) {
            maritesRefreshes.delete(cacheKey);
          }
        }
      );
    }

    try {
      const result = await refreshPromise;

      if (generation !== loadGenerationRef.current) {
        return;
      }

      const visibleRows = filterMaritesStoriesForViewer(
        result.stories,
        userId
      );

      setStories((current) => {
        const resolved = resolveMaritesVisibleRows({
          current,
          incoming: visibleRows,
          refreshFailed: result.refreshFailed,
        });
        const previous = maritesMemory.get(cacheKey);

        maritesMemory.set(cacheKey, {
          rows: resolved.rows,
          remoteUpdatedAt: resolved.markFresh
            ? Date.now()
            : (previous?.remoteUpdatedAt ?? 0),
        });

        return resolved.rows;
      });
    } catch (remoteError) {
      /* Keep warm/local stories visible when refresh is unavailable. */
      console.warn(
        'Marites Story shared refresh:',
        String(
          (remoteError as Error)?.message ??
            remoteError
        )
      );
    }
  }, [cacheKey, locationScopeId, user?.id]);

  useEffect(() => {
    void load();

    return () => {
      loadGenerationRef.current += 1;
    };
  }, [load]);

  // A privacy revocation must evict cached stories without waiting for a
  // full 72-hour story refresh or interrupting unrelated video playback.
  useEffect(() => {
    if (!user?.id) return;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeBuklodPublicPostChanges((change) => {
      const postId = typeof change.post_id === 'string' ? change.post_id : '';
      if (!postId) return;
      if (change.visibility_revoked === true) {
        const keepStory = (story: MaritesStory) =>
          String(story.community_post_id ?? parseCommunityMaritesPostId(story.id) ?? '') !== postId ||
          String(story.user_id) === String(user.id);
        loadGenerationRef.current += 1;
        setStories(current => current.filter(keepStory));
        setViewStory(current => current && !keepStory(current) ? null : current);
        const cached = maritesMemory.get(cacheKey);
        if (cached) maritesMemory.set(cacheKey, { ...cached, rows: cached.rows.filter(keepStory) });
      }
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { reloadTimer = null; void load(true); }, 900);
    });
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [user?.id, cacheKey, load]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const current = maritesMemory.get(cacheKey);

    if (!current && stories.length === 0) {
      return;
    }

    maritesMemory.set(cacheKey, {
      rows: stories,
      remoteUpdatedAt: current?.remoteUpdatedAt ?? 0,
    });
  }, [cacheKey, stories, user?.id]);

  const closeStoryViewer = useCallback(() => {
    onViewerVisibilityChange?.(false);
    setStoryZoomed(false);
    setViewStory(null);
    setReactionPickerOpen(false);
  }, [onViewerVisibilityChange]);

  const openStoryViewer = useCallback((story: MaritesStory) => {
    // Batch the Wall-player pause with native modal opening.
    onViewerVisibilityChange?.(true);
    setStoryZoomed(false);
    setReactionPickerOpen(false);
    setViewStory(story);
  }, [onViewerVisibilityChange]);

  /*
   * BUKLOD_MARITES_STORY_NAV_R1
   *
   * Story viewer stays open. Previous/Next moves directly between visible
   * stories so users never need Back -> tap another card -> reopen.
   */
  const stepStoryViewer = useCallback(
    (direction: -1 | 1) => {
      if (
        !viewStory ||
        activeStories.length < 2
      ) {
        return;
      }

      const currentIndex =
        activeStories.findIndex(
          story =>
            story.id ===
            viewStory.id
        );

      const safeIndex =
        currentIndex >= 0
          ? currentIndex
          : 0;

      const nextIndex =
        (
          safeIndex +
          direction +
          activeStories.length
        ) % activeStories.length;

      setStoryZoomed(false);
      setReactionPickerOpen(false);
      setViewStory(
        activeStories[nextIndex]
      );
    },
    [
      activeStories,
      viewStory,
    ]
  );

  const communityPostIdForStory = useCallback(
    (story: MaritesStory) => {
      return (
        String(story.community_post_id ?? '').trim() ||
        parseCommunityMaritesPostId(story.id)
      );
    },
    []
  );

  // Resolve only the open story. No feed-level music queries, signing or audio.
  useEffect(() => {
    const story = viewStory;
    let cancelled = false;
    setViewerMusic(null);
    setViewerMusicEnabled(true);
    setViewerMusicStatus({ playing: false, duration: 0, error: '' });
    if (!story) return;
    if (story.music_track) {
      setViewerMusic({
        storyId: story.id,
        track: story.music_track,
        start: story.music_clip_start_seconds ?? 0,
      });
    }
    const postId = communityPostIdForStory(story);
    if (!postId) return;
    void loadBuklodPostCreatives([postId]).then(rows => {
      if (cancelled) return;
      const creative = rows[postId];
      setViewerMusic(creative?.music ? {
        storyId: story.id,
        track: creative.music,
        start: creative.music_clip_start_seconds ?? 0,
      } : null);
    }).catch(error => {
      if (!cancelled) console.warn('Marites story music:', String((error as Error)?.message ?? error));
    });
    return () => { cancelled = true; };
  }, [viewStory?.id, communityPostIdForStory]);

  const applyLocalStoryRows = useCallback(
    (next: MaritesStory[], storyId: string) => {
      if (!user?.id) {
        return;
      }

      const filtered = filterMaritesStoriesForViewer(
        next,
        user.id
      );
      setStories((current) =>
        mergeMaritesStories(
          filtered,
          current.filter((item) =>
            isCommunityMaritesStory(item)
          )
        )
      );
      setViewStory((open) =>
        open?.id === storyId
          ? filtered.find((item) => item.id === storyId) ??
            null
          : open
      );
    },
    [user?.id]
  );

  const saveStoryBody = useCallback(
    async (
      story: MaritesStory,
      body: string,
      nextPhotos?: CommunityEditPhoto[]
    ) => {
      const trimmed = body.trim();

      if (isCommunityMaritesStory(story)) {
        const postId = communityPostIdForStory(story);

        if (!postId) {
          throw new Error(
            'This story could not be updated.'
          );
        }

        if (nextPhotos) {
          const saved = await saveCommunityPostEdit({
            postId,
            userId: String(user?.id ?? ''),
            body: withMaritesPostMarker(trimmed),
            photos: nextPhotos,
          });
          const nextUris = saved.media_items
            .map((item) => String(item.media_url ?? '').trim())
            .filter(Boolean);
          const nextPaths = saved.media_items
            .map((item) => String(item.media_path ?? '').trim())
            .filter(Boolean);

          setStories((current) =>
            current.map((item) =>
              item.id === story.id
                ? {
                    ...item,
                    body: trimmed,
                    photo_uris: nextUris,
                    photo_uri: nextUris[0] ?? null,
                    photo_paths: nextPaths,
                  }
                : item
            )
          );
          setViewStory((open) =>
            open?.id === story.id
              ? {
                  ...open,
                  body: trimmed,
                  photo_uris: nextUris,
                  photo_uri: nextUris[0] ?? null,
                  photo_paths: nextPaths,
                }
              : open
          );
          return;
        }

        await updateCommunityPost(
          postId,
          withMaritesPostMarker(trimmed)
        );

        setStories((current) =>
          current.map((item) =>
            item.id === story.id
              ? { ...item, body: trimmed }
              : item
          )
        );
        setViewStory((open) =>
          open?.id === story.id
            ? { ...open, body: trimmed }
            : open
        );
        return;
      }

      const photoUris = nextPhotos
        ? nextPhotos
            .map((photo) => String(photo.uri ?? '').trim())
            .filter(Boolean)
        : undefined;
      const next = await updateMaritesStory(
        story.id,
        trimmed,
        photoUris
      );
      applyLocalStoryRows(next, story.id);
    },
    [applyLocalStoryRows, communityPostIdForStory, user?.id]
  );

  const deleteOwnStory = useCallback(
    async (story: MaritesStory) => {
      if (isCommunityMaritesStory(story)) {
        const postId = communityPostIdForStory(story);

        if (!postId) {
          throw new Error(
            'This story could not be deleted.'
          );
        }

        await deleteCommunityPost(postId);
        setStories((current) =>
          current.filter((item) => item.id !== story.id)
        );
        setViewStory((open) =>
          open?.id === story.id ? null : open
        );
        return;
      }

      const next = await deleteMaritesStory(story.id);
      applyLocalStoryRows(next, story.id);
    },
    [applyLocalStoryRows, communityPostIdForStory]
  );

  const toggleStoryAuthorOnly = useCallback(
    async (story: MaritesStory) => {
      const nextAuthorOnly = !story.author_only;

      if (isCommunityMaritesStory(story)) {
        const postId = communityPostIdForStory(story);

        if (!postId) {
          throw new Error(
            'Could not update visibility.'
          );
        }

        await setCommunityPostAuthorOnly(
          postId,
          nextAuthorOnly
        );

        setStories((current) =>
          current.map((item) =>
            item.id === story.id
              ? { ...item, author_only: nextAuthorOnly }
              : item
          )
        );
        setViewStory((open) =>
          open?.id === story.id
            ? { ...open, author_only: nextAuthorOnly }
            : open
        );
        return;
      }

      const next = await setMaritesStoryAuthorOnly(
        story.id,
        nextAuthorOnly
      );
      applyLocalStoryRows(next, story.id);
    },
    [applyLocalStoryRows, communityPostIdForStory]
  );

  const storyOwnerMenu = useCallback(
    (
      story: MaritesStory,
      menuStyle?: object,
      iconColor = '#FFFFFF'
    ) => {
      if (!user?.id || story.user_id !== user.id) {
        return null;
      }

      return (
        <BuklodContentOverflowMenu
          title="Your story"
          body={story.body}
          authorOnly={!!story.author_only}
          iconColor={iconColor}
          iconSize={18}
          maxChars={MARITES_MAX_CHARS}
          maxPhotos={MARITES_MAX_PHOTOS}
          allowPhotoEdit
          photos={storyEditPhotos(story)}
          style={menuStyle}
          onEdit={(nextBody, nextPhotos) =>
            saveStoryBody(story, nextBody, nextPhotos)
          }
          onDelete={() => deleteOwnStory(story)}
          onToggleAuthorOnly={() =>
            toggleStoryAuthorOnly(story)
          }
        />
      );
    },
    [
      deleteOwnStory,
      saveStoryBody,
      toggleStoryAuthorOnly,
      user?.id,
    ]
  );

  const resetComposer = useCallback(() => {
    setDraft('');
    setPhotos([]);
    setQuickVideo(null);
    setComposerMusicTrack(null);
    setComposerMusicClipStart(0);
    setPreviewMusic(null);
    setMusicPickerOpen(false);
    setPhotoEditorSource(null);
    setPhotoEditorTargetId(null);
    setComposerOpen(false);
  }, []);

  const reactToStory = useCallback(
    (storyId: string, reactionKey: string) => {
      if (!user?.id) {
        return;
      }

      const current = stories.find(
        (story) => story.id === storyId
      );

      if (!current) {
        return;
      }

      const previous = current.my_reaction ?? null;
      const nextReaction =
        previous === reactionKey ? null : reactionKey;

      rememberCommunityReaction(
        nextReaction ?? reactionKey
      );

      const applyReaction = (
        story: MaritesStory
      ): MaritesStory => {
        const counts = {
          ...(story.reaction_counts ?? {}),
        };

        if (previous) {
          counts[previous] = Math.max(
            0,
            Number(counts[previous] ?? 0) - 1
          );
        }

        if (nextReaction) {
          counts[nextReaction] = Math.max(
            0,
            Number(counts[nextReaction] ?? 0) + 1
          );
        }

        return {
          ...story,
          reaction_counts: counts,
          my_reaction: nextReaction,
        };
      };

      const syncStories = (
        updater: (story: MaritesStory) => MaritesStory
      ) => {
        setStories((openStories) =>
          openStories.map((story) =>
            story.id === storyId
              ? updater(story)
              : story
          )
        );

        setViewStory((open) => {
          if (!open || open.id !== storyId) {
            return open;
          }

          return updater(open);
        });
      };

      if (isCommunityMaritesStory(current)) {
        syncStories(applyReaction);

        void setMaritesStoryReaction(
          storyId,
          user.id,
          nextReaction
        ).catch((error) => {
          syncStories(() => current);
          Alert.alert(
            'Reaction',
            String(
              (error as Error)?.message ??
                'Could not save reaction.'
            )
          );
        });

        return;
      }

      void setMaritesStoryReaction(
        storyId,
        user.id,
        nextReaction
      ).then((next) => {
        const filtered = filterMaritesStoriesForViewer(
          next,
          user.id
        );

        setStories((openStories) => {
          const communityStories = openStories.filter(
            (story) =>
              isCommunityMaritesStory(story)
          );

          return mergeMaritesStories(
            filtered,
            communityStories
          );
        });

        setViewStory((open) => {
          if (!open || open.id !== storyId) {
            return open;
          }

          return (
            filtered.find(
              (story) => story.id === storyId
            ) ?? open
          );
        });
      });
    },
    [stories, user?.id]
  );

  const removeComposerPhoto = useCallback((id: string) => {
    setPhotos((current) =>
      current.filter((photo) => photo.id !== id)
    );
  }, []);

  const openPhotoActions = useCallback(
    (photo: MaritesComposerPhoto) => {
      setPhotoEditSheetPhoto(photo);
    },
    []
  );

  const openPhotoEditor = useCallback(
    (
      photo: MaritesComposerPhoto,
      tool: BuklodPhotoEditorTool
    ) => {
      setPhotoEditorTargetId(photo.id);
      setPhotoEditorInitialTool(tool);
      setPhotoEditorSource(photo);
    },
    []
  );

  const pickPhotos = useCallback(async () => {
    try {
      setPhotoBusy(true);
      const picked = await pickCommunityPhotos({
        remaining: MARITES_MAX_PHOTOS - photos.length,
        maxPhotos: MARITES_MAX_PHOTOS,
      });

      if (!picked.length) {
        return;
      }

      setPhotos(current =>
        [...current, ...picked].slice(0, MARITES_MAX_PHOTOS)
      );
    } catch (error) {
      Alert.alert(
        'Photos',
        String(
          (error as Error)?.message ??
            'Could not select photos.'
        )
      );
    } finally {
      setPhotoBusy(false);
    }
  }, [photos.length]);

  const pickQuickVideo = useCallback(async () => {
    try {
      const P = await import('expo-image-picker');
      const permission = await P.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Quick Video', 'Allow video library access first.'); return; }
      const result = await P.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 30, allowsEditing: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const rawDuration = Number(asset.duration ?? 0);
      const durationSeconds = quickVideoDurationSeconds(rawDuration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 30) { Alert.alert('Quick Video', 'Select a video no longer than 30 seconds.'); return; }
      setPhotos([]);
      setQuickVideo({ uri: asset.uri, durationSeconds, mimeType: asset.mimeType || 'video/mp4' });
    } catch (error) { Alert.alert('Quick Video', String((error as Error)?.message ?? 'Could not select video.')); }
  }, []);

  const submitStory = useCallback(async () => {
    if (postingGuardRef.current) return;
    const body = draft.trim();
    const photoUris = photos.map((photo) => photo.uri);

    if (!body && !photoUris.length && !quickVideo) {
      Alert.alert(
        'Marites Story',
        'Add a short message or photo first.'
      );
      return;
    }

    if (!user?.id) {
      Alert.alert(
        'Marites Story',
        'Sign in to share a story.'
      );
      return;
    }

    if (body.length > MARITES_MAX_CHARS) {
      Alert.alert(
        'Marites Story',
        `Keep it short — ${MARITES_MAX_CHARS} characters max.`
      );
      return;
    }

    postingGuardRef.current = true;
    setPosting(true);

    try {
      const { story, shared, musicError } = await publishMaritesStory({
        userId: user.id,
        authorName:
          profile?.full_name?.trim() ||
          'Member',
        avatarUrl: profile?.avatar_url ?? null,
        body,
        photoUris,
        video: quickVideo,
        musicTrack: composerMusicTrack,
        musicClipStartSeconds: composerMusicTrack ? composerMusicClipStart : null,
      });

      loadGenerationRef.current += 1;
      maritesRefreshes.delete(cacheKey);

      setStories((current) => {
        const next = [
          story,
          ...current.filter((row) => row.id !== story.id),
        ];

        maritesMemory.set(cacheKey, {
          rows: next,
          remoteUpdatedAt: Date.now(),
        });

        return next;
      });

      if (!shared) {
        Alert.alert(
          'Marites Story',
          'Saved on this device. Shared board needs a community connection — try again when online.'
        );
      }

      resetComposer();
      if (musicError) Alert.alert('Marites Music', 'Your story was posted, but the music could not be saved. Please try another track for a new story.\n' + musicError);
    } catch (error) {
      Alert.alert(
        'Marites Story',
        String(
          (error as Error)?.message ??
            'Could not save your story.'
        )
      );
    } finally {
      postingGuardRef.current = false;
      setPosting(false);
    }
  }, [
    draft,
    cacheKey,
    photos,
    quickVideo,
    composerMusicTrack,
    composerMusicClipStart,
    profile?.avatar_url,
    profile?.full_name,
    resetComposer,
    user?.id,
  ]);

  const appendEmoji = useCallback(
    (emoji: string) => {
      setDraft((current) => {
        const next = `${current}${emoji}`;

        if (next.length > MARITES_MAX_CHARS) {
          return current;
        }

        return next;
      });
    },
    []
  );

  const insets = useSafeAreaInsets();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const { height: windowHeight, width: windowWidth } =
    useWindowDimensions();

  const canPlayInline = playbackActive && !playbackBlocked && !viewStory && !composerOpen;
  const visibilityGeneration = useRef(0);
  const measureVisibility = useCallback(() => {
    const generation = ++visibilityGeneration.current;
    if (!canPlayInline) { setVisibleVideoIndex(-1); return; }
    stripViewportRef.current?.measureInWindow((x, y, width, height) => {
      if (generation !== visibilityGeneration.current) return;
      setVisibleVideoIndex(selectVisibleMaritesVideo({
        x, y, width, height, windowWidth, windowHeight,
        topInset: insets.top, bottomInset: Math.max(insets.bottom, drawerBottomInset),
        offset: storyStripOffset.current,
        cardWidth: MARITES_COMPACT_CARD_WIDTH, gap: 7,
        videos: activeStories.map(story => Boolean(story.video_uri)),
      }));
    });
  }, [canPlayInline, activeStories, windowWidth, windowHeight, insets.top, insets.bottom, drawerBottomInset]);

  // Wall emits scroll updates as often as once per frame. Coalesce native
  // measureInWindow calls while retaining immediate focus/overlay transitions.
  const latestMeasureVisibility = useRef(measureVisibility);
  latestMeasureVisibility.current = measureVisibility;
  const measurementSchedulerRef = useRef<ReturnType<typeof createMaritesVisibilityScheduler> | null>(null);
  if (!measurementSchedulerRef.current) {
    measurementSchedulerRef.current = createMaritesVisibilityScheduler(
      () => latestMeasureVisibility.current(),
    );
  }
  const requestVisibilityMeasurement = useCallback(() => {
    measurementSchedulerRef.current?.request();
  }, []);
  useEffect(() => {
    if (visibilityRefreshRef) visibilityRefreshRef.current = requestVisibilityMeasurement;
    measurementSchedulerRef.current?.flush();
    // Periodic fallback for header/layout changes that do not emit scrolling.
    const timer = canPlayInline && activeStories.some(story => story.video_uri)
      ? setInterval(requestVisibilityMeasurement, 750) : null;
    return () => {
      ++visibilityGeneration.current;
      if (timer) clearInterval(timer);
      measurementSchedulerRef.current?.cancel();
      if (visibilityRefreshRef?.current === requestVisibilityMeasurement) visibilityRefreshRef.current = null;
    };
  }, [measureVisibility, canPlayInline, activeStories, visibilityRefreshRef, requestVisibilityMeasurement]);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>
          MARITES STORY
        </Text>
        <View style={styles.headingActions}>
          <Text
            numberOfLines={1}
            style={styles.hint}
          >
            Tap · Hold react
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share Marites update"
            hitSlop={6}
            onPress={() => setComposerOpen(true)}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && { opacity: 0.72 },
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={13}
              color={colors.green}
            />
            <Text style={styles.shareButtonText}>
              Share
            </Text>
          </Pressable>
        </View>
      </View>

      <View ref={stripViewportRef} collapsable={false} onLayout={requestVisibilityMeasurement}>
      {/* Android PSS investigation: the old horizontal ScrollView eagerly
          mounted every 72h photo/card/menu. Virtualize ONLY the strip and
          retain a generous window for instant adjacent swipes; never clip
          photos on Android (known white-tile regression). Fullscreen viewer,
          signed URLs, active player and AdMob remain unchanged. */}
      <FlatList
        horizontal
        data={activeStories}
        keyExtractor={story => story.id}
        extraData={`${canPlayInline ? 'play' : 'pause'}:${visibleVideoIndex}`}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={5}
        updateCellsBatchingPeriod={80}
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
        scrollEventThrottle={100}
        onScroll={event => { storyStripOffset.current = event.nativeEvent.contentOffset.x; requestVisibilityMeasurement(); }}
        renderItem={({ item: story, index }) => (
          <BuklodFocusFadeUp
            delay={Math.min(index, 8) * 30}
            duration={220}
            fromY={6}
            fromOpacity={0.82}
            style={styles.cardShell}
          >
            <MaritesStoryCard
              story={story}
              autoPlayVideo={canPlayInline && index === visibleVideoIndex}
              colors={colors}
              onPress={() =>
                openStoryViewer(story)
              }
              menu={storyOwnerMenu(
                story,
                styles.cardMenuBtn
              )}
              onComments={onOpenComments ? (() => {
                const postId = communityPostIdForStory(story);
                return postId ? () => onOpenComments(postId, story) : undefined;
              })() : undefined}
            />
          </BuklodFocusFadeUp>
        )}
      />
      </View>

      {activeStories.length === 0 && (
        <Text style={styles.emptyNote}>
          Be the first to share a quick update, or wait
          for community members to post.
        </Text>
      )}

      <Modal
        visible={composerOpen}
        transparent
        animationType="slide"
        onRequestClose={resetComposer}
      >
        {/* PATCH_MARITES_KEYBOARD_SAFE_R2C */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={0}
        >
        <Pressable
          style={styles.backdrop}
          onPress={resetComposer}
        >
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: drawerBottomInset + 12 },
            ]}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <ScrollView
              keyboardDismissMode={
                Platform.OS === 'ios'
                  ? 'interactive'
                  : 'on-drag'
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                New Marites Story
              </Text>
              <Pressable onPress={resetComposer}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <TextInput
              value={draft}
              onChangeText={(value) =>
                setDraft(
                  value.slice(0, MARITES_MAX_CHARS)
                )
              }
              placeholder="Quick update for the community…"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.input}
            />
            <Text style={styles.charCount}>
              {draft.length}/{MARITES_MAX_CHARS}
            </Text>

            <View style={styles.emojiRow}>
              {MARITES_QUICK_EMOJI.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.emojiChip}
                  onPress={() =>
                    appendEmoji(emoji)
                  }
                >
                  <Text style={styles.emojiText}>
                    {emoji}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.toolRow}>
              <Pressable
                style={styles.toolBtn}
                disabled={photoBusy || Boolean(quickVideo)}
                onPress={() => void pickPhotos()}
              >
                <MaterialCommunityIcons
                  name="image-plus"
                  size={17}
                  color={colors.green}
                />
                <Text style={styles.toolText}>
                  {photoBusy
                    ? 'Preparing…'
                    : photos.length
                      ? `Add photos (${photos.length}/${MARITES_MAX_PHOTOS})`
                      : 'Add photos'}
                </Text>
              </Pressable>
              <Pressable style={styles.toolBtn} disabled={posting} onPress={() => void pickQuickVideo()}><MaterialCommunityIcons name="video-plus" size={17} color={colors.green} /><Text style={styles.toolText}>{quickVideo ? 'Replace Quick Video' : 'Quick Video (max 30s)'}</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose Marites story music"
              style={[styles.toolBtn, { alignSelf: 'flex-start', marginTop: 9 }]}
              onPress={() => setMusicPickerOpen(true)} disabled={posting}>
              <MaterialCommunityIcons name="music-note-plus" size={19} color={colors.green}/>
              <Text style={styles.toolText} numberOfLines={1}>
                {composerMusicTrack ? composerMusicTrack.title + ' · Edit music' : 'Add music (30s)'}
              </Text>
            </Pressable>
            <Text style={[styles.composerPhotoHint, { marginTop: 5 }]}>Music is silent in the Marites feed. It plays only in Full View.</Text>
            {quickVideo ? <View><View style={{ height: 190 }}><MaritesQuickVideo uri={quickVideo.uri} muted /></View><Pressable accessibilityRole="button" onPress={() => setQuickVideo(null)}><Text style={styles.toolText}>Remove video</Text></Pressable></View> : null}

            <Text style={styles.composerPhotoHint}>
              Tap Add photos, then tap each photo you want. Press OK when done.
              Long-press a photo to highlight, draw, add text, emoji, or remove.
            </Text>

            {!!photos.length && (
              <View style={styles.composerPhotoRow}>
                {photos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    style={styles.composerPhotoWrap}
                    onLongPress={() =>
                      openPhotoActions(photo)
                    }
                    delayLongPress={BUKLOD_LONG_PRESS_MS}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.previewPhoto}
                      resizeMode="cover"
                    />
                    <Pressable
                      style={styles.composerPhotoRemove}
                      onPress={() =>
                        removeComposerPhoto(photo.id)
                      }
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={14}
                        color="#FFFFFF"
                      />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              style={[
                styles.postBtn,
                posting && { opacity: 0.7 },
              ]}
              disabled={posting}
              onPress={() => void submitStory()}
            >
              <Text style={styles.postBtnText}>
                {posting ? 'Posting…' : 'Post story'}
              </Text>
            </Pressable>

            <View style={styles.localBadge}>
              <Text style={styles.localBadgeText}>
                Stories appear only in Marites Story.
              </Text>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      
        </KeyboardAvoidingView>
</Modal>

      <BuklodPostMusicPicker
        visible={composerOpen && musicPickerOpen}
        selectedId={composerMusicTrack?.id}
        selectedTrack={composerMusicTrack}
        previewId={previewMusic?.track.id}
        previewPlaying={previewMusicStatus.playing}
        previewDurationSeconds={previewMusicStatus.duration}
        clipStartSeconds={composerMusicClipStart}
        clipDurationSeconds={30}
        onClipChange={start => setComposerMusicClipStart(start)}
        onSelect={(track, start) => {
          setComposerMusicTrack(track);
          setComposerMusicClipStart(start);
          setPreviewMusic(null);
        }}
        onPreview={(track, start) => {
          setPreviewMusic(current => current?.track.id === track.id && current.start === start
            ? null : { track, start });
        }}
        onScrub={(track, start) => setPreviewMusic({ track, start })}
        onClose={() => { setPreviewMusic(null); setMusicPickerOpen(false); }}
      />
      <BuklodMaritesStoryAudio
        track={previewMusic?.track ?? null}
        startSeconds={previewMusic?.start ?? 0}
        active={composerOpen && musicPickerOpen && !!previewMusic}
        onPlaybackChange={setPreviewMusicStatus}
        onInterrupted={() => setPreviewMusic(null)}
      />

      <Modal
        visible={viewStory !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={closeStoryViewer}
      >
        {viewStory && (
          <GestureHandlerRootView style={styles.fullscreen}>
            <BuklodMaritesStoryAudio
              track={viewerMusic?.storyId === viewStory.id ? viewerMusic.track : null}
              startSeconds={viewerMusic?.start ?? 0}
              active={playbackActive && !playbackBlocked && !composerOpen && !musicPickerOpen && viewerMusicEnabled && viewerMusic?.storyId === viewStory.id}
              onPlaybackChange={setViewerMusicStatus}
              onInterrupted={() => setViewerMusicEnabled(false)}
            />
            {(() => {
                const photoUris =
                  getMaritesStoryPhotos(viewStory);
                const body =
                  viewStory.body.trim();
                const emojiOnly =
                  !photoUris.length &&
                  isMaritesEmojiOnlyBody(body);

                if (viewStory.video_uri) return <MaritesQuickVideo uri={viewStory.video_uri} muted={viewerMusicStatus.playing} />;
                if (photoUris.length) {
                  if (photoUris.length === 1) {
                    return (
                      <View
                        style={
                          styles.fullscreenPhotoWrap
                        }
                      >
                        <BuklodZoomablePhoto
                          uri={photoUris[0]}
                          mediaPath={viewStory.photo_paths?.[0] ?? null}
                          onZoomedChange={setStoryZoomed}
                          onLongPress={() =>
                            setReactionPickerOpen(true)
                          }
                        />
                      </View>
                    );
                  }

                  return (
                    <GestureScrollView
                      horizontal
                      pagingEnabled={!storyZoomed}
                      scrollEnabled={!storyZoomed}
                      showsHorizontalScrollIndicator={
                        false
                      }
                      style={{
                        flex: 1,
                        width: '100%',
                      }}
                      contentContainerStyle={{
                        alignItems: 'center',
                      }}
                    >
                      {photoUris.map((uri, index) => (
                        <View
                          key={uri}
                          style={[
                            styles.fullscreenPhotoPage,
                            {
                              width: windowWidth,
                              height:
                                windowHeight,
                            },
                          ]}
                        >
                          <BuklodZoomablePhoto
                            uri={uri}
                            mediaPath={viewStory.photo_paths?.[index] ?? null}
                            onZoomedChange={
                              setStoryZoomed
                            }
                            onLongPress={() =>
                              setReactionPickerOpen(true)
                            }
                          />
                        </View>
                      ))}
                    </GestureScrollView>
                  );
                }

                return (
                  <Pressable
                    style={styles.fullscreenTapArea}
                    onPress={() => {
                      if (longPressHandledRef.current) {
                        longPressHandledRef.current = false;
                      }
                    }}
                    onLongPress={() => {
                      longPressHandledRef.current = true;
                      setReactionPickerOpen(true);
                    }}
                    delayLongPress={BUKLOD_LONG_PRESS_MS}
                  >
                    {emojiOnly ? (
                      <View
                        style={
                          styles.fullscreenEmoji
                        }
                      >
                        <Text
                          style={
                            styles.fullscreenEmojiText
                          }
                        >
                          {body}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={
                          styles.fullscreenTextWrap
                        }
                      >
                        <Text
                          style={
                            styles.fullscreenBodyText
                          }
                        >
                          {body}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })()}

            {viewerMusic?.storyId === viewStory.id && !storyZoomed ? (
              <Pressable accessibilityRole="button"
                accessibilityLabel={viewerMusicEnabled ? 'Mute Marites story music' : 'Play Marites story music'}
                onPress={() => setViewerMusicEnabled(value => !value)}
                style={{ position: 'absolute', left: 12, bottom: drawerBottomInset + 83,
                  maxWidth: '54%', minHeight: 44, paddingHorizontal: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 7,
                  backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 22, zIndex: 22 }}>
                <MaterialCommunityIcons name={viewerMusicEnabled ? 'volume-high' : 'volume-off'} size={20} color="#FFFFFF"/>
                <Text numberOfLines={1} style={{ color: '#FFFFFF', fontWeight: '700', flexShrink: 1, fontSize: 12 }}>
                  {viewerMusicStatus.error || viewerMusic.track.title}
                </Text>
              </Pressable>
            ) : null}

            <View
              style={[
                styles.fullscreenHeader,
                {
                  paddingTop: Math.max(
                    insets.top,
                    10
                  ),
                },
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                style={styles.fullscreenHeaderBtn}
                onPress={closeStoryViewer}
                hitSlop={BUKLOD_HIT_SLOP}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#FFFFFF"
                />
              </Pressable>

              {viewStory.user_id === user?.id ? (
                storyOwnerMenu(
                  viewStory,
                  styles.fullscreenHeaderBtn
                )
              ) : (
                <View
                  style={
                    styles.fullscreenHeaderBtn
                  }
                />
              )}
            </View>

            {activeStories.length > 1 &&
            !storyZoomed &&
            !reactionPickerOpen ? (
              <View
                style={
                  styles.fullscreenStoryNav
                }
                pointerEvents="box-none"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous Marites story"
                  style={
                    styles.fullscreenStoryNavBtn
                  }
                  onPress={() =>
                    stepStoryViewer(-1)
                  }
                  hitSlop={BUKLOD_HIT_SLOP}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={31}
                    color="#FFFFFF"
                  />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next Marites story"
                  style={
                    styles.fullscreenStoryNavBtn
                  }
                  onPress={() =>
                    stepStoryViewer(1)
                  }
                  hitSlop={BUKLOD_HIT_SLOP}
                >
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={31}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>
            ) : null}

            {!reactionPickerOpen ? (
              <View
                style={[
                  styles.fullscreenHint,
                  {
                    top: Math.max(
                      insets.top + 52,
                      62
                    ),
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={styles.fullscreenHintText}>
                  {getMaritesStoryPhotos(viewStory).length
                    ? 'Pinch to zoom · Drag to move · Long press for reactions · Use arrows for next story'
                    : 'Long press for reactions · Use arrows for previous/next story'}
                </Text>
              </View>
            ) : null}

            {reactionPickerOpen ? (
              <View
                style={[
                  styles.fullscreenReactionDock,
                  {
                    bottom:
                      Math.max(
                        insets.bottom,
                        16
                      ) + 96,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRadius: 24,
                    backgroundColor:
                      'rgba(18,22,20,0.92)',
                    borderWidth: 1,
                    borderColor:
                      'rgba(255,255,255,0.12)',
                  }}
                >
                  {BUKLOD_PUBLIC_COMMUNITY_REACTIONS.map(
                    (option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          reactToStory(
                            viewStory.id,
                            option.key
                          );
                          setReactionPickerOpen(
                            false
                          );
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor:
                            viewStory.my_reaction ===
                            option.key
                              ? 'rgba(40,125,84,0.95)'
                              : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 22,
                            lineHeight: 26,
                          }}
                        >
                          {option.emoji}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            ) : null}

            {!reactionPickerOpen && !storyZoomed ? (
              <View style={{ position: 'absolute', right: 18, bottom: drawerBottomInset + 82, flexDirection: 'row', gap: 12, zIndex: 20 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="React to story" onPress={() => setReactionPickerOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="heart-outline" size={26} color="#FFFFFF" />
                </Pressable>
                {onOpenComments && parseCommunityMaritesPostId(viewStory.id) ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Comment on story" onPress={() => { const id = parseCommunityMaritesPostId(viewStory.id); if (id) { closeStoryViewer(); onOpenComments(id, viewStory); } }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="comment-text-outline" size={25} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View
              style={[
                styles.fullscreenFooter,
                {
                  paddingBottom: drawerBottomInset,
                },
              ]}
              pointerEvents="none"
            >
              {!!viewStory.body &&
                !!getMaritesStoryPhotos(
                  viewStory
                ).length && (
                  <Text
                    style={
                      styles.fullscreenFooterText
                    }
                  >
                    {viewStory.body}
                  </Text>
                )}

              <View style={styles.fullscreenMetaRow}>
                <BuklodTappableAvatar
                  userId={viewStory.user_id}
                  uri={viewStory.avatar_url}
                  name={viewStory.author_name}
                  size={34}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={styles.fullscreenAuthor}
                  >
                    {resolvePersonDisplayName(
                      viewStory.author_name,
                      viewStory.user_id
                    )}
                  </Text>
                  <Text style={styles.fullscreenMeta}>
                    {maritesAgeLabel(
                      viewStory.created_at
                    )}
                    {viewStory.author_only
                      ? ' · Ako lang'
                      : ''}
                    {sumMaritesReactionCounts(
                      viewStory.reaction_counts
                    ) > 0
                      ? ` · ${sumMaritesReactionCounts(
                          viewStory.reaction_counts
                        )} reactions`
                      : ''}
                  </Text>
                </View>
              </View>
            </View>
          </GestureHandlerRootView>
        )}
      </Modal>

      <BuklodComposerPhotoEditSheet
        visible={!!photoEditSheetPhoto}
        onClose={() =>
          setPhotoEditSheetPhoto(null)
        }
        onSelectTool={(tool) => {
          if (!photoEditSheetPhoto) {
            return;
          }

          openPhotoEditor(
            photoEditSheetPhoto,
            tool
          );
        }}
        onRemove={() => {
          if (!photoEditSheetPhoto) {
            return;
          }

          removeComposerPhoto(
            photoEditSheetPhoto.id
          );
        }}
      />

      <BuklodPhotoEditor
        visible={!!photoEditorSource}
        sourceUri={photoEditorSource?.uri ?? null}
        initialTool={photoEditorInitialTool}
        onCancel={() => {
          setPhotoEditorSource(null);
          setPhotoEditorTargetId(null);
        }}
        onDone={(edited) => {
          if (photoEditorTargetId) {
            setPhotos((current) =>
              current.map((photo) =>
                photo.id === photoEditorTargetId
                  ? { ...photo, uri: edited.uri }
                  : photo
              )
            );
          }

          setPhotoEditorSource(null);
          setPhotoEditorTargetId(null);
        }}
      />
    </View>
  );
}

