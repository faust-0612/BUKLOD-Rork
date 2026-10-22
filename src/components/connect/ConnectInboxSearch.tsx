import React, {
  useMemo,
} from 'react';
import {
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  connectRadii,
  connectSpacing,
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  inputRef?: React.Ref<TextInput | null>;
  placeholder?: string;
  trailing?: React.ReactNode;
  inline?: boolean;
};

function createStyles(
  theme: ConnectThemeRoles,
  inline: boolean
) {
  return StyleSheet.create({
    wrap: inline
      ? {
          flex: 1,
          minWidth: 0,
        }
      : {
          paddingHorizontal: connectSpacing.screenHorizontal,
          paddingBottom: 8,
        },
    bar: {
      minHeight: inline ? 40 : 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: connectRadii.search,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
    },
    input: {
      flex: 1,
      color: theme.textPrimary,
      ...connectTypography.searchPlaceholder,
      paddingVertical: 8,
    },
  });
}

export function ConnectInboxSearch({
  value,
  onChangeText,
  inputRef,
  placeholder = 'Search messages',
  trailing,
  inline = false,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme, inline),
    [theme, inline]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={theme.textMuted}
        />

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {trailing ?? (
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={theme.textMuted}
          />
        )}
      </View>
    </View>
  );
}
