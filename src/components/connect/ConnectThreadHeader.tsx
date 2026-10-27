import React, {
  useMemo,
  useState,
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

function createStyles(_theme: ConnectThemeRoles) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 12,
      paddingBottom: 15,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      backgroundColor: HIBLA.pine,
      overflow: 'visible',
      zIndex: 40,
    },
    headerButton: {
      width: 38,
      height: 42,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    callButton: {
      width: 40,
      height: 42,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      zIndex: 20,
      elevation: 20,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...connectTypography.headerTitle,
      color: '#FFFFFF',
      fontSize: 17,
      lineHeight: 21,
      fontFamily: 'serif',
    },
    sub: {
      marginTop: 5,
      ...connectTypography.headerSub,
      color: '#CEEFDD',
      fontSize: 11,
      letterSpacing: 0.7,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
      marginLeft: 'auto',
      zIndex: 30,
      elevation: 30,
    },
    disabled: {
      opacity: 0.45,
    },
    compactEmbedded: {
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      minHeight: 44,
      borderRadius: 0,
      backgroundColor: HIBLA.pine,
    },
    arc: {
      position: 'absolute',
      width: 180,
      height: 150,
      top: -58,
      right: -60,
      borderRadius: 90,
      borderWidth: 1,
      borderColor: 'rgba(157,231,192,0.26)',
    },
    arcGold: {
      right: -72,
      top: -40,
      borderColor: 'rgba(242,197,101,0.62)',
    },
    menuPopover: {
      position: 'absolute',
      right: 12,
      top: '100%',
      padding: 12,
      minWidth: 150,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: HIBLA.outline,
      backgroundColor: '#FFFFFF',
      elevation: 16,
      zIndex: 90,
    },
    menuLabel: {
      color: HIBLA.ink,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 7,
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
  const [menuOpen, setMenuOpen] = useState(false);

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
          minHeight: 68 + paddingTop,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.arc} />
      <View pointerEvents="none" style={[styles.arc, styles.arcGold]} />
      <ConnectPressable
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.headerButton}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={23}
          color="#FFFFFF"
        />
      </ConnectPressable>

      {!!otherUserId && (
        <ConnectTappableAvatar
          userId={otherUserId}
          name={title}
          size={46}
          shape="rounded"
        />
      )}

      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>
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
                color="#FFFFFF"
              />
            ) : (
              <MaterialCommunityIcons
                name="phone"
                size={22}
                color="#FFFFFF"
              />
            )}
          </ConnectPressable>

        </View>
      ) : rightSlot ? (
        <View style={styles.actions}>
          {rightSlot}
        </View>
      ) : null}

      <ConnectPressable
        accessibilityRole="button"
        accessibilityLabel="Conversation options and appearance"
        onPress={() => setMenuOpen(current => !current)}
        style={styles.headerButton}
      >
        <MaterialCommunityIcons name="dots-vertical" size={25} color="#FFFFFF" />
      </ConnectPressable>
      {menuOpen && !!appearanceSlot && (
        <View style={styles.menuPopover}>
          <Text style={styles.menuLabel}>Chat appearance</Text>
          {appearanceSlot}
        </View>
      )}
    </View>
  );
}

