import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import BuklodMentionField from '@/components/BuklodMentionField';
import {
  BUKLOD_PUBLIC_COMMUNITY_REACTIONS,
} from '@/components/BuklodReactionAction';
import {
  type BuklodMention,
} from '@/lib/buklodMentionCompose';
import {
  type BuklodCommentMedia,
  buklodCommentHasSendableContent,
} from '@/lib/buklodCommentMediaBody';
import {
  pickCommunityPhotos,
} from '@/lib/buklodPickCommunityPhotos';
import { type ConnectGifCatalogItem } from '@/lib/buklodConnectGifCatalog';
import { BuklodCommunityGifPicker } from '@/components/BuklodCommunityGifPicker';
import {
  useBuklodDrawerBottomInset,
} from '@/lib/buklodSafeArea';
import { colors } from '@/lib/theme';
import { buklodComposerHeightLimits } from '@/lib/buklodAdaptiveInput';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  mentions: BuklodMention[];
  onMentionsChange: (mentions: BuklodMention[]) => void;
  audience?: string;
  groupId?: string | null;
  excludeUserId?: string | null;
  placeholder?: string;
  busy?: boolean;
  layout?: 'inline' | 'stacked';
  focusRequestKey?: string | null;
  media: BuklodCommentMedia | null;
  mediaPreviewUri?: string | null;
  onMediaChange: (media: BuklodCommentMedia | null, previewUri?: string | null) => void;
  onSend: () => void;
};

