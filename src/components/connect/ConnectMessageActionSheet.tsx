import React, {
  useMemo,
} from 'react';
import {
  Dimensions,
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
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';

export type ConnectMessageActionAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ConnectMessageReactionOption = {
  key: string;
  emoji: string;
  label: string;
  count?: number;
  selected?: boolean;
};

type ActionItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  own: boolean;
  anchor: ConnectMessageActionAnchor | null;
  reactionOptions?: ConnectMessageReactionOption[];
  onReact?: (key: string) => void;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
};

const ACTION_WIDTH = 68;
const ACTION_BAR_HEIGHT = 58;
const REACTION_SIZE = 34;
const REACTION_ROW_HEIGHT = 44;
const BAR_GAP = 8;
const H_MARGIN = 12;
const COMPOSER_CLEARANCE = 88;

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    card: {
      position: 'absolute',
      maxWidth: '100%',
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 12,
      overflow: 'hidden',
    },
    reactionRow: {
      minHeight: REACTION_ROW_HEIGHT,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSubtle,
    },
    reactionContent: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      alignItems: 'center',
    },
    reactionButton: {
      width: REACTION_SIZE,
      height: REACTION_SIZE,
      borderRadius: REACTION_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionButtonSelected: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    reactionEmoji: {
      fontSize: 22,
      lineHeight: 26,
    },
    actionScrollContent: {
      paddingHorizontal: 4,
      paddingVertical: 4,
      alignItems: 'center',
    },
    action: {
      width: ACTION_WIDTH,
      minHeight: 50,
      paddingHorizontal: 4,
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: 12,
    },
    actionPressed: {
      backgroundColor: theme.accentMuted,
    },
    actionLabel: {
      color: theme.textPrimary,
      fontSize: 10.5,
      lineHeight: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    actionLabelDestructive: {
      color: '#B42318',
    },
  });
}

function rectsOverlap(
  a: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  },
  b: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  },
) {
  return !(
    a.left >= b.right ||
    a.right <= b.left ||
    a.top >= b.bottom ||
    a.bottom <= b.top
  );
}

function resolveCardPosition(
  anchor: ConnectMessageActionAnchor,
  actionCount: number,
  reactionCount: number,
  screen: {
    width: number;
    height: number;
    topInset: number;
    bottomInset: number;
  },
) {
  const actionBarWidth = Math.min(
    actionCount * ACTION_WIDTH + 8,
    screen.width - H_MARGIN * 2,
  );
  const reactionBarWidth = Math.min(
    reactionCount * REACTION_SIZE + 12,
    screen.width - H_MARGIN * 2,
  );
  const cardWidth = Math.max(
    actionBarWidth,
    reactionBarWidth,
    180,
  );
  const cardHeight =
    ACTION_BAR_HEIGHT +
    (reactionCount > 0
      ? REACTION_ROW_HEIGHT
      : 0);

  let left =
    anchor.x +
    anchor.width / 2 -
    cardWidth / 2;

  left = Math.max(
    H_MARGIN,
    Math.min(
      left,
      screen.width - cardWidth - H_MARGIN,
    ),
  );

  const bubbleRect = {
    left: anchor.x,
    top: anchor.y,
    right: anchor.x + anchor.width,
    bottom: anchor.y + anchor.height,
  };

  const bottomLimit =
    screen.height -
    screen.bottomInset -
    COMPOSER_CLEARANCE;

  const spaceBelow =
    bottomLimit - bubbleRect.bottom;
  const spaceAbove =
    bubbleRect.top - screen.topInset;

  let placement: 'above' | 'below' =
    spaceBelow >= cardHeight + BAR_GAP
      ? 'below'
      : 'above';

  if (
    placement === 'below' &&
    spaceBelow < cardHeight + BAR_GAP &&
    spaceAbove >= cardHeight + BAR_GAP
  ) {
    placement = 'above';
  }

  if (
    placement === 'above' &&
    spaceAbove < cardHeight + BAR_GAP &&
    spaceBelow >= cardHeight + BAR_GAP
  ) {
    placement = 'below';
  }

  let top =
    placement === 'below'
      ? bubbleRect.bottom + BAR_GAP
      : bubbleRect.top - cardHeight - BAR_GAP;

  const cardRect = () => ({
    left,
    top,
    right: left + cardWidth,
    bottom: top + cardHeight,
  });

  if (rectsOverlap(cardRect(), bubbleRect)) {
    placement =
      placement === 'below'
        ? 'above'
        : 'below';

    top =
      placement === 'below'
        ? bubbleRect.bottom + BAR_GAP
        : bubbleRect.top - cardHeight - BAR_GAP;
  }

  top = Math.max(
    screen.topInset + 8,
    Math.min(
      top,
      screen.height -
        screen.bottomInset -
        cardHeight -
        8,
    ),
  );

  return {
    top,
    left,
    width: cardWidth,
    placement,
  };
}

export function ConnectMessageActionSheet({
  visible,
  own,
  anchor,
  reactionOptions = [],
  onReact,
  onClose,
  onReply,
  onCopy,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
}: Props) {
  const { theme } = useConnectTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(theme),
    [theme],
  );
  const screen = Dimensions.get('window');

  const items: ActionItem[] = [
    {
      key: 'reply',
      label: 'Reply',
      icon: 'reply-outline',
      onPress: onReply,
    },
    {
      key: 'copy',
      label: 'Copy',
      icon: 'content-copy',
      onPress: onCopy,
    },
    {
      key: 'forward',
      label: 'Forward',
      icon: 'share-outline',
      onPress: onForward,
    },
    {
      key: 'delete-me',
      label: 'Delete for me',
      icon: 'eye-off-outline',
      destructive: true,
      onPress: onDeleteForMe,
    },
  ];

  if (own && onDeleteForEveryone) {
    items.push({
      key: 'delete-everyone',
      label: 'Delete for all',
      icon: 'delete-outline',
      destructive: true,
      onPress: onDeleteForEveryone,
    });
  }

  const position =
    anchor && visible
      ? resolveCardPosition(
          anchor,
          items.length,
          reactionOptions.length,
          {
            width: screen.width,
            height: screen.height,
            topInset: insets.top,
            bottomInset: insets.bottom,
          },
        )
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        {position ? (
          <View
            style={[
              styles.card,
              {
                top: position.top,
                left: position.left,
                width: position.width,
              },
            ]}
          >
            {reactionOptions.length > 0 && onReact ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.reactionRow}
                contentContainerStyle={
                  styles.reactionContent
                }
              >
                {reactionOptions.map(option => (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    onPress={() => {
                      onReact(option.key);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.reactionButton,
                      option.selected &&
                        styles.reactionButtonSelected,
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Text style={styles.reactionEmoji}>
                      {option.emoji}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.actionScrollContent
              }
            >
              {items.map(item => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.action,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={
                      item.destructive
                        ? '#B42318'
                        : theme.accent
                    }
                  />
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.actionLabel,
                      item.destructive &&
                        styles.actionLabelDestructive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
