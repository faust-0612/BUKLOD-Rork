import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';

import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import {
  ALL_CHAT_BACKGROUND_PRESETS,
  CHAT_GRADIENT_PRESETS,
  CHAT_PATTERN_PRESETS,
  CHAT_SOFT_PRESETS,
  CHAT_SOLID_PRESETS,
  DEFAULT_CHAT_BACKGROUND,
  clampChatBackgroundIntensity,
  type ChatBackgroundConfig,
  type ChatBackgroundOverlay,
  type ChatBackgroundScope,
} from '@/lib/chatBackground';
import {
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useChatBackground,
} from '@/providers/ChatBackgroundProvider';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When set, user can choose thread-only scope. */
  threadId?: string | null;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    sheet: {
      maxHeight: '88%',
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 24,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: theme.pickerSheet,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      marginBottom: 12,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 4,
    },
    sub: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },
    scopeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    scopePill: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    scopePillActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    scopeText: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 4,
    },
    tileRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
    },
    tile: {
      width: 72,
      alignItems: 'center',
      gap: 4,
    },
    tileSwatch: {
      width: 56,
      height: 56,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.borderSubtle,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileSwatchActive: {
      borderColor: theme.accent,
    },
    tileLabel: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    sliderBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    sliderValue: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    overlayRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    overlayPill: {
      flex: 1,
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    overlayPillActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    resetBtn: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      marginTop: 4,
    },
    resetText: {
      color: theme.danger,
      fontSize: 14,
      fontWeight: '800',
    },
    close: {
      marginTop: 8,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
    imageBtn: {
      minHeight: 48,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.surface,
    },
    imageBtnText: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });
}