export default function BuklodCommunityCommentComposer({
  value,
  onChangeText,
  mentions,
  onMentionsChange,
  audience = 'public',
  groupId = null,
  excludeUserId,
  placeholder = 'Write a comment...',
  busy = false,
  layout = 'inline',
  focusRequestKey,
  media,
  mediaPreviewUri,
  onMediaChange,
  onSend,
}: Props) {
  const { fontScale, height } = useWindowDimensions();
  const inputSize = buklodComposerHeightLimits(fontScale, height, 'comment');
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [reactionOpen, setReactionOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const inputFocusRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (focusRequestKey) inputFocusRef.current?.focus();
  }, [focusRequestKey]);

  const canSend = buklodCommentHasSendableContent(value, media) && !busy;
  const previewUri =
    mediaPreviewUri ||
    (media?.kind === 'gif' ? media.ref : null);

  const insertReaction = (emoji: string) => {
    if (layout === 'inline') {
      onChangeText(value.trim() ? `${value.trim()} ${emoji}` : emoji);
      setReactionOpen(false);
      return;
    }
    const spacer = value && !/\s$/.test(value) ? ' ' : '';
    onChangeText(`${value}${spacer}${emoji}`);
    inputFocusRef.current?.focus();
  };

  const isPickedGif = (photo: { uri: string; mimeType?: string }) =>
    String(photo.mimeType ?? '').split(';')[0].trim().toLowerCase() === 'image/gif' ||
    /\.gif(?:[?#]|$)/i.test(photo.uri);

  const pickPhoto = async () => {
    if (pickingPhoto || busy) return;
    setPickingPhoto(true);
    try {
      const photos = await pickCommunityPhotos({ remaining: 1, maxPhotos: 1, preserveAnimation: true });
      const photo = photos[0];
      if (!photo?.uri) return;
      onMediaChange(
        { kind: isPickedGif(photo) ? 'gif' : 'image', ref: photo.uri },
        photo.uri,
      );
      setReactionOpen(false);
    } catch (error: any) {
      Alert.alert(
        'Photo',
        error?.message ?? 'Could not open your photos.',
      );
    } finally {
      setPickingPhoto(false);
    }
  };

  const pickGif = (gif: ConnectGifCatalogItem) => {
    const url = String(gif.url ?? '').trim();
    if (!url) return;
    onMediaChange({ kind: 'gif', ref: url }, url);
    setGifOpen(false);
    setReactionOpen(false);
  };


  // The parent sheet owns keyboard avoidance; padding the composer by the
  // keyboard height a second time moves its controls behind the IME.
  const bottomPad = drawerBottomInset;


  const mediaButtons = (
    <>
        <Pressable
          accessibilityLabel="Add photo"
          disabled={busy || pickingPhoto}
          onPress={() => void pickPhoto()}
          style={styles.tool}
        >
          {pickingPhoto ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <MaterialCommunityIcons
              name="image-outline"
              size={22}
              color={colors.green}
            />
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Add GIF"
          disabled={busy}
          onPress={() => setGifOpen(true)}
          style={styles.tool}
        >
          <MaterialCommunityIcons
            name="file-gif-box"
            size={22}
            color={colors.green}
          />
        </Pressable>

        <Pressable
          accessibilityLabel="Add reaction"
          disabled={busy}
          onPress={() => setReactionOpen(current => !current)}
          style={[styles.tool, reactionOpen && styles.toolOn]}
        >
          <MaterialCommunityIcons
            name="emoticon-outline"
            size={22}
            color={colors.green}
          />
        </Pressable>
    </>
  );

  const commentField = (
    <BuklodMentionField
      value={value}
      onChangeText={onChangeText}
      mentions={mentions}
      onMentionsChange={onMentionsChange}
      audience={audience}
      groupId={groupId}
      excludeUserId={excludeUserId}
      placeholder={placeholder}
      style={[styles.input, inputSize]}
      focusRef={inputFocusRef}
      maxLength={2000}
      disabled={busy}
      suggestionsAbove
    />
  );

  const sendButton = (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Posting comment' : 'Send comment'}
          accessibilityState={{ disabled: !canSend, busy }}
          disabled={!canSend}
          onPress={onSend}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
          )}
        </Pressable>
  );

  return (
    <View
      style={[
        styles.shell,
        { paddingBottom: bottomPad },
      ]}
    >
      {!!previewUri && (
        <View style={styles.previewRow}>
          <ExpoImage
            source={{ uri: previewUri }}
            style={styles.previewImage}
            contentFit="cover"
          />
          <Pressable
            accessibilityLabel="Remove attachment"
            disabled={busy}
            onPress={() => onMediaChange(null, null)}
            style={styles.previewRemove}
          >
            <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {reactionOpen ? (
        <View style={styles.reactionStrip}>
          {BUKLOD_PUBLIC_COMMUNITY_REACTIONS.map(option => (
            <Pressable
              key={option.key}
              accessibilityLabel={option.label}
              onPress={() => insertReaction(option.emoji)}
              style={styles.reactionChip}
            >
              <Text style={styles.reactionEmoji}>{option.emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {layout === 'stacked' ? (
        <View style={styles.stacked}>
          <View style={styles.expandedInputRow}>
            <View style={styles.fieldWrap}>{commentField}</View>
            {sendButton}
          </View>
          <View style={styles.expandedToolsRow}>
            {mediaButtons}
            <Text style={styles.toolsHint}>Photo · GIF · Emoji</Text>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          {mediaButtons}
          <View style={styles.fieldWrap}>{commentField}</View>
          {sendButton}
        </View>
      )}

      <BuklodCommunityGifPicker
        visible={gifOpen}
        onClose={() => setGifOpen(false)}
        onPickRemote={pickGif}
        onPick={file => {
          onMediaChange({ kind: 'gif', ref: file.uri }, file.uri);
          setGifOpen(false);
          setReactionOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    paddingTop: 7,
    paddingHorizontal: 6,
    gap: 5,
  },
  previewRow: {
    alignSelf: 'flex-start',
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewRemove: {
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
  reactionStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reactionEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  fieldWrap: {
    flex: 1,
    minWidth: 0,
  },
  stacked: {
    gap: 5,
  },
  expandedInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  expandedToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 2,
  },
  toolsHint: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 'auto',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  tool: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolOn: {
    borderColor: colors.green,
    backgroundColor: '#E8F5EE',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 150,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
    fontSize: 16,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
  },
  sendDisabled: {
    opacity: 0.4,
  },

});
