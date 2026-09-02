import React, {
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
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
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';

type Props = {
  onPress: () => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'flex-end',
      paddingHorizontal: connectSpacing.screenHorizontal,
      paddingBottom: connectSpacing.fabAboveSwitcher,
    },
    fab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 10,
      paddingRight: 18,
      paddingVertical: 10,
      borderRadius: connectRadii.fab,
      backgroundColor: theme.fabBg,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 8,
    },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.fabIconBackdrop,
    },
    label: {
      ...connectTypography.fabLabel,
      color: theme.fabText,
    },
  });
}

export function ConnectNewMessageFab({
  onPress,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  return (
    <View
      pointerEvents="box-none"
      style={styles.wrap}
    >
      <ConnectPressable
        accessibilityRole="button"
        accessibilityLabel="New message"
        instant
        nested={false}
        onPress={onPress}
        style={styles.fab}
      >
        <View style={styles.iconBox}>
          <MaterialCommunityIcons
            name="plus"
            size={18}
            color={theme.fabText}
          />
        </View>
        <Text style={styles.label}>
          New message
        </Text>
      </ConnectPressable>
    </View>
  );
}