function PresetTile({
  label,
  swatch,
  active,
  onPress,
  styles,
  theme,
  gradientColors,
}: {
  label: string;
  swatch: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: ConnectThemeRoles;
  gradientColors?: [string, string];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tile}
    >
      <View
        style={[
          styles.tileSwatch,
          active && styles.tileSwatchActive,
        ]}
      >
        {gradientColors ? (
          <LinearGradient
            colors={gradientColors}
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: swatch,
            }}
          />
        )}
        {active && (
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color={theme.accent}
            style={{
              position: 'absolute',
            }}
          />
        )}
      </View>
      <Text style={styles.tileLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ConnectChatBackgroundPanel({
  threadId,
}: {
  threadId?: string | null;
}) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const {
    globalBackground,
    threadBackground,
    effectiveSource,
    setBackground,
    resetBackground,
    previewBackground,
  } = useChatBackground();

  const canUseThreadScope = Boolean(threadId);
  const [
    scope,
    setScope,
  ] = useState<ChatBackgroundScope>(
    canUseThreadScope ? 'thread' : 'global'
  );

  const baseConfig =
    scope === 'thread' && threadBackground
      ? threadBackground
      : scope === 'thread'
        ? DEFAULT_CHAT_BACKGROUND
        : globalBackground;

  const [
    draft,
    setDraft,
  ] = useState<ChatBackgroundConfig>(baseConfig);

  React.useEffect(() => {
    setScope(
      canUseThreadScope ? 'thread' : 'global'
    );
  }, [canUseThreadScope, threadId]);

  React.useEffect(() => {
    const next =
      scope === 'thread' && threadBackground
        ? threadBackground
        : scope === 'thread'
          ? DEFAULT_CHAT_BACKGROUND
          : globalBackground;

    setDraft(next);
  }, [
    scope,
    globalBackground,
    threadBackground,
  ]);

  const applyDraft = useCallback(
    (next: ChatBackgroundConfig) => {
      setDraft(next);
      previewBackground(next);
    },
    [previewBackground]
  );

  const commitDraft = useCallback(
    (next: ChatBackgroundConfig) => {
      setDraft(next);
      setBackground(next, scope);
      previewBackground(null);
    },
    [setBackground, scope, previewBackground]
  );

  const pickImage = useCallback(async () => {
    const permissionGranted =
      await ensureImagePickerLibraryAccess(
        ImagePicker.requestMediaLibraryPermissionsAsync
      );

    if (!permissionGranted) {
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const next: ChatBackgroundConfig = {
      kind: 'customImage',
      imageUri: result.assets[0].uri,
      intensity: draft.intensity,
      overlay: draft.overlay === 'none'
        ? 'dim'
        : draft.overlay,
    };

    commitDraft(next);
  }, [commitDraft, draft.intensity, draft.overlay]);

  const adjustIntensity = (delta: number) => {
    const next = {
      ...draft,
      intensity: clampChatBackgroundIntensity(
        draft.intensity + delta
      ),
    };

    applyDraft(next);
    setBackground(next, scope);
  };

  const setOverlay = (
    overlay: ChatBackgroundOverlay
  ) => {
    const next = { ...draft, overlay };

    commitDraft(next);
  };

  const isActivePreset = (
    presetId: string
  ) =>
    draft.kind !== 'themeDefault' &&
    draft.presetId === presetId;

  const choosePreset = (
    preset: (typeof ALL_CHAT_BACKGROUND_PRESETS)[number]
  ) => {
    const next: ChatBackgroundConfig = {
      kind: preset.kind,
      presetId: preset.id,
      intensity: draft.intensity,
      overlay:
        preset.kind === 'pattern' ||
        preset.kind === 'gradient'
          ? draft.overlay === 'none'
            ? 'light'
            : draft.overlay
          : draft.overlay,
    };

    commitDraft(next);
  };

  const chooseThemeDefault = () => {
    commitDraft({ ...DEFAULT_CHAT_BACKGROUND });
  };

  const handleReset = () => {
    resetBackground(scope);
    setDraft({ ...DEFAULT_CHAT_BACKGROUND });
    previewBackground(null);
  };

  return (
    <>
      <Text style={styles.sub}>
        Separate from Messages theme. Currently{' '}
        {effectiveSource === 'theme'
          ? 'using theme default'
          : effectiveSource === 'global'
            ? 'using all-Messages override'
            : 'using this conversation override'}
        .
      </Text>

      {canUseThreadScope ? (
        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope('global')}
            style={[
              styles.scopePill,
              scope === 'global' &&
                styles.scopePillActive,
            ]}
          >
            <Text style={styles.scopeText}>
              All Messages
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope('thread')}
            style={[
              styles.scopePill,
              scope === 'thread' &&
                styles.scopePillActive,
            ]}
          >
            <Text style={styles.scopeText}>
              This chat
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>
          DEFAULT
        </Text>
        <View style={styles.tileRow}>
          <PresetTile
            label="Theme default"
            swatch={theme.canvas}
            active={
              draft.kind === 'themeDefault'
            }
            onPress={chooseThemeDefault}
            styles={styles}
            theme={theme}
          />
        </View>

        <Text style={styles.sectionLabel}>
          SOLID
        </Text>
        <View style={styles.tileRow}>
          {CHAT_SOLID_PRESETS.map(preset => (
            <PresetTile
              key={preset.id}
              label={preset.label}
              swatch={preset.swatch}
              active={isActivePreset(preset.id)}
              onPress={() =>
                choosePreset(preset)
              }
              styles={styles}
              theme={theme}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          SOFT / LIGHT
        </Text>
        <View style={styles.tileRow}>
          {CHAT_SOFT_PRESETS.map(preset => (
            <PresetTile
              key={preset.id}
              label={preset.label}
              swatch={preset.swatch}
              active={isActivePreset(preset.id)}
              onPress={() =>
                choosePreset(preset)
              }
              styles={styles}
              theme={theme}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          PATTERNS
        </Text>
        <View style={styles.tileRow}>
          {CHAT_PATTERN_PRESETS.map(preset => (
            <PresetTile
              key={preset.id}
              label={preset.label}
              swatch={preset.swatch}
              active={isActivePreset(preset.id)}
              onPress={() =>
                choosePreset(preset)
              }
              styles={styles}
              theme={theme}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          GRADIENTS
        </Text>
        <View style={styles.tileRow}>
          {CHAT_GRADIENT_PRESETS.map(preset => (
            <PresetTile
              key={preset.id}
              label={preset.label}
              swatch={preset.swatch}
              gradientColors={
                preset.gradientColors
              }
              active={isActivePreset(preset.id)}
              onPress={() =>
                choosePreset(preset)
              }
              styles={styles}
              theme={theme}
            />
          ))}
        </View>

        <ConnectPressable
          onPress={() => void pickImage()}
          style={styles.imageBtn}
        >
          <MaterialCommunityIcons
            name="image-outline"
            size={20}
            color={theme.accent}
          />
          <Text style={styles.imageBtnText}>
            Choose custom image
          </Text>
        </ConnectPressable>

        <Text style={styles.sectionLabel}>
          INTENSITY
        </Text>
        <View style={styles.sliderRow}>
          <Pressable
            onPress={() =>
              adjustIntensity(-0.1)
            }
            style={styles.sliderBtn}
          >
            <MaterialCommunityIcons
              name="minus"
              size={18}
              color={theme.accent}
            />
          </Pressable>
          <Text style={styles.sliderValue}>
            {Math.round(draft.intensity * 100)}%
          </Text>
          <Pressable
            onPress={() =>
              adjustIntensity(0.1)
            }
            style={styles.sliderBtn}
          >
            <MaterialCommunityIcons
              name="plus"
              size={18}
              color={theme.accent}
            />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>
          READABILITY OVERLAY
        </Text>
        <View style={styles.overlayRow}>
          {(
            ['none', 'light', 'dim'] as const
          ).map(option => (
            <Pressable
              key={option}
              onPress={() => setOverlay(option)}
              style={[
                styles.overlayPill,
                draft.overlay === option &&
                  styles.overlayPillActive,
              ]}
            >
              <Text style={styles.scopeText}>
                {option === 'none'
                  ? 'None'
                  : option === 'light'
                    ? 'Light'
                    : 'Dim'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleReset}
          style={styles.resetBtn}
        >
          <Text style={styles.resetText}>
            Reset to theme default
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

export function ConnectChatBackgroundEditor({
  visible,
  onClose,
  threadId,
}: Props) {
  const { theme } = useConnectTheme();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const { previewBackground } = useChatBackground();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: drawerBottomInset + 12 },
          ]}
          onPress={event =>
            event.stopPropagation()
          }
        >
          <View style={styles.handle} />
          <Text style={styles.title}>
            Edit chat background
          </Text>
          <ConnectChatBackgroundPanel
            threadId={threadId}
          />
          <Pressable
            onPress={() => {
              previewBackground(null);
              onClose();
            }}
            style={styles.close}
          >
            <Text style={styles.closeText}>
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ConnectChatBackgroundButton({
  threadId,
}: {
  threadId?: string | null;
}) {
  const { theme } = useConnectTheme();
  const [open, setOpen] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        trigger: {
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accentMuted,
          borderWidth: 1,
          borderColor: theme.borderSubtle,
        },
      }),
    [theme]
  );

  return (
    <>
      <ConnectPressable
        accessibilityRole="button"
        accessibilityLabel="Edit chat background"
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <MaterialCommunityIcons
          name="image-edit-outline"
          size={21}
          color={theme.accent}
        />
      </ConnectPressable>

      <ConnectChatBackgroundEditor
        visible={open}
        onClose={() => setOpen(false)}
        threadId={threadId}
      />
    </>
  );
}
