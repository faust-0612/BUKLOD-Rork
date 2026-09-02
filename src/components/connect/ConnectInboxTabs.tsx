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
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';

type Tab = 'personal' | 'community';

type Props = {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    wrap: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 3,
      marginBottom: 8,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.surfaceElevated,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      minHeight: 34,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
    },
    tabActive: {
      backgroundColor: theme.tabActive,
    },
    label: {
      ...connectTypography.tabLabel,
      color: theme.textMuted,
    },
    labelActive: {
      color: theme.accent,
    },
  });
}

export function ConnectInboxTabs({
  tab,
  onTabChange,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  return (
    <View style={styles.wrap}>
      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{
          selected: tab === 'personal',
        }}
        instant
        nested={false}
        onPress={() => onTabChange('personal')}
        style={[
          styles.tab,
          tab === 'personal' && styles.tabActive,
        ]}
      >
        <MaterialCommunityIcons
          name="message-text-outline"
          size={16}
          color={
            tab === 'personal'
              ? theme.accent
              : theme.textMuted
          }
        />
        <Text
          style={[
            styles.label,
            tab === 'personal' && styles.labelActive,
          ]}
        >
          Personal
        </Text>
      </ConnectPressable>

      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{
          selected: tab === 'community',
        }}
        instant
        nested={false}
        onPress={() => onTabChange('community')}
        style={[
          styles.tab,
          tab === 'community' && styles.tabActive,
        ]}
      >
        <MaterialCommunityIcons
          name="account-group-outline"
          size={16}
          color={
            tab === 'community'
              ? theme.accent
              : theme.textMuted
          }
        />
        <Text
          style={[
            styles.label,
            tab === 'community' && styles.labelActive,
          ]}
        >
          Community
        </Text>
      </ConnectPressable>
    </View>
  );
}
