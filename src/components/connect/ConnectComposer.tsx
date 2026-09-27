import React, {
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Image as ExpoImage,
} from 'expo-image';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

import {
  connectRadii,
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';

type SelectedFile = {
  name: string;
  sizeLabel: string;
  isImage: boolean;
} | null;

type SelectedPhoto = {
  id: string;
  uri: string;
};

type Props = {
  mode: 'direct' | 'scope';
  draft: string;
  selectedFile: SelectedFile;
  selectedPhotos: SelectedPhoto[];
  inputRef: React.Ref<TextInput | null>;
  replyToName?: string | null;
  replyToPreview?: string | null;
  onClearReply?: () => void;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  quickReaction?: string;
  quickReactionOptions?: readonly string[];
  onQuickReaction?: () => void;
  onSelectQuickReaction?: (emoji: string) => void;
  onAttachPress: () => void;
  onChoosePhoto: () => void;
  onClearFile: () => void;
  onPhotoPress: (id: string) => void;
  onPhotoLongPress: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onMovePhoto: (id: string, direction: -1 | 1) => void;
  onOpenComposerPicker: () => void;
};

const ICON_SIZE = 34;

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    selectedFile: {
      minHeight: 44,
      marginHorizontal: 8,
      marginBottom: 6,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    photoStrip: {
      minHeight: 80,
      marginHorizontal: 8,
      marginBottom: 6,
    },
    photoStripContent: {
      paddingVertical: 4,
      gap: 8,
      alignItems: 'center',
    },
    photoThumbWrap: {
      width: 68,
      alignItems: 'center',
      gap: 4,
    },
    photoThumb: {
      width: 68,
      height: 68,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    photoThumbImage: {
      width: '100%',
      height: '100%',
    },
    photoRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    photoReorderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    photoReorder: {
      width: 28,
      height: 22,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    selectedName: {
      color: theme.textPrimary,
      fontSize: 12.5,
      fontWeight: '900',
    },
    selectedSize: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: 12,
    },
    composer: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderSubtle,
      backgroundColor: theme.composerSurface,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    iconHit: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    emojiWrap: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiGlyph: {
      fontSize: 20,
      lineHeight: 24,
    },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 40,
      maxHeight: 108,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      borderRadius: connectRadii.composer,
      backgroundColor: theme.inputSurface,
      color: theme.textPrimary,
      ...connectTypography.composerInput,
      textAlignVertical: 'center',
    },
    send: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.fabBg,
    },
    quickReactionButton: {
      backgroundColor: theme.accentMuted,
    },
    quickReactionEmoji: {
      fontSize: 21,
      lineHeight: 25,
    },
    quickPickerBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,.28)',
    },
    quickPickerSheet: {
      paddingTop: 10,
      paddingHorizontal: 16,
      paddingBottom: 22,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: theme.surface,
    },
    quickPickerTitle: {
      marginBottom: 10,
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      textAlign: 'center',
    },
    quickPickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 9,
    },
    quickPickerChoice: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    quickPickerChoiceActive: {
      borderWidth: 2,
      borderColor: theme.accent,
    },
    quickPickerEmoji: {
      fontSize: 25,
      lineHeight: 30,
    },
    replyBanner: {
      marginHorizontal: 8,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
      borderRadius: 10,
      backgroundColor: theme.accentMuted,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    replyLabel: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    replyName: {
      marginTop: 2,
      color: theme.textPrimary,
      fontSize: 12.5,
      fontWeight: '800',
    },
    replyPreview: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: 12,
    },
  });
}

