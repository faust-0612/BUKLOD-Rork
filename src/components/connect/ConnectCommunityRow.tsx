import React, {
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
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
import { HIBLA } from '@/lib/connectHibla';
import {useBuklodScopePhoto} from '@/hooks/useBuklodScopePhoto';

type Props = {
  scopeId?: string;
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
      marginHorizontal: 9,
      marginBottom: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 82,
      borderRadius: 18,
      backgroundColor: HIBLA.paper,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HIBLA.outline,
    },
    unreadRow: {
      backgroundColor: HIBLA.mint,
    },
    threadNode: {
      position: 'absolute',
      left: -10,
      top: '50%',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#D93036',
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPhoto: {width:AVATAR_SIZE,height:AVATAR_SIZE,borderRadius:14},
    avatarOrg: {
      backgroundColor: '#E6F3E9',
      borderWidth: 0,
    },
    avatarScope: {
      backgroundColor: '#FFF0CF',
      borderWidth: 0,
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
      color: HIBLA.ink,
    },
    meta: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
      minWidth: 44,
    },
    time: {
      ...connectTypography.rowTime,
      color: HIBLA.muted,
    },
    preview: {
      marginTop: 3,
      ...connectTypography.rowPreview,
      color: HIBLA.muted,
    },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#C62828',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
      lineHeight: 13,
    },
  });
}

export function ConnectCommunityRow({
  scopeId,
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
  const scopePhoto=useBuklodScopePhoto(scopeId);

  const initials =
    initialsFromName(scopeName);

  const useInitials =
    scopeType === 'ORGANIZATION' ||
    scopeType === 'CLUSTER';

  return (
    <ConnectPressable
      onPress={onPressRow}
      style={[styles.row, unread > 0 && styles.unreadRow]}
    >
      {unread > 0 && <View pointerEvents="none" style={styles.threadNode} />}
      <View
        style={[
          styles.avatar,
          useInitials
            ? styles.avatarOrg
            : styles.avatarScope,
        ]}
      >
        {scopePhoto ? (
          <Image source={{uri:scopePhoto}} style={styles.avatarPhoto} resizeMode="cover" />
        ) : useInitials ? (
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
          style={styles.title}
        >
          {scopeName}
        </Text>

        <Text
          numberOfLines={1}
          style={styles.preview}
        >
          {preview}
        </Text>
      </View>

      <View style={styles.meta}>
        {!!timeLabel && (
          <Text style={styles.time}>
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

