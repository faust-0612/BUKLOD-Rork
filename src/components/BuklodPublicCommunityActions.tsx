import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodPressable from '@/components/BuklodPressable';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

/*
 * BUKLOD_PUBLIC_COMMUNITY_ACTIONS_R24
 *
 * Public/personal navigation has one canonical landing surface: Community
 * Wall. BUKLOD Connect is intentionally entered from inside that surface,
 * while the underlying Messages route remains available for deep links and
 * notification routing.
 */
export default function BuklodPublicCommunityActions() {
  const { theme } = useBuklodTheme();

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 4,
        backgroundColor: theme.canvas,
      }}
    >
      <BuklodPressable
        accessibilityRole="button"
        accessibilityLabel="Open BUKLOD Connect"
        accessibilityHint="Opens your personal BUKLOD conversations"
        instant
        onPress={() => router.push('/messages' as any)}
        style={({ pressed }) => ({
          minHeight: 46,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.76 : 1,
        })}
      >
        <MaterialCommunityIcons
          name="message-processing-outline"
          size={21}
          color={theme.accent}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.textPrimary,
              fontSize: 14,
              fontWeight: '900',
            }}
          >
            BUKLOD Connect
          </Text>
          <Text
            style={{
              marginTop: 1,
              color: theme.textMuted,
              fontSize: 11.5,
              lineHeight: 15,
            }}
          >
            Messages and conversations
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.textMuted}
        />
      </BuklodPressable>
    </View>
  );
}
