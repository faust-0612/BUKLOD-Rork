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
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import {
  ConnectTappableAvatar,
} from '@/components/connect/ConnectTappableAvatar';
import { HIBLA } from '@/lib/connectHibla';

type Props = {
  userId: string;
  name: string;
  avatarUri?: string | null;
  preview: string;
  timeLabel?: string;
  unreadCount?: number;
  isSearchResult?: boolean;
  showSentIndicator?: boolean;
  onPressRow: () => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: connectSpacing.rowGap,
      marginHorizontal: 14,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
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
      backgroundColor: HIBLA.jade,
      borderWidth: 1,
      borderColor: HIBLA.paper,
    },
    copyHit: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: connectSpacing.rowGap,
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
    previewRow: {
      marginTop: 3,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    sentIcon: {
      marginRight: 4,
    },
    preview: {
      ...connectTypography.rowPreview,
      color: HIBLA.muted,
      flex: 1,
    },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: HIBLA.pine,
    },
    badgeText: {
      color: theme.unreadBadgeText,
      fontSize: 11,
      fontWeight: '900',
      lineHeight: 13,
    },
  });
}

export function ConnectInboxRow({
  userId,
  name,
  avatarUri,
  preview,
  timeLabel,
  unreadCount = 0,
  isSearchResult = false,
  showSentIndicator = false,
  onPressRow,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const unread =
    Math.max(0, unreadCount);

  return (
    <View style={[styles.row, unread > 0 && styles.unreadRow]}>
      <View pointerEvents="none" style={styles.threadNode} />
      <ConnectTappableAvatar
        userId={userId}
        uri={avatarUri}
        name={name}
        size={52}
        shape="rounded"
      />

      <ConnectPressable
        onPress={onPressRow}
        style={styles.copyHit}
      >
        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            style={styles.title}
          >
            {name}
          </Text>

          <View style={styles.previewRow}>
            {showSentIndicator && (
              <MaterialCommunityIcons
                name="check-all"
                size={14}
                color={theme.sentIndicator}
                style={styles.sentIcon}
              />
            )}

            <Text
              numberOfLines={1}
              style={styles.preview}
            >
              {preview}
            </Text>
          </View>
        </View>

        {!isSearchResult && (
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
        )}
      </ConnectPressable>
    </View>
  );
}

