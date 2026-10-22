import React, {
  useMemo,
  useRef,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
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
import {
  type ConnectMessageActionAnchor,
} from '@/components/connect/ConnectMessageActionSheet';
import {
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

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
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: connectRadii.bubble,
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
      backgroundColor: theme.bubbleSent,
      borderBottomRightRadius: connectRadii.bubbleTail,
    },
    bubbleOther: {
      backgroundColor: theme.bubbleReceived,
      borderBottomLeftRadius: connectRadii.bubbleTail,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
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
    photoBleedBubble: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      overflow: 'hidden',
    },
    mediaInCard: {
      marginHorizontal: -14,
    },
    sender: {
      marginBottom: 4,
      color: theme.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    body: {
      ...connectTypography.bubbleBody,
      color: theme.textPrimary,
    },
    bodyOwn: {
      color: theme.textOnSentBubble,
    },
    timeRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    time: {
      ...connectTypography.bubbleMeta,
      color: theme.textMuted,
    },
    timeOwn: {
      color: 'rgba(255,255,255,0.72)',
    },
    timeOnPhoto: {
      color: theme.textMuted,
    },
    photoTimeRow: {
      paddingHorizontal: 4,
      paddingTop: 4,
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
      width: '100%',
      maxWidth: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: 'transparent',
    },
    inlineMedia: {
      width: '100%',
      height: 240,
    },
    inlineGif: {
      backgroundColor: '#F4F6F5',
    },
    collage: {
      width: '100%',
      maxWidth: '100%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    collageRow: {
      flexDirection: 'row',
      gap: 2,
    },
    collageRowGap: {
      marginTop: 2,
    },
    collageTile: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.08)',
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

const CONNECT_PHOTO_ROWS: Record<number, number[]> = {
  1: [1],
  2: [2],
  3: [1, 2],
  4: [2, 2],
  5: [2, 3],
  6: [3, 3],
  7: [3, 2, 2],
  8: [3, 3, 2],
  9: [3, 3, 3],
  10: [3, 3, 2, 2],
};

function buildConnectPhotoRows(urls: string[]) {
  const pattern = CONNECT_PHOTO_ROWS[urls.length] ?? [urls.length];
  const rows: string[][] = [];
  let cursor = 0;

  for (const columns of pattern) {
    rows.push(urls.slice(cursor, cursor + columns));
    cursor += columns;
  }

  return rows.filter(row => row.length > 0);
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

  const photoOnly =
    albumUrls.length > 0 &&
    !bodyText &&
    !replyQuote &&
    !senderLabel &&
    !fileName &&
    !deleted &&
    !avatarReaction &&
    !standaloneEmoji;

  const collageRows = buildConnectPhotoRows(
    albumUrls.slice(0, 10),
  );
  const hiddenPhotoCount = Math.max(0, albumUrls.length - 10);

  return (
    <View
      style={[
        styles.wrap,
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
              photoOnly && styles.photoBleedBubble,
            ]}
            onLongPress={handleLongPress}
            delayLongPress={BUKLOD_LONG_PRESS_MS}
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

        {albumUrls.length === 1 && (
          <Pressable
            accessibilityLabel={
              isGif ? 'Open animated GIF' : 'Open photo'
            }
            onPress={() => onOpenPhoto?.(0)}
            onLongPress={handleLongPress}
            delayLongPress={BUKLOD_LONG_PRESS_MS}
            style={[
              styles.inlineMediaPress,
              !photoOnly && styles.mediaInCard,
            ]}
          >
            <ExpoImage
              source={{ uri: albumUrls[0] }}
              style={[
                styles.inlineMedia,
                isGif && styles.inlineGif,
              ]}
              contentFit={isGif ? 'contain' : 'cover'}
              transition={120}
            />
            {isGif && (
              <View style={styles.gifBadge}>
                <Text style={styles.gifBadgeText}>GIF</Text>
              </View>
            )}
          </Pressable>
        )}

        {albumUrls.length > 1 && (
          <View style={[styles.collage, !photoOnly && styles.mediaInCard]}>
            {collageRows.map((row, rowIndex) => (
              <View
                key={`photo-row-${rowIndex}`}
                style={[
                  styles.collageRow,
                  rowIndex > 0 && styles.collageRowGap,
                ]}
              >
                {row.map((uri, columnIndex) => {
                  const index = collageRows
                    .slice(0, rowIndex)
                    .reduce((sum, item) => sum + item.length, 0) +
                    columnIndex;
                  const showMore =
                    hiddenPhotoCount > 0 &&
                    index === 9;

                  return (
                    <Pressable
                      key={`${uri}-${index}`}
                      accessibilityLabel={
                        showMore
                          ? `Open photos, ${hiddenPhotoCount} more`
                          : `Open photo ${index + 1}`
                      }
                      onPress={() => onOpenPhoto?.(index)}
                      onLongPress={handleLongPress}
                      delayLongPress={BUKLOD_LONG_PRESS_MS}
                      style={[
                        styles.collageTile,
                        {
                          height: row.length >= 3 ? 108 : 136,
                        },
                      ]}
                    >
                      <ExpoImage
                        source={{ uri }}
                        style={styles.collageImage}
                        contentFit="cover"
                        transition={120}
                      />
                      {showMore && (
                        <View style={styles.collageMore} pointerEvents="none">
                          <Text style={styles.collageMoreText}>
                            +{hiddenPhotoCount}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
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

        <View style={[styles.timeRow, photoOnly && styles.photoTimeRow]}>
          <Text
            style={[
              styles.time,
              own &&
                !standaloneReaction &&
                !photoOnly &&
                styles.timeOwn,
              photoOnly && styles.timeOnPhoto,
            ]}
          >
            {timeLabel}
          </Text>
          {!!deliveryLabel && (
            <Text
              style={[
                styles.delivery,
                (standaloneReaction || photoOnly) && styles.deliveryStandalone,
                deliveryNotSent && styles.deliveryNotSent,
              ]}
            >
              {deliveryLabel}
            </Text>
          )}
        </View>
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
    </View>
  );
}
