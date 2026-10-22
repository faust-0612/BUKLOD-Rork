import React, {
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  ScrollView,
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
    callButton: {
      width: 44,
      height: 44,
      borderRadius: connectRadii.headerButton,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
      zIndex: 20,
      elevation: 20,
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
    actionsScroll: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '62%',
      marginLeft: 'auto',
    },
    actionsScrollFill: {
      flex: 1,
      minWidth: 0,
    },
    actionsEnd: {
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
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
  callStarting = null,
  onBack,
  onAudioCall,
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
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScrollFill}
          contentContainerStyle={[styles.actions, styles.actionsEnd]}
        >
          {appearanceSlot}
          {rightSlot}
        </ScrollView>
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
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScroll}
          contentContainerStyle={styles.actions}
        >
          {appearanceSlot}

          <ConnectPressable
            accessibilityRole="button"
            accessibilityLabel="Start voice call"
            testID="buklod-direct-audio-call"
            instant
            nested={false}
            hitSlop={8}
            disabled={callBusy || !onAudioCall}
            onPress={onAudioCall}
            style={[
              styles.callButton,
              (callBusy || !onAudioCall) && styles.disabled,
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
        </ScrollView>
      ) : rightSlot ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScroll}
          contentContainerStyle={styles.actions}
        >
          {appearanceSlot}
          {rightSlot}
        </ScrollView>
      ) : appearanceSlot ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScroll}
          contentContainerStyle={styles.actions}
        >
          {appearanceSlot}
        </ScrollView>
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
