import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import { buklodComposerHeightLimits } from '@/lib/buklodAdaptiveInput';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import {
  DEFAULT_HIBLA_REACTION,
  HIBLA,
  HIBLA_QUICK_REACTIONS,
  hiblaReactionPreferenceKey,
  isHiblaQuickReaction,
} from '@/lib/connectHibla';

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
  accountId: string;
  draft: string;
  selectedFile: SelectedFile;
  selectedPhotos: SelectedPhoto[];
  inputRef: React.Ref<TextInput | null>;
  replyToName?: string | null;
  replyToPreview?: string | null;
  onClearReply?: () => void;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onQuickReaction: (emoji: string) => void;
  onAttachPress: () => void;
  onChoosePhoto: () => void;
  onClearFile: () => void;
  onPhotoPress: (id: string) => void;
  onPhotoLongPress: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onMovePhoto: (id: string, direction: -1 | 1) => void;
  onOpenComposerPicker: () => void;
};

const ICON_SIZE = 40;

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
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: HIBLA.outline,
      backgroundColor: HIBLA.paper,
      paddingVertical: 7,
      paddingHorizontal: 12,
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
      backgroundColor: '#E6F3E9',
    },
    inputWrap: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      maxHeight: 112,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: HIBLA.outline,
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
    },
    emojiGlyph: {
      fontSize: 20,
      lineHeight: 24,
    },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      maxHeight: 110,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 0,
      borderRadius: 24,
      backgroundColor: 'transparent',
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
      backgroundColor: HIBLA.pine,
    },
    reactionText: {
      fontSize: 23,
      lineHeight: 29,
      textAlign: 'center',
    },
    chooserScrim: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(5,30,19,0.38)',
    },
    chooserCard: {
      backgroundColor: HIBLA.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 28,
    },
    chooserTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: HIBLA.ink,
    },
    chooserHint: {
      marginTop: 5,
      fontSize: 12,
      color: HIBLA.muted,
    },
    chooserRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 20,
      gap: 8,
    },
    chooserOption: {
      width: 68,
      minHeight: 78,
      borderRadius: 16,
      backgroundColor: HIBLA.mint,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    chooserOptionSelected: {
      borderWidth: 2,
      borderColor: HIBLA.jade,
    },
    chooserEmoji: {
      fontSize: 28,
    },
    chooserLabel: {
      color: HIBLA.ink,
      fontSize: 11,
      fontWeight: '700',
    },
    replyBanner: {
      marginHorizontal: 12,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderLeftWidth: 0,
      borderRadius: 16,
      backgroundColor: HIBLA.mint,
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
  accountId,
  draft,
  selectedFile,
  selectedPhotos,
  inputRef,
  replyToName,
  replyToPreview,
  onClearReply,
  onChangeDraft,
  onSend,
  onQuickReaction,
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
  const { fontScale, height } = useWindowDimensions();
  const inputSize = buklodComposerHeightLimits(fontScale, height, 'message');
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const [quickReaction, setQuickReaction] = useState(DEFAULT_HIBLA_REACTION);
  const [choosingReaction, setChoosingReaction] = useState(false);
  const hasMessagePayload = !!draft.trim() || !!selectedFile || selectedPhotos.length > 0;
  const lastKeyboardSendRef = useRef(0);
  const sendFromDesktopKeyboard = () => {
    if (Platform.OS !== 'web' || !hasMessagePayload) return;
    const now = Date.now();
    // RN Web may emit both key and submit for one physical Enter.
    if (now - lastKeyboardSendRef.current < 250) return;
    lastKeyboardSendRef.current = now;
    onSend();
  };

  useEffect(() => {
    let active = true;
    setQuickReaction(DEFAULT_HIBLA_REACTION);
    if (accountId) {
      void AsyncStorage.getItem(hiblaReactionPreferenceKey(accountId))
        .then(saved => {
          if (active && saved && isHiblaQuickReaction(saved)) {
            setQuickReaction(saved);
          }
        })
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [accountId]);

  const selectQuickReaction = (emoji: string) => {
    if (!isHiblaQuickReaction(emoji)) return;
    setQuickReaction(emoji);
    setChoosingReaction(false);
    if (accountId) {
      void AsyncStorage.setItem(hiblaReactionPreferenceKey(accountId), emoji)
        .catch(() => undefined);
    }
  };

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
              Sumasagot kay
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

        {Platform.OS === 'android' && process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1' ? (
          <ConnectPressable
            onPress={onAttachPress}
            accessibilityLabel="Choose a Google Drive or Android Files attachment"
            style={styles.iconHit}
          >
            <View style={styles.iconCircle} pointerEvents="none">
              <MaterialCommunityIcons name="google-drive" size={20} color={theme.accent} />
            </View>
          </ConnectPressable>
        ) : null}

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

        <View style={[styles.inputWrap, { maxHeight: inputSize.maxHeight + 2 }]}>
          <TextInput
            allowFontScaling
            ref={inputRef}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={mode === 'direct' ? 'Mag-type ng mensahe…' : 'Mensahe sa grupo…'}
            placeholderTextColor={theme.textMuted}
            multiline
            blurOnSubmit={false}
            returnKeyType={Platform.OS === 'web' ? 'send' : undefined}
            onSubmitEditing={Platform.OS === 'web' ? sendFromDesktopKeyboard : undefined}
            onKeyPress={Platform.OS === 'web' ? (event) => {
              const e = event as any;
              const key = e.nativeEvent?.key ?? e.key;
              const shifted = Boolean(e.nativeEvent?.shiftKey ?? e.shiftKey);
              const composing = Boolean(e.nativeEvent?.isComposing ?? e.isComposing);
              if (key !== 'Enter' || shifted || composing || e.nativeEvent?.repeat) return;
              e.preventDefault?.();
              sendFromDesktopKeyboard();
            } : undefined}
            style={[styles.input, inputSize]}
          />
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasMessagePayload ? 'Send message' : `Send ${quickReaction} quick reaction`}
          accessibilityHint={hasMessagePayload ? undefined : 'Long press to choose a different reaction'}
          onPress={hasMessagePayload ? onSend : () => onQuickReaction(quickReaction)}
          onLongPress={hasMessagePayload ? undefined : () => setChoosingReaction(true)}
          style={styles.iconHit}
        >
          <View style={styles.send} pointerEvents="none">
            {hasMessagePayload ? (
              <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
            ) : (
              <Text style={styles.reactionText}>{quickReaction}</Text>
            )}
          </View>
        </Pressable>
      </View>
      <Modal
        visible={choosingReaction}
        transparent
        animationType="fade"
        onRequestClose={() => setChoosingReaction(false)}
      >
        <Pressable style={styles.chooserScrim} onPress={() => setChoosingReaction(false)}>
          <Pressable style={styles.chooserCard} onPress={event => event.stopPropagation()}>
            <Text style={styles.chooserTitle}>Piliin ang mabilis na reaksyon</Text>
            <Text style={styles.chooserHint}>Ito ang lalabas kapag walang tina-type na mensahe.</Text>
            <View style={styles.chooserRow}>
              {HIBLA_QUICK_REACTIONS.map(option => (
                <Pressable
                  key={option.emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${option.label} as quick reaction`}
                  accessibilityState={{ selected: quickReaction === option.emoji }}
                  onPress={() => selectQuickReaction(option.emoji)}
                  style={[styles.chooserOption, quickReaction === option.emoji && styles.chooserOptionSelected]}
                >
                  <Text style={styles.chooserEmoji}>{option.emoji}</Text>
                  <Text style={styles.chooserLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

