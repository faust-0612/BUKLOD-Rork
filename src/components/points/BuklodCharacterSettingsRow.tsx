import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  useBuklodCharacterEventsOptional,
} from '@/components/character/BuklodCharacterEventProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import type { CharacterReactionsMode } from '@/lib/buklodCharacterEvents';

type Props = {
  compact?: boolean;
};

/** Character voice + reactions preferences. */
export default function BuklodCharacterSettingsRow({
  compact = false,
}: Props) {
  const ctx = useBuklodCharacterEventsOptional();
  const { theme } = useBuklodPresentation();

  if (!ctx) return null;

  const {
    voiceEnabled,
    setVoiceEnabled,
    reactionsMode,
    setReactionsMode,
  } = ctx;

  const cycleReactions = () => {
    const order: CharacterReactionsMode[] = [
      'full',
      'reduced',
      'off',
    ];
    const idx = order.indexOf(reactionsMode);
    setReactionsMode(order[(idx + 1) % order.length] ?? 'full');
  };

  const reactionsLabel =
    reactionsMode === 'full'
      ? 'Full'
      : reactionsMode === 'reduced'
        ? 'Reduced'
        : 'Off';

  return (
    <View
      style={[
        styles.row,
        compact && styles.rowCompact,
        {
          borderColor: theme.border,
          backgroundColor: theme.surfaceMuted,
        },
      ]}
    >
      <Pressable
        onPress={() => setVoiceEnabled(!voiceEnabled)}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: voiceEnabled
              ? theme.accent
              : theme.border,
            backgroundColor: voiceEnabled
              ? theme.accentSoft
              : theme.surface,
          },
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="switch"
        accessibilityState={{ checked: voiceEnabled }}
        accessibilityLabel="Character voice"
      >
        <MaterialCommunityIcons
          name={voiceEnabled ? 'volume-high' : 'volume-off'}
          size={16}
          color={voiceEnabled ? theme.accent : theme.textMuted}
        />
        <Text
          style={[
            styles.chipText,
            { color: voiceEnabled ? theme.accent : theme.textSecondary },
          ]}
        >
          Voice {voiceEnabled ? 'On' : 'Off'}
        </Text>
      </Pressable>

      <Pressable
        onPress={cycleReactions}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
          },
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Character reactions mode"
      >
        <MaterialCommunityIcons
          name="emoticon-happy-outline"
          size={16}
          color={theme.accent}
        />
        <Text style={[styles.chipText, { color: theme.textSecondary }]}>
          Reactions: {reactionsLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  rowCompact: {
    marginTop: 0,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
