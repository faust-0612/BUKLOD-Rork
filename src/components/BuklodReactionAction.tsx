import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';

import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';
import {
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';
import {
  BUKLOD_HIT_SLOP_TIGHT,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';
import {
  withAlpha,
} from '@/lib/buklodContrast';

export type BuklodReactionOption = {
  key: string;
  emoji: string;
  label: string;
};

type Props = {
  options: readonly BuklodReactionOption[];
  counts?: Record<string, number> | null;
  mine?: string | null;
  compact?: boolean;
  overlay?: boolean;
  showSummary?: boolean;
  summaryProminent?: boolean;
  disabled?: boolean;
  onSelect: (key: string) => void;
  onOpenPicker?: () => void;
  onSummaryPress?: (
    reactionKey: string
  ) => void;
  layout?: 'default' | 'comment' | 'wall';
};

/* ASCII-only source escapes keep Community emoji stable.
 * Persistence keys stay on the existing Community backend set. */
export const BUKLOD_COMMUNITY_REACTION_OPTIONS: readonly BuklodReactionOption[] = [
  { key: 'with_you', emoji: '\uD83D\uDC4D', label: 'Like' },
  { key: 'love', emoji: '\u2764\uFE0F', label: 'Love' },
  { key: 'care', emoji: '\uD83E\uDD17', label: 'Care' },
  { key: 'haha', emoji: '\uD83D\uDE02', label: 'Haha' },
  { key: 'amen', emoji: '\uD83D\uDE2E', label: 'Wow' },
  { key: 'sad', emoji: '\uD83D\uDE22', label: 'Sad' },
  { key: 'praying', emoji: '\uD83D\uDE4F', label: 'Pray' },
];

export const BUKLOD_PUBLIC_COMMUNITY_REACTIONS =
  BUKLOD_COMMUNITY_REACTION_OPTIONS;

export const BUKLOD_SCOPE_COMMUNITY_REACTIONS =
  BUKLOD_COMMUNITY_REACTION_OPTIONS;

let lastUsedReactionKey: string | null = null;

export function rememberCommunityReaction(
  key: string
) {
  lastUsedReactionKey = key;
}

function preferredKey(
  options: readonly BuklodReactionOption[]
) {
  if (
    lastUsedReactionKey &&
    options.some(option => option.key === lastUsedReactionKey)
  ) {
    return lastUsedReactionKey;
  }

  return options[0]?.key ?? null;
}

function createStyles(
  theme: BuklodThemeRoles,
  compact: boolean,
  overlay: boolean,
  summaryProminent: boolean,
  layout: 'default' | 'comment' | 'wall'
) {
  const isComment = layout === 'comment';
  const isWall = layout === 'wall';
  const prominent =
    summaryProminent || isWall;
  const actionSize = overlay
    ? 45
    : isComment
      ? 22
      : compact
        ? 44
        : 46;

  return StyleSheet.create({
    wrap: {
      position: 'relative',
      overflow: 'visible',
      zIndex: 8,
      width: isComment || isWall ? '100%' : undefined,
      marginTop: isWall ? 0 : undefined,
    },
    row: {
      minHeight: actionSize,
      width: isComment || isWall ? '100%' : undefined,
      flexDirection: overlay ? 'column' : 'row',
      flexWrap: isComment || isWall ? 'wrap' : 'nowrap',
      alignItems: 'center',
      gap: isWall ? 10 : isComment ? 4 : compact ? 6 : 8,
    },
    action: {
      width: actionSize,
      height: actionSize,
      borderRadius: actionSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: overlay
        ? 'rgba(0,0,0,0.52)'
        : theme.surfaceElevated,
      borderWidth: 1,
      borderColor: overlay
        ? 'rgba(255,255,255,0.22)'
        : theme.border,
    },
    actionSelected: {
      backgroundColor: overlay
        ? '#287D54'
        : theme.accentSoft,
      borderColor: overlay
        ? '#FFFFFF'
        : theme.accent,
    },
    actionEmoji: {
      fontSize: isComment ? 12 : compact ? 18 : 20,
      lineHeight: isComment ? 14 : compact ? 22 : 24,
      textAlign: 'center',
    },
    summary: {
      flex: isComment || isWall ? 0 : 1,
      flexGrow: isComment || isWall ? 1 : 0,
      flexShrink: isComment || isWall ? 0 : 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: isWall ? 8 : isComment ? 3 : 4,
      maxWidth: isComment || isWall ? '100%' : undefined,
    },
    chip: {
      minHeight: isComment
        ? 18
        : prominent
          ? 30
          : compact
            ? 22
            : 24,
      paddingHorizontal: isComment
        ? 5
        : prominent
          ? 9
          : compact
            ? 6
            : 7,
      borderRadius: isComment ? 9 : prominent ? 15 : 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isComment ? 2 : prominent ? 4 : 3,
      backgroundColor: withAlpha(theme.surfaceMuted, 0.92),
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipSelected: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
    chipEmoji: {
      fontSize: isComment
        ? 10
        : prominent
          ? 15
          : compact
            ? 12
            : 13,
      lineHeight: isComment
        ? 12
        : prominent
          ? 18
          : compact
            ? 15
            : 16,
    },
    chipCount: {
      fontSize: isComment
        ? 9
        : prominent
          ? 12
          : compact
            ? 10
            : 11,
      fontWeight: '900',
      color: theme.textMuted,
    },
    chipCountSelected: {
      color: theme.accent,
    },
    picker: {
      position: 'absolute',
      left: overlay ? -168 : 0,
      right: overlay ? 0 : undefined,
      // Deliberately overlap the action by 8px on web so there is no
      // dead hover gap while the pointer travels from the icon to the drawer.
      bottom: actionSize - 8,
      height: compact ? 44 : 46,
      paddingHorizontal: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 23,
      backgroundColor: theme.surfaceElevated,
      zIndex: 40,
      elevation: 16,
      shadowColor: theme.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 4,
      },
    },
    option: {
      minWidth: compact ? 40 : 44,
      height: compact ? 36 : 40,
      paddingHorizontal: 5,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionSelected: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    optionEmoji: {
      fontSize: compact ? 18 : 20,
      lineHeight: compact ? 22 : 24,
    },
  });
}

export function BuklodReactionAction({
  options,
  counts,
  mine,
  compact = false,
  overlay = false,
  showSummary = true,
  summaryProminent = false,
  layout = 'default',
  disabled = false,
  onSelect,
  onOpenPicker,
  onSummaryPress,
}: Props) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () =>
      createStyles(
        theme,
        compact,
        overlay,
        summaryProminent,
        layout
      ),
    [theme, compact, overlay, summaryProminent, layout]
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const reactingRef = useRef(false);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canHover = Platform.OS === 'web' && !disabled && !onOpenPicker;

  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
      }
    };
  }, []);

  const clearHoverClose = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const openPickerFromHover = () => {
    if (!canHover) {
      return;
    }

    clearHoverClose();
    setPickerOpen(true);
  };

  const schedulePickerCloseFromHover = () => {
    if (!canHover) {
      return;
    }

    clearHoverClose();
    // Give the pointer enough time to move naturally from the action to the
    // drawer, including trackpad/mouse movement that briefly exits both boxes.
    hoverCloseTimerRef.current = setTimeout(() => {
      setPickerOpen(false);
      hoverCloseTimerRef.current = null;
    }, 520);
  };

  const selected = options.find(option => option.key === mine) ?? null;
  const preview =
    selected ??
    options.find(option => option.key === preferredKey(options)) ??
    options[0];

  const summary = options.filter(
    option => Number(counts?.[option.key] ?? 0) > 0
  );

  const bounce = () => {
    scale.setValue(0.86);
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const apply = (key: string) => {
    if (disabled || reactingRef.current) {
      return;
    }

    reactingRef.current = true;
    rememberCommunityReaction(key);
    bounce();
    clearHoverClose();
    setPickerOpen(false);
    onSelect(key);

    setTimeout(() => {
      reactingRef.current = false;
    }, 450);
  };

  const onTap = () => {
    if (pickerOpen && Platform.OS !== 'web') {
      setPickerOpen(false);
      return;
    }

    const key = preferredKey(options);
    if (!key) {
      return;
    }
    apply(key);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <BuklodPressable
            accessibilityRole="button"
            accessibilityLabel={
              selected
                ? `${selected.label} reaction. Hover or long press for more reactions.`
                : 'Add reaction. Hover or long press for more reactions.'
            }
            disabled={disabled}
            nested
            compact
            delayLongPress={BUKLOD_LONG_PRESS_MS}
            onPress={onTap}
            onLongPress={() => onOpenPicker ? onOpenPicker() : setPickerOpen(true)}
            onHoverIn={openPickerFromHover}
            onHoverOut={schedulePickerCloseFromHover}
            style={({ pressed }) => [
              styles.action,
              !!selected && styles.actionSelected,
              pressed && { opacity: 0.72 },
            ]}
          >
            <Text style={styles.actionEmoji}>
              {preview?.emoji ?? '\u2764\uFE0F'}
            </Text>
          </BuklodPressable>
        </Animated.View>

        {showSummary && summary.length > 0 && (
          <View style={styles.summary}>
            {summary.map(option => (
              onSummaryPress
                ? (
                  <BuklodPressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${option.label} reactions`}
                    nested
                    hitSlop={BUKLOD_HIT_SLOP_TIGHT}
                    onPress={() =>
                      onSummaryPress(
                        option.key
                      )
                    }
                    style={[
                      styles.chip,
                      option.key === mine && styles.chipSelected,
                    ]}
                  >
                    <Text style={styles.chipEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.chipCount,
                        option.key === mine && styles.chipCountSelected,
                      ]}
                    >
                      {Number(counts?.[option.key] ?? 0)}
                    </Text>
                  </BuklodPressable>
                )
                : (
                  <View
                    key={option.key}
                    style={[
                      styles.chip,
                      option.key === mine && styles.chipSelected,
                    ]}
                  >
                    <Text style={styles.chipEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.chipCount,
                        option.key === mine && styles.chipCountSelected,
                      ]}
                    >
                      {Number(counts?.[option.key] ?? 0)}
                    </Text>
                  </View>
                )
            ))}
          </View>
        )}
      </View>

      {pickerOpen && (
        <Pressable
          onHoverIn={openPickerFromHover}
          onHoverOut={schedulePickerCloseFromHover}
          style={styles.picker}
        >
          {options.map(option => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              disabled={disabled}
              onPressIn={() => apply(option.key)}
              style={({ pressed }) => [
                styles.option,
                option.key === mine && styles.optionSelected,
                pressed && { opacity: 0.62 },
              ]}
            >
              <Text style={styles.optionEmoji}>{option.emoji}</Text>
            </Pressable>
          ))}
        </Pressable>
      )}
    </View>
  );
}

export default BuklodReactionAction;
