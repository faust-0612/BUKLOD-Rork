import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  CONNECT_GIF_CATALOG,
  type ConnectGifCatalogItem,
} from '@/lib/buklodConnectGifCatalog';
import {
  useBuklodDrawerBottomInset,
} from '@/lib/buklodSafeArea';
import { colors } from '@/lib/theme';

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
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
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

  const pickGifFromPhone = async () => {
    if (pickingPhoto || busy) return;
    setPickingPhoto(true);
    try {
      const [photo] = await pickCommunityPhotos({
        remaining: 1, maxPhotos: 1, preserveAnimation: true,
      });
      if (!photo?.uri) return;
      if (!isPickedGif(photo)) {
        Alert.alert('GIF', 'Select an animated .gif file from your phone.');
        return;
      }
      onMediaChange({ kind: 'gif', ref: photo.uri }, photo.uri);
      setGifOpen(false);
      setReactionOpen(false);
    } catch (error: any) {
      Alert.alert('GIF', error?.message ?? 'Could not select this GIF.');
    } finally {
      setPickingPhoto(false);
    }
  };

  // The parent sheet owns keyboard avoidance; padding the composer by the
  // keyboard height a second time moves its controls behind the IME.
  const bottomPad = drawerBottomInset;

  const gifItems = useMemo(
    () => CONNECT_GIF_CATALOG.slice(0, 48),
    [],
  );

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
      style={[styles.input, { maxHeight: Math.max(150, Math.min(320, 150 * fontScale)) }]}
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

      <Modal
        visible={gifOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGifOpen(false)}
      >
        <View style={styles.gifModalRoot}>
          <Pressable
            style={styles.gifBackdrop}
            onPress={() => setGifOpen(false)}
          />
          <View
            style={[
              styles.gifSheet,
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
          <View style={styles.gifHead}>
            <Text style={styles.gifTitle}>Add a GIF</Text>
            <Pressable onPress={() => setGifOpen(false)} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose GIF from phone gallery"
            disabled={busy || pickingPhoto}
            onPress={() => void pickGifFromPhone()}
            style={{
              marginHorizontal: 14, marginBottom: 10, padding: 12,
              borderRadius: 12, flexDirection: 'row',
              alignItems: 'center', gap: 8, backgroundColor: '#E8F5EE',
            }}
          >
            {pickingPhoto ? <ActivityIndicator size="small" color={colors.green} /> :
              <MaterialCommunityIcons name="cellphone" size={20} color={colors.green} />}
            <Text style={{ color: colors.green, fontWeight: '800' }}>Choose GIF from phone</Text>
          </Pressable>
          <FlatList
            data={gifItems}
            keyExtractor={item => item.id}
            numColumns={3}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.gifGrid}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pickGif(item)}
                style={styles.gifCard}
              >
                <ExpoImage
                  source={{ uri: item.previewUri || item.url }}
                  style={styles.gifImage}
                  contentFit="cover"
                />
                <Text numberOfLines={1} style={styles.gifLabel}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
          </View>
        </View>
      </Modal>
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
  gifModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  gifBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  gifSheet: {
    maxHeight: '58%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
  },
  gifHead: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gifTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  gifGrid: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 8,
  },
  gifCard: {
    flex: 1,
    margin: 4,
    minWidth: '30%',
    maxWidth: '32%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
  gifImage: {
    width: '100%',
    height: 78,
  },
  gifLabel: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
});
