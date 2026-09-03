import React, {
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  compactEmbedded?: boolean;
  paddingTop: number;
  otherUserId?: string | null;
  showDirectCalls?: boolean;
  callStarting?: 'audio' | 'video' | null;
  onBack: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  rightSlot?: React.ReactNode;
  appearanceSlot?: React.ReactNode;
};

/*
 * BUKLOD_WEB_DIRECT_VOICE_CALL_R2
 *
 * Web intentionally exposes ONE personal-call control: voice call.
 * It uses React Native Web's plain Pressable instead of the shared gesture
 * wrapper so browser pointer/click events cannot be swallowed by nested chat
 * touch normalization. Native Android/iOS keep ConnectThreadHeader.tsx and
 * therefore keep their existing mobile behavior.
 */
function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 14,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSubtle,
      backgroundColor: theme.headerSurface,
      overflow: 'visible',
      position: 'relative',
      zIndex: 80,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: connectRadii.headerButton,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    callButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
      position: 'relative',
      zIndex: 220,
      cursor: 'pointer' as any,
    },
    callButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
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
      gap: 7,
      flexShrink: 0,
      marginLeft: 'auto',
      position: 'relative',
      zIndex: 180,
    },
    disabled: {
      opacity: 0.45,
      cursor: 'default' as any,
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
  callStarting = null,
  onBack,
  onAudioCall,
  onVideoCall: _onVideoCall,
  rightSlot,
  appearanceSlot,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  const callBusy = callStarting !== null;

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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start voice call"
            testID="buklod-web-direct-audio-call"
            disabled={callBusy || !onAudioCall}
            onPress={onAudioCall}
            hitSlop={10}
            style={({ pressed }) => [
              styles.callButton,
              (callBusy || !onAudioCall) && styles.disabled,
              pressed && !callBusy && !!onAudioCall
                ? styles.callButtonPressed
                : null,
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
                size={23}
                color={theme.accent}
              />
            )}
          </Pressable>
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
