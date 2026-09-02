import React, {
  useMemo,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';

export type ConnectReactionOption = {
  key: string;
  emoji: string;
  label: string;
  count: number;
  selected: boolean;
};

type Props = {
  own: boolean;
  stampEmoji?: string;
  totalReactions: number;
  pickerOpen: boolean;
  options: ConnectReactionOption[];
  onSelect: (key: string) => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    row: {
      position: 'absolute',
      bottom: -10,
      zIndex: 70,
    },
    rowOwn: {
      left: 6,
      right: undefined,
      alignItems: 'flex-start',
    },
    rowOther: {
      right: 6,
      left: undefined,
      alignItems: 'flex-end',
    },
    stamp: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 20,
      paddingHorizontal: 5,
      paddingVertical: 1,
      gap: 2,
      borderRadius: 10,
      backgroundColor: theme.reactionStamp,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stampEmoji: {
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
    },
    stampCount: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '900',
      color: theme.textSecondary,
    },
    picker: {
      position: 'absolute',
      top: -44,
      height: 42,
      paddingHorizontal: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 21,
      backgroundColor: theme.reactionSurface,
      zIndex: 80,
      elevation: 16,
    },
    pickerOwn: {
      right: 0,
    },
    pickerOther: {
      left: 0,
    },
    option: {
      minWidth: 34,
      height: 32,
      paddingHorizontal: 5,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    optionSelected: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    optionEmoji: {
      fontSize: 18,
      lineHeight: 22,
    },
    optionCount: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '900',
    },
    optionCountSelected: {
      color: theme.accent,
    },
  });
}

export function ConnectReactionPicker({
  own,
  stampEmoji,
  totalReactions,
  pickerOpen,
  options,
  onSelect,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  return (
    <View
      style={[
        styles.row,
        own ? styles.rowOwn : styles.rowOther,
      ]}
    >
      {totalReactions > 0 && (
        <View pointerEvents="none" style={styles.stamp}>
          <Text style={styles.stampEmoji}>
            {stampEmoji ?? ''}
          </Text>
          {totalReactions > 1 && (
            <Text style={styles.stampCount}>
              {totalReactions > 99 ? '99+' : totalReactions}
            </Text>
          )}
        </View>
      )}

      {pickerOpen && (
        <View
          style={[
            styles.picker,
            own ? styles.pickerOwn : styles.pickerOther,
          ]}
        >
          {options.map(option => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPressIn={() => onSelect(option.key)}
              style={({ pressed }) => [
                styles.option,
                option.selected && styles.optionSelected,
                pressed && { opacity: 0.58 },
              ]}
            >
              <Text style={styles.optionEmoji}>
                {option.emoji}
              </Text>
              {option.count > 0 && (
                <Text
                  style={[
                    styles.optionCount,
                    option.selected && styles.optionCountSelected,
                  ]}
                >
                  {option.count}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
