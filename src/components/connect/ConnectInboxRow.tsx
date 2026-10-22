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
import {
  ConnectTappableAvatar,
} from '@/components/connect/ConnectTappableAvatar';

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
      paddingHorizontal: connectSpacing.screenHorizontal,
      paddingVertical: connectSpacing.rowVertical,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSubtle,
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
      color: theme.textMuted,
      flex: 1,
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
    <View style={styles.row}>
      <ConnectTappableAvatar
        userId={userId}
        uri={avatarUri}
        name={name}
        size={52}
      />

      <ConnectPressable
        onPress={onPressRow}
        style={styles.copyHit}
      >
        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              unread > 0 && styles.unreadTitle,
            ]}
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
              style={[
                styles.preview,
                unread > 0 && styles.unreadPreview,
              ]}
            >
              {preview}
            </Text>
          </View>
        </View>

        {!isSearchResult && (
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
        )}
      </ConnectPressable>
    </View>
  );
}