export function ConnectComposer({
  mode,
  draft,
  selectedFile,
  selectedPhotos,
  inputRef,
  replyToName,
  replyToPreview,
  onClearReply,
  onChangeDraft,
  onSend,
  quickReaction = '👍',
  quickReactionOptions = [],
  onQuickReaction,
  onSelectQuickReaction,
  onAttachPress,
  onChoosePhoto,
  onClearFile,
  onPhotoPress,
  onPhotoLongPress,
  onRemovePhoto,
  onMovePhoto,
  onOpenComposerPicker,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const [
    quickPickerOpen,
    setQuickPickerOpen,
  ] = useState(false);

  const hasSendContent =
    !!draft.trim() ||
    !!selectedFile ||
    selectedPhotos.length > 0;

  const showQuickReaction =
    mode === 'direct' &&
    !hasSendContent &&
    !!onQuickReaction;

  return (
    <>
      {selectedPhotos.length > 0 && (
        <ScrollView
          horizontal
          style={styles.photoStrip}
          contentContainerStyle={styles.photoStripContent}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {selectedPhotos.map((photo, index) => (
            <View key={photo.id} style={styles.photoThumbWrap}>
              <Pressable
                accessibilityLabel={`Preview photo ${index + 1}`}
                onPress={() => onPhotoPress(photo.id)}
                onLongPress={() => onPhotoLongPress(photo.id)}
                delayLongPress={BUKLOD_LONG_PRESS_MS}
                style={styles.photoThumb}
              >
                <ExpoImage
                  source={{ uri: photo.uri }}
                  style={styles.photoThumbImage}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  onPress={() => onRemovePhoto(photo.id)}
                  hitSlop={BUKLOD_HIT_SLOP}
                  style={styles.photoRemove}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={14}
                    color="#FFFFFF"
                  />
                </Pressable>
              </Pressable>
              {selectedPhotos.length > 1 && (
                <View style={styles.photoReorderRow}>
                  <Pressable
                    accessibilityLabel="Move photo left"
                    disabled={index === 0}
                    onPress={() => onMovePhoto(photo.id, -1)}
                    style={[
                      styles.photoReorder,
                      index === 0 && { opacity: 0.35 },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={16}
                      color={theme.accent}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Move photo right"
                    disabled={index === selectedPhotos.length - 1}
                    onPress={() => onMovePhoto(photo.id, 1)}
                    style={[
                      styles.photoReorder,
                      index === selectedPhotos.length - 1 && {
                        opacity: 0.35,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={theme.accent}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {!!selectedFile && (
        <View style={styles.selectedFile}>
          <MaterialCommunityIcons
            name={
              selectedFile.isImage
                ? 'image-outline'
                : 'file-outline'
            }
            size={18}
            color={theme.accent}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.selectedName}>
              {selectedFile.name}
            </Text>
            <Text style={styles.selectedSize}>
              {selectedFile.sizeLabel}
            </Text>
          </View>
          <Pressable onPress={onClearFile} hitSlop={BUKLOD_HIT_SLOP}>
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={theme.textMuted}
            />
          </Pressable>
        </View>
      )}

      {!!replyToName && (
        <View style={styles.replyBanner}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.replyLabel}>
              Replying to
            </Text>
            <Text
              numberOfLines={1}
              style={styles.replyName}
            >
              {replyToName}
            </Text>
            {!!replyToPreview && (
              <Text
                numberOfLines={2}
                style={styles.replyPreview}
              >
                {replyToPreview}
              </Text>
            )}
          </View>
          {onClearReply ? (
            <Pressable
              accessibilityLabel="Cancel reply"
              onPress={onClearReply}
              hitSlop={BUKLOD_HIT_SLOP}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={theme.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.composer}>
        <ConnectPressable
          onPress={onAttachPress}
          accessibilityLabel="Attach file"
          style={styles.iconHit}
        >
          <View style={styles.iconCircle} pointerEvents="none">
            <MaterialCommunityIcons
              name="paperclip"
              size={20}
              color={theme.accent}
            />
          </View>
        </ConnectPressable>

        <ConnectPressable
          onPress={onChoosePhoto}
          accessibilityLabel="Attach photo"
          style={styles.iconHit}
        >
          <View style={styles.iconCircle} pointerEvents="none">
            <MaterialCommunityIcons
              name="image-outline"
              size={20}
              color={theme.accent}
            />
          </View>
        </ConnectPressable>

        <View style={styles.emojiWrap}>
          <ConnectPressable
            accessibilityRole="button"
            accessibilityLabel="Emoji, GIF, and avatar"
            accessibilityHint="Opens emoji, GIF, and avatar options."
            onPress={onOpenComposerPicker}
            style={styles.iconHit}
          >
            <Text style={styles.emojiGlyph}>{'\u{1F642}'}</Text>
          </ConnectPressable>
        </View>

        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={
            mode === 'direct'
              ? 'Message...'
              : 'Message community...'
          }
          placeholderTextColor={theme.textMuted}
          multiline
          blurOnSubmit={false}
          style={styles.input}
        />

        {showQuickReaction ? (
          <ConnectPressable
            accessibilityRole="button"
            accessibilityLabel={`Send quick reaction ${quickReaction}`}
            accessibilityHint="Tap to send. Long press to change the quick reaction."
            nested={false}
            onPress={onQuickReaction}
            onLongPress={() => {
              if (
                quickReactionOptions.length &&
                onSelectQuickReaction
              ) {
                setQuickPickerOpen(true);
              }
            }}
            style={styles.iconHit}
          >
            <View
              style={[
                styles.send,
                styles.quickReactionButton,
              ]}
              pointerEvents="none"
            >
              <Text style={styles.quickReactionEmoji}>
                {quickReaction}
              </Text>
            </View>
          </ConnectPressable>
        ) : (
          <ConnectPressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            instant
            nested={false}
            onPress={onSend}
            style={styles.iconHit}
          >
            <View style={styles.send} pointerEvents="none">
              <MaterialCommunityIcons
                name="send"
                size={17}
                color={theme.fabText}
              />
            </View>
          </ConnectPressable>
        )}
      </View>

      <Modal
        transparent
        visible={quickPickerOpen}
        animationType="fade"
        onRequestClose={() =>
          setQuickPickerOpen(false)
        }
      >
        <Pressable
          style={styles.quickPickerBackdrop}
          onPress={() =>
            setQuickPickerOpen(false)
          }
        >
          <Pressable
            style={styles.quickPickerSheet}
            onPress={event =>
              event.stopPropagation()
            }
          >
            <Text style={styles.quickPickerTitle}>
              Choose your quick reaction
            </Text>
            <View style={styles.quickPickerRow}>
              {quickReactionOptions.map(emoji => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${emoji} as quick reaction`}
                  onPress={() => {
                    onSelectQuickReaction?.(
                      emoji
                    );
                    setQuickPickerOpen(
                      false
                    );
                  }}
                  style={[
                    styles.quickPickerChoice,
                    emoji === quickReaction &&
                      styles.quickPickerChoiceActive,
                  ]}
                >
                  <Text style={styles.quickPickerEmoji}>
                    {emoji}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
