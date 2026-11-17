import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ConnectNoteReaction } from '@/lib/buklodConnectNoteReactions';

export function BuklodNoteReactionChip({
  reaction,
  onPress,
}: {
  reaction?: ConnectNoteReaction;
  onPress?: () => void;
}) {
  const count = Math.max(0, Number(reaction?.total_reactions ?? 0));
  if (!onPress && !count) return null;
  const selected = reaction?.my_reaction === 'love';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={onPress ? (selected ? 'Remove love from note' : 'Love this note') : `${count} note reactions`}
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={styles.text}>❤{count ? ` ${count}` : ''}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    minHeight: 23,
    minWidth: 31,
    borderRadius: 12,
    paddingHorizontal: 5,
    marginTop: 3,
    backgroundColor: 'rgba(26,109,64,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: 'rgba(239,80,94,0.16)' },
  text: { color: '#BB3451', fontSize: 11, lineHeight: 15, fontWeight: '700' },
});
