import React, {
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  connectRadii,
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

type Props = {
  title: string;
  subtitle?: string;
  showSubtitle?: boolean;
  /** When true, renders a compact action row for embedded workspace Connect. */
  compactEmbedded?: boolean;
  paddingTop: number;
  otherUserId?: string | null;
  showDirectCalls?: boolean;
  callStarting?: 'audio' | 'video' | null;
  onBack: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  rightSlot?: React.ReactNode;
  /** Appearance / background controls shown in header actions. */
  appearanceSlot?: React.ReactNode;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 10,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSubtle,
      backgroundColor: theme.headerSurface,
      overflow: 'visible',
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: connectRadii.headerButton,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...connectTypography.headerTitle,
      color: theme.textPrimary,
    },
    sub: {
      marginTop: 1,
      ...connectTypography.headerSub,
      color: theme.accent,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
      marginLeft: 'auto',
    },
    disabled: {
      opacity: 0.45,
    },
    compactEmbedded: {
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      minHeight: 44,
    },
  });
}

export function ConnectThreadHeader({
  title,
  subtitle,
  showSubtitle = true,
  compactEmbedded = false,
  paddingTop,
  otherUserId,
  showDirectCalls = false,
  callStarting,
  onBack,
  onAudioCall,
  onVideoCall,
  rightSlot,
  appearanceSlot,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  if (compactEmbedded) {
    return (
      <View
        style={[
          styles.header,
          styles.compactEmbedded,
          {
            paddingTop,
            minHeight: 44 + paddingTop,
          },
        ]}
      >
        <View style={styles.actions}>
          {appearanceSlot}
          {rightSlot}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop,
          minHeight: 58 + paddingTop,
        },
      ]}
    >
      <ConnectPressable
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.headerButton}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={23}
          color={theme.accent}
        />
      </ConnectPressable>

      {!!otherUserId && (
        <ConnectTappableAvatar
          userId={otherUserId}
          name={title}
          size={36}
        />
      )}

      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {showSubtitle && !!subtitle && (
          <Text numberOfLines={1} style={styles.sub}>
            {subtitle}
          </Text>
        )}
      </View>

      {showDirectCalls ? (
        <View style={styles.actions}>
          {appearanceSlot}
          <ConnectPressable
            accessibilityRole="button"
            accessibilityLabel="Start voice call"
            disabled={callStarting !== null}
            onPress={onAudioCall}
            style={[
              styles.headerButton,
              callStarting !== null && styles.disabled,
            ]}
          >
            {callStarting === 'audio' ? (
              <ActivityIndicator
                size="small"
                color={theme.accent}
              />
            ) : (
              <MaterialCommunityIcons
                name="phone"
                size={22}
                color={theme.accent}
              />
            )}
          </ConnectPressable>


        </View>
      ) : rightSlot ? (
        <View style={styles.actions}>
          {appearanceSlot}
          {rightSlot}
        </View>
      ) : appearanceSlot ? (
        <View style={styles.actions}>
          {appearanceSlot}
        </View>
      ) : (
        <View style={styles.headerButton}>
          <MaterialCommunityIcons
            name="link-variant"
            size={21}
            color={theme.accent}
          />
        </View>
      )}
    </View>
  );
}
