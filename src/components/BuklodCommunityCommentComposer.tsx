import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
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
  media,
  mediaPreviewUri,
  onMediaChange,
  onSend,
}: Props) {
  const insets = useSafeAreaInsets();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [keyboardPad, setKeyboardPad] = useState(0);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const lift = Math.max(
        0,
        Number(event.endCoordinates?.height ?? 0) - Math.max(insets.bottom, 0),
      );
      setKeyboardPad(Platform.OS === 'android' ? lift : 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardPad(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const canSend = buklodCommentHasSendableContent(value, media) && !busy;
  const previewUri =
    mediaPreviewUri ||
    (media?.kind === 'gif' ? media.ref : null);

  const insertReaction = (emoji: string) => {
    const next = value.trim()
      ? `${value.trim()} ${emoji}`
      : emoji;
    onChangeText(next);
    setReactionOpen(false);
  };

  const pickPhoto = async () => {
    if (pickingPhoto || busy) return;
    setPickingPhoto(true);
    try {
      const photos = await pickCommunityPhotos({ remaining: 1, maxPhotos: 1 });
      const photo = photos[0];
      if (!photo?.uri) return;
      onMediaChange(
        { kind: 'image', ref: photo.uri },
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

  const bottomPad =
    drawerBottomInset +
    (Platform.OS === 'android' ? keyboardPad : 0);

  const gifItems = useMemo(
    () => CONNECT_GIF_CATALOG.slice(0, 48),
    [],
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

      <View style={styles.row}>
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

        <BuklodMentionField
          value={value}
          onChangeText={onChangeText}
          mentions={mentions}
          onMentionsChange={onMentionsChange}
          audience={audience}
          groupId={groupId}
          excludeUserId={excludeUserId}
          placeholder={placeholder}
          style={styles.input}
        />

        <Pressable
          accessibilityLabel="Send comment"
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
      </View>

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
    paddingHorizontal: 9,
    gap: 7,
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
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
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
    minHeight: 42,
    maxHeight: 105,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
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
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
});
