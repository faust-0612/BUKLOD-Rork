import React, { memo, useMemo, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { BuklodCommunityPhotoCollage } from '@/components/BuklodCommunityPhotoCollage';
import { CommunityVideo } from '@/components/CommunityVideo';
import {
  BuklodCommunityPostEngagement,
} from '@/components/BuklodCommunityPostEngagement';
import type { BuklodReactionOption } from '@/components/BuklodReactionAction';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

export type BuklodCommunityWallMedia = {
  id?: string;
  media_path?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  preview_path?: string | null;
  preview_url?: string | null;
  duration_seconds?: number | null;
};

export type BuklodCommunityWallPost = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  privacy?: 'public' | 'scope' | 'private';
  privacyLabel?: string;
  body?: string | null;
  media?: BuklodCommunityWallMedia[] | null;
  reactionCounts?: Record<string, number> | null;
  myReaction?: string | null;
  commentCount?: number | null;
};

type Props = {
  post?: BuklodCommunityWallPost;
  reactionOptions?: readonly BuklodReactionOption[];
  children?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  useThemeCard?: boolean;
  active?: boolean;
  onPressAuthor?: () => void;
  onPressPhoto?: (index: number, photos: BuklodCommunityWallMedia[]) => void;
  onLongPressPhoto?: (index: number, photos: BuklodCommunityWallMedia[]) => void;
  onOpenVideo?: () => void;
  onReact?: (key: string) => void;
  onOpenComments?: () => void;
  onShare?: () => void;
  onReactionSummaryPress?: (key: string) => void;
};

/**
 * Compact, scope-agnostic Community Wall post presentation.
 *
 * Feed ownership, authorization, loading, pagination and mutations stay in
 * the Public/Scoped feed containers. This component only renders the post.
 * It deliberately composes BUKLOD's canonical photo, video and reaction
 * components instead of introducing a second media or interaction engine.
 */
function BuklodCommunityWallPostCard(props: Props) {
  const { theme } = useBuklodTheme();
  const {
    children,
    containerStyle,
    post,
  } = props;

  // Keep the integrated feed wrapper lightweight. Existing Public/Scoped
  // renderers own their rich children and media lifecycles.
  if (children !== undefined) {
    // Public and scoped feeds share one visual shell. Feed-owned children
    // remain untouched so their media, actions and lifecycle stay canonical.
    return (
      <View
        style={[
          styles.feedCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
          containerStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  if (!post) return null;

  return <DefaultBuklodCommunityWallPostCard {...props} post={post} />;
}

function DefaultBuklodCommunityWallPostCard({
  post,
  reactionOptions = [],
  active = true,
  onPressAuthor,
  onPressPhoto,
  onLongPressPhoto,
  onOpenVideo,
  onReact = () => undefined,
  onOpenComments = () => undefined,
  onShare = () => undefined,
  onReactionSummaryPress,
}: Props & { post: BuklodCommunityWallPost }) {
  const { theme } = useBuklodTheme();

  const media = useMemo(
    () => (Array.isArray(post.media) ? post.media.filter(item => item?.media_url || item?.media_path) : []),
    [post.media],
  );

  const video = media.find(item =>
    String(item.media_mime_type ?? '').toLowerCase().startsWith('video/'),
  );

  const photos = media
    .filter(item => !String(item.media_mime_type ?? '').toLowerCase().startsWith('video/'))
    .map(item => ({
      media_path: item.media_path,
      media_url: item.media_url,
      media_mime_type: item.media_mime_type,
      preview_path: item.preview_path,
    }));

  const privacy = post.privacy ?? 'public';
  const privacyIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] =
    privacy === 'private'
      ? 'lock-outline'
      : privacy === 'scope'
        ? 'account-group-outline'
        : 'earth';

  const timestamp = (() => {
    const date = new Date(post.createdAt);
    return Number.isNaN(date.getTime())
      ? post.createdAt
      : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  })();

  const shareAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share post"
      hitSlop={8}
      onPress={onShare}
      style={({ pressed }) => [styles.shareAction, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name="share-outline" size={19} color={theme.textMuted} />
      <Text style={[styles.actionLabel, { color: theme.textMuted }]}>Share</Text>
    </Pressable>
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole={onPressAuthor ? 'button' : undefined}
          accessibilityLabel={`View ${post.authorName}'s profile`}
          disabled={!onPressAuthor}
          onPress={onPressAuthor}
          style={styles.author}
        >
          {post.authorAvatarUrl ? (
            <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.surfaceMuted }]}>
              <MaterialCommunityIcons name="account" size={22} color={theme.textMuted} />
            </View>
          )}
          <View style={styles.authorMeta}>
            <Text numberOfLines={1} style={[styles.authorName, { color: theme.textPrimary }]}>
              {post.authorName}
            </Text>
            <View style={styles.metaLine}>
              <Text numberOfLines={1} style={[styles.timestamp, { color: theme.textMuted }]}>
                {timestamp}
              </Text>
              <MaterialCommunityIcons name={privacyIcon} size={12} color={theme.textMuted} />
              <Text numberOfLines={1} style={[styles.privacy, { color: theme.textMuted }]}>
                {post.privacyLabel ?? (privacy === 'public' ? 'Public' : privacy === 'scope' ? 'Members' : 'Only me')}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {post.body?.trim() ? (
        <Text selectable style={[styles.body, { color: theme.textPrimary }]}>
          {post.body.trim()}
        </Text>
      ) : null}

      {video?.media_url ? (
        <CommunityVideo
          uri={video.media_url}
          active={active}
          expectedDurationSeconds={Number(video.duration_seconds ?? 0) || undefined}
          posterUri={video.preview_url}
          onOpenFullscreen={onOpenVideo}
          preserveAspectRatio
        />
      ) : photos.length ? (
        <BuklodCommunityPhotoCollage
          items={photos}
          onPressPhoto={(index) => onPressPhoto?.(index, photos)}
          onLongPressPhoto={(index) => onLongPressPhoto?.(index, photos)}
          preserveSinglePhotoAspectRatio
        />
      ) : null}

      <View style={[styles.engagementDivider, { borderTopColor: theme.border }]} />
      <BuklodCommunityPostEngagement
        reactionOptions={reactionOptions}
        reactionCounts={post.reactionCounts}
        myReaction={post.myReaction}
        commentCount={post.commentCount}
        onReact={onReact}
        onReactionSummaryPress={onReactionSummaryPress}
        onOpenComments={onOpenComments}
        showCommentAction
        rightAction={shareAction}
      />
    </View>
  );
}

export default memo(BuklodCommunityWallPostCard);

const styles = StyleSheet.create({
  feedCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 9,
  },
  header: {
    paddingHorizontal: 12,
    minHeight: 42,
    justifyContent: 'center',
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorMeta: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
  },
  authorName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  timestamp: {
    fontSize: 10,
    lineHeight: 13,
    flexShrink: 1,
  },
  privacy: {
    fontSize: 10,
    lineHeight: 13,
    flexShrink: 0,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 9,
    fontSize: 14,
    lineHeight: 20,
  },
  engagementDivider: {
    marginTop: 8,
    marginHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareAction: {
    minHeight: 34,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
});
