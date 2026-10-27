import React, {
  useMemo,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import {
  Image as ExpoImage,
} from 'expo-image';

import {
  connectRadii,
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectTappableAvatar,
} from '@/components/connect/ConnectTappableAvatar';
import {
  ConnectReactionPicker,
  type ConnectReactionOption,
} from '@/components/connect/ConnectReactionPicker';
import { HIBLA } from '@/lib/connectHibla';
import {
  type ConnectMessageActionAnchor,
} from '@/components/connect/ConnectMessageActionSheet';
import {
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';
import {
  connectCollageTiles,
  connectSinglePhotoFrame,
  connectMediaOnlyMessage,
  visibleReaderAvatars,
} from '@/lib/connectChatWindow';

export type ConnectPhotoSlot = {
  key: string;
  uri: string | null;
  failed?: boolean;
};

export type ConnectSeenReader = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
};

type AvatarReaction = {
  emoji: string;
  label: string;
} | null;

type Props = {
  own: boolean;
  showSenderAvatar: boolean;
  senderUserId: string;
  senderName: string;
  senderLabel?: string | null;
  standaloneReaction: boolean;
  avatarReaction: AvatarReaction;
  standaloneEmoji?: string | null;
  bodyText?: string | null;
  sharedPostSlot?: React.ReactNode;
  photoUrl?: string | null;
  photoUrls?: string[];
  photoSlots?: ConnectPhotoSlot[];
  onRetryPhoto?: (index: number) => void;
  seenReaders?: ConnectSeenReader[];
  onPressSeenReaders?: () => void;
  compact?: boolean;
  showTime?: boolean;
  isGif?: boolean;
  fileName?: string | null;
  fileSizeLabel?: string | null;
  timeLabel: string;
  deliveryLabel?: string | null;
  deliveryNotSent?: boolean;
  stampEmoji?: string;
  totalReactions: number;
  pickerOpen: boolean;
  reactionOptions: ConnectReactionOption[];
  replyQuote?: {
    senderName: string;
    text: string;
  } | null;
  deleted?: boolean;
  onLongPress: (
    anchor: ConnectMessageActionAnchor
  ) => void;
  onReact: (key: string) => void;
  onOpenPhoto?: (index?: number) => void;
  onOpenFile?: () => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: 20,
      position: 'relative',
      overflow: 'visible',
    },
    wrapCompact: {
      marginBottom: 4,
    },
    own: {
      alignItems: 'flex-end',
    },
    other: {
      alignItems: 'flex-start',
    },
    senderAvatar: {
      position: 'absolute',
      left: 0,
      top: 2,
      zIndex: 20,
      elevation: 20,
    },
    senderAvatarOwn: {
      left: undefined,
      right: 0,
    },
    bubble: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 22,
      overflow: 'visible',
    },
    bubbleColumn: {
      position: 'relative',
      maxWidth: '82%',
      overflow: 'visible',
    },
    bubbleColumnOwn: {
      alignSelf: 'flex-end',
    },
    bubbleColumnOther: {
      alignSelf: 'flex-start',
    },
    bubbleAnchor: {
      position: 'relative',
      overflow: 'visible',
    },
    bubbleOwn: {
      backgroundColor: HIBLA.pine,
      borderBottomRightRadius: 9,
    },
    bubbleOther: {
      backgroundColor: HIBLA.cream,
      borderBottomLeftRadius: 9,
      borderWidth: 0,
    },
    bubbleWithAvatar: {
      marginLeft: 40,
    },
    bubbleWithAvatarOwn: {
      marginRight: 40,
    },
    standaloneBubble: {
      maxWidth: '92%',
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      overflow: 'visible',
      elevation: 0,
      shadowOpacity: 0,
    },
    mediaOnlyBubble: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      elevation: 0,
      shadowOpacity: 0,
    },
    mediaOnlyMeta: {
      paddingHorizontal: 4,
    },
    sender: {
      marginBottom: 4,
      color: theme.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    body: {
      ...connectTypography.bubbleBody,
      color: HIBLA.ink,
    },
    bodyOwn: {
      color: '#FFFFFF',
    },
    timeRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    time: {
      ...connectTypography.bubbleMeta,
      color: HIBLA.muted,
    },
    timeOwn: {
      color: 'rgba(255,255,255,0.78)',
    },
    delivery: {
      color: 'rgba(255,255,255,0.76)',
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '800',
    },
    deliveryStandalone: {
      color: theme.textMuted,
    },
    deliveryNotSent: {
      color: theme.deliveryFailed,
    },
    inlineMediaPress: {
      maxWidth: '100%',
      marginTop: 5,
      borderRadius: 15,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: 'rgba(0,0,0,0.24)',
    },
    inlineMedia: {
      width: '100%',
      height: '100%',
    },
    mediaFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 8,
    },
    mediaFallbackText: {
      color: theme.white,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    collage: {
      maxWidth: '100%',
      marginTop: 5,
      borderRadius: 15,
      overflow: 'hidden',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    seenRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      minHeight: 28,
    },
    seenRowOwn: {
      alignSelf: 'flex-end',
    },
    seenRowOther: {
      alignSelf: 'flex-start',
    },
    seenAvatar: {
      marginRight: -6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.canvas,
    },
    seenExtra: {
      marginLeft: 10,
      minWidth: 28,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    seenExtraText: {
      color: theme.textPrimary,
      fontSize: 11,
      fontWeight: '800',
    },
    collageTile: {
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.24)',
      position: 'relative',
    },
    collageImage: {
      width: '100%',
      height: '100%',
    },
    collageMore: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.46)',
    },
    collageMoreText: {
      color: theme.white,
      fontSize: 22,
      fontWeight: '900',
    },
    gifBadge: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      minWidth: 34,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    gifBadgeText: {
      color: theme.white,
      fontSize: 12,
      fontWeight: '900',
    },
    fileChip: {
      minWidth: 190,
      marginTop: 4,
      padding: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 11,
      backgroundColor: theme.fileChipOther,
    },
    fileChipOwn: {
      backgroundColor: theme.fileChipOwn,
    },
    fileName: {
      color: theme.accent,
      fontSize: 12.5,
      fontWeight: '900',
    },
    fileNameOwn: {
      color: theme.textOnSentBubble,
    },
    fileSize: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: 12,
    },
    fileSizeOwn: {
      color: 'rgba(255,255,255,0.72)',
    },
    avatarSticker: {
      minWidth: 112,
      alignItems: 'center',
      paddingVertical: 3,
    },
    avatarStickerVisual: {
      width: 90,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    avatarStickerEmoji: {
      position: 'absolute',
      right: 1,
      bottom: 0,
      fontSize: 32,
      lineHeight: 36,
    },
    avatarStickerLabel: {
      marginTop: 3,
      color: theme.accent,
      fontSize: 12.5,
      fontWeight: '900',
    },
    avatarStickerLabelOwn: {
      color: theme.accent,
    },
    standaloneEmoji: {
      fontSize: 42,
      lineHeight: 50,
      textAlign: 'center',
      includeFontPadding: false,
    },
    replyQuote: {
      marginBottom: 6,
      paddingLeft: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    replyQuoteName: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    replyQuoteText: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
    },
    deletedText: {
      color: theme.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
    },
  });
}

