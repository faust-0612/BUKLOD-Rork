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
  connectSpacing,
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import { colors } from '@/lib/theme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';

type Props = {
  scopeName: string;
  scopeType: string;
  preview: string;
  timeLabel?: string;
  unreadCount?: number;
  iconName: string;
  onPressRow: () => void;
};

function initialsFromName(value: string) {
  const parts =
    String(value ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 0) {
    return 'B';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[1][0]
  ).toUpperCase();
}

const AVATAR_SIZE = 52;

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: connectSpacing.rowGap,
      paddingHorizontal: connectSpacing.screenHorizontal,
      paddingVertical: connectSpacing.rowVertical,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSubtle,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarOrg: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    avatarScope: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    initials: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...connectTypography.rowTitle,
      color: theme.textPrimary,
    },
    unreadTitle: {
      fontWeight: '900',
    },
    meta: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
      minWidth: 44,
    },
    time: {
      ...connectTypography.rowTime,
      color: theme.textMuted,
    },
    unreadTime: {
      color: colors.danger,
      fontWeight: '800',
    },
    preview: {
      marginTop: 3,
      ...connectTypography.rowPreview,
      color: theme.textMuted,
    },
    unreadPreview: {
      color: theme.textPrimary,
      fontWeight: '700',
    },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger,
    },
    badgeText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '900',
      lineHeight: 13,
    },
  });
}

export function ConnectCommunityRow({
  scopeName,
  scopeType,
  preview,
  timeLabel,
  unreadCount = 0,
  iconName,
  onPressRow,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const unread =
    Math.max(0, unreadCount);

  const initials =
    initialsFromName(scopeName);

  const useInitials =
    scopeType === 'ORGANIZATION' ||
    scopeType === 'CLUSTER';

  return (
    <ConnectPressable
      onPress={onPressRow}
      style={styles.row}
    >
      <View
        style={[
          styles.avatar,
          useInitials
            ? styles.avatarOrg
            : styles.avatarScope,
        ]}
      >
        {useInitials ? (
          <Text style={styles.initials}>
            {initials}
          </Text>
        ) : (
          <MaterialCommunityIcons
            name={iconName as any}
            size={22}
            color={theme.textPrimary}
          />
        )}
      </View>

      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            unread > 0 && styles.unreadTitle,
          ]}
        >
          {scopeName}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.preview,
            unread > 0 && styles.unreadPreview,
          ]}
        >
          {preview}
        </Text>
      </View>

      <View style={styles.meta}>
        {!!timeLabel && (
          <Text
            style={[
              styles.time,
              unread > 0 && styles.unreadTime,
            ]}
          >
            {timeLabel}
          </Text>
        )}

        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        )}
      </View>
    </ConnectPressable>
  );
}
