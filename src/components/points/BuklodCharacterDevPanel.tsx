import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBuklodCharacterEventsOptional } from '@/components/character/BuklodCharacterEventProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { CharacterEventType } from '@/lib/buklodCharacterEvents';
import { withAlpha } from '@/lib/buklodContrast';

const PROOF_EVENTS: { label: string; type: CharacterEventType }[] = [
  { label: 'NOD', type: CharacterEventType.NOD },
  { label: 'NOD SLOW', type: CharacterEventType.NOD_SLOW },
  { label: 'WAVE', type: CharacterEventType.WAVE },
  { label: 'WAVE SLOW', type: CharacterEventType.WAVE_SLOW },
  { label: 'POINT', type: CharacterEventType.POINT },
  { label: 'POINT SLOW', type: CharacterEventType.POINT_SLOW },
];

type Props = {
  skeletonOn?: boolean;
  onToggleSkeleton?: () => void;
};

/** __DEV__ only — joint proof + skeleton overlay. */
export default function BuklodCharacterDevPanel({
  skeletonOn = false,
  onToggleSkeleton,
}: Props) {
  const events = useBuklodCharacterEventsOptional();
  const { theme } = useBuklodPresentation();

  if (!__DEV__ || !events) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.banner, { color: theme.warning }]}>
        DEV — skeleton / joint proof
      </Text>
      <View style={styles.row}>
        {PROOF_EVENTS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() =>
              events.emitCharacterEvent({
                type: item.type,
                success: true,
              })
            }
            style={({ pressed }) => [
              styles.btn,
              {
                borderColor: withAlpha(theme.warning, 0.55),
                backgroundColor: withAlpha(theme.surface, 0.9),
              },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Proof ${item.label}`}
          >
            <Text style={[styles.btnText, { color: theme.warning }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onToggleSkeleton}
          style={({ pressed }) => [
            styles.btn,
            {
              borderColor: withAlpha(theme.warning, skeletonOn ? 0.9 : 0.55),
              backgroundColor: skeletonOn
                ? withAlpha(theme.warning, 0.22)
                : withAlpha(theme.surface, 0.9),
            },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Toggle skeleton overlay"
        >
          <Text style={[styles.btnText, { color: theme.warning }]}>
            SKELETON {skeletonOn ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 10,
    alignItems: 'center',
    gap: 6,
  },
  banner: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