export function ConnectMessageBubble({
  own,
  showSenderAvatar,
  senderUserId,
  senderName,
  senderLabel,
  standaloneReaction,
  avatarReaction,
  standaloneEmoji,
  bodyText,
  sharedPostSlot,
  photoUrl,
  photoUrls,
  photoSlots,
  onRetryPhoto,
  seenReaders,
  onPressSeenReaders,
  compact = false,
  showTime = true,
  isGif,
  fileName,
  fileSizeLabel,
  timeLabel,
  deliveryLabel,
  deliveryNotSent,
  stampEmoji,
  totalReactions,
  pickerOpen,
  reactionOptions,
  replyQuote,
  deleted = false,
  onLongPress,
  onReact,
  onOpenPhoto,
  onOpenFile,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const albumUrls =
    photoUrls && photoUrls.length
      ? photoUrls
      : photoUrl
      ? [photoUrl]
      : [];
  const slots =
    photoSlots ??
    albumUrls.map((uri, index) => ({
      key: `${uri}-${index}`,
      uri,
      failed: false,
    }));
  const { width: windowWidth } = useWindowDimensions();
  // Size collage media within the 82%-width bubble, not the full screen.
  const chatWidth = Math.max(
    180,
    Math.floor((Math.min(windowWidth, 840) - (showSenderAvatar ? 56 : 28)) * 0.82) - 28
  );
  const frame = connectSinglePhotoFrame(chatWidth);
  const collageTiles = connectCollageTiles(
    Math.max(slots.length, 2),
    frame.width
  );
  const seen = visibleReaderAvatars(seenReaders ?? []);
  // A standalone photo, GIF, album, or attachment owns its frame. Do not
  // surround it with an extra white/green bordered message card.
  const mediaOnly = connectMediaOnlyMessage({
    deleted,
    bodyText,
    hasReply: Boolean(replyQuote),
    hasSharedPost: Boolean(sharedPostSlot),
    hasReaction: Boolean(standaloneEmoji || avatarReaction),
    hasMedia: slots.length > 0 || Boolean(fileName),
  });

  const bubbleRef =
    useRef<View>(null);

  const handleLongPress =
    () => {
      bubbleRef.current?.measureInWindow(
        (
          x,
          y,
          width,
          height,
        ) => {
          onLongPress({
            x,
            y,
            width,
            height,
          });
        },
      );
    };

  function renderSlot(
    slot: ConnectPhotoSlot,
    index: number,
    width: number,
    height: number
  ) {
    const showMore =
      slots.length > 4 && index === 3;
    const extraCount = slots.length - 4;

    return (
      <Pressable
        key={slot.key}
        accessibilityLabel={
          slot.failed
            ? 'Photo failed to load. Retry.'
            : showMore
              ? `Open photos, ${extraCount} more`
              : slot.uri
                ? `Open photo ${index + 1}`
                : 'Photo is loading'
        }
        onPress={() => {
          if (slot.failed) {
            onRetryPhoto?.(index);
            return;
          }
          if (slot.uri) {
            onOpenPhoto?.(index);
          }
        }}
        onLongPress={handleLongPress}
        delayLongPress={BUKLOD_LONG_PRESS_MS}
        style={[
          styles.collageTile,
          { width, height },
        ]}
      >
        {slot.uri && !slot.failed ? (
          <ExpoImage
            source={{ uri: slot.uri }}
            style={styles.collageImage}
            contentFit="cover"
            transition={120}
            onError={() => onRetryPhoto?.(index)}
          />
        ) : (
          <View style={styles.mediaFallback}>
            {slot.failed ? (
              <Text style={styles.mediaFallbackText}>
                Tap to retry
              </Text>
            ) : (
              <ActivityIndicator color="#ffffff" />
            )}
          </View>
        )}
        {showMore && (
          <View style={styles.collageMore} pointerEvents="none">
            <Text style={styles.collageMoreText}>
              +{extraCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        own ? styles.own : styles.other,
      ]}
    >
      {showSenderAvatar && (
        <View
          style={[
            styles.senderAvatar,
            own && styles.senderAvatarOwn,
          ]}
        >
          <ConnectTappableAvatar
            userId={senderUserId}
            name={senderName}
            size={32}
            shape="rounded"
          />
        </View>
      )}

      <View
        style={[
          styles.bubbleColumn,
          own
            ? styles.bubbleColumnOwn
            : styles.bubbleColumnOther,
          showSenderAvatar &&
            (own
              ? styles.bubbleWithAvatarOwn
              : styles.bubbleWithAvatar),
        ]}
      >
        <View style={styles.bubbleAnchor}>
          <Pressable
            ref={bubbleRef}
            style={[
              styles.bubble,
              own ? styles.bubbleOwn : styles.bubbleOther,
              standaloneReaction && styles.standaloneBubble,
               mediaOnly && styles.mediaOnlyBubble,
            ]}
            onLongPress={handleLongPress}
            delayLongPress={BUKLOD_LONG_PRESS_MS}
            accessibilityLabel={[
              senderName,
              timeLabel,
              bodyText,
              deliveryLabel,
            ].filter(Boolean).join('. ')}
            accessibilityHint="Long press for reactions and message actions."
          >
        {!!senderLabel && (
          <Text style={styles.sender}>{senderLabel}</Text>
        )}

        {!!replyQuote && !deleted && (
          <View style={styles.replyQuote}>
            <Text
              numberOfLines={1}
              style={styles.replyQuoteName}
            >
              {replyQuote.senderName}
            </Text>
            <Text
              numberOfLines={2}
              style={styles.replyQuoteText}
            >
              {replyQuote.text}
            </Text>
          </View>
        )}

        {deleted ? (
          <Text
            style={[
              styles.body,
              styles.deletedText,
              own && styles.bodyOwn,
            ]}
          >
            This message was deleted.
          </Text>
        ) : (
          <>
        {!!avatarReaction && (
          <View style={styles.avatarSticker}>
            <View style={styles.avatarStickerVisual}>
              <ConnectTappableAvatar
                userId={senderUserId}
                name={senderName}
                size={58}
              />
              <Text style={styles.avatarStickerEmoji}>
                {avatarReaction.emoji}
              </Text>
            </View>
            <Text
              style={[
                styles.avatarStickerLabel,
                own && styles.avatarStickerLabelOwn,
              ]}
            >
              {avatarReaction.label}
            </Text>
          </View>
        )}

        {!!standaloneEmoji && (
          <Text style={styles.standaloneEmoji}>
            {standaloneEmoji}
          </Text>
        )}

        {!avatarReaction && !standaloneEmoji && !!bodyText && (
          <>
            {sharedPostSlot}
            <Text
              style={[
                styles.body,
                own && styles.bodyOwn,
              ]}
            >
              {bodyText}
            </Text>
          </>
        )}

        {slots.length === 1 && (
          <Pressable
            accessibilityLabel={
              slots[0].failed
                ? 'Photo failed to load. Retry.'
                : isGif
                  ? 'Open animated GIF'
                  : slots[0].uri
                    ? 'Open photo'
                    : 'Photo is loading'
            }
            onPress={() => {
              if (slots[0].failed) {
                onRetryPhoto?.(0);
                return;
              }
              if (slots[0].uri) {
                onOpenPhoto?.(0);
              }
            }}
            onLongPress={handleLongPress}
            delayLongPress={BUKLOD_LONG_PRESS_MS}
            style={[
              styles.inlineMediaPress,
              mediaOnly && { marginTop: 0 },
              { width: frame.width, height: frame.height },
            ]}
          >
            {slots[0].uri && !slots[0].failed ? (
              <ExpoImage
                source={{ uri: slots[0].uri }}
                style={styles.inlineMedia}
                contentFit="cover"
                transition={120}
                onError={() => onRetryPhoto?.(0)}
              />
            ) : (
              <View style={styles.mediaFallback}>
                {slots[0].failed ? (
                  <Text style={styles.mediaFallbackText}>
                    Tap to retry
                  </Text>
                ) : (
                  <ActivityIndicator color="#ffffff" />
                )}
              </View>
            )}
            {isGif && slots[0].uri && !slots[0].failed && (
              <View style={styles.gifBadge}>
                <Text style={styles.gifBadgeText}>GIF</Text>
              </View>
            )}
          </Pressable>
        )}

        {slots.length > 1 && (
          <View style={[styles.collage, mediaOnly && { marginTop: 0 }, { width: frame.width }]}>
            {slots.slice(0, 4).map((slot, index) => {
              const tile = collageTiles[index] ?? collageTiles[0];
              return renderSlot(slot, index, tile.width, tile.height);
            })}
          </View>
        )}

        {!!fileName && (
          <Pressable
            accessibilityLabel="Open attachment"
            onPress={onOpenFile}
            onLongPress={handleLongPress}
            delayLongPress={BUKLOD_LONG_PRESS_MS}
            style={[
              styles.fileChip,
              own && styles.fileChipOwn,
            ]}
          >
            <MaterialCommunityIcons
              name="paperclip"
              size={18}
              color={
                own
                  ? theme.textOnSentBubble
                  : theme.accent
              }
            />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={[
                  styles.fileName,
                  own && styles.fileNameOwn,
                ]}
              >
                {fileName}
              </Text>
              {!!fileSizeLabel && (
                <Text
                  style={[
                    styles.fileSize,
                    own && styles.fileSizeOwn,
                  ]}
                >
                  {fileSizeLabel}
                </Text>
              )}
            </View>
          </Pressable>
        )}
          </>
        )}

        {(showTime || !!deliveryLabel) && (
        <View style={[styles.timeRow, mediaOnly && styles.mediaOnlyMeta]}>
          {showTime && (
          <Text
            style={[
              styles.time,
              own &&
                !standaloneReaction && !mediaOnly &&
                styles.timeOwn,
            ]}
          >
            {timeLabel}
          </Text>
          )}
          {!!deliveryLabel && (
            <Text
              style={[
                styles.delivery,
                (standaloneReaction || mediaOnly) && styles.deliveryStandalone,
                deliveryNotSent && styles.deliveryNotSent,
              ]}
            >
              {deliveryLabel}
            </Text>
          )}
        </View>
        )}
      </Pressable>

          <ConnectReactionPicker
            own={own}
            stampEmoji={stampEmoji}
            totalReactions={totalReactions}
            pickerOpen={pickerOpen}
            options={reactionOptions}
            onSelect={onReact}
          />
        </View>
      </View>
      {seen.shown.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            seen.extra > 0
              ? `Seen by ${seen.shown.length + seen.extra} people`
              : `Seen by ${seen.shown.map(reader => reader.name).join(', ')}`
          }
          onPress={onPressSeenReaders}
          style={[
            styles.seenRow,
            own ? styles.seenRowOwn : styles.seenRowOther,
            showSenderAvatar &&
              (own
                ? styles.bubbleWithAvatarOwn
                : styles.bubbleWithAvatar),
          ]}
        >
          {seen.shown.map(reader => (
            <View key={reader.userId} style={styles.seenAvatar}>
              <ConnectTappableAvatar
                userId={reader.userId}
                name={reader.name}
                uri={reader.avatarUrl}
                size={22}
                onPress={onPressSeenReaders}
              />
            </View>
          ))}
          {seen.extra > 0 && (
            <View style={styles.seenExtra}>
              <Text style={styles.seenExtraText}>+{seen.extra}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}


