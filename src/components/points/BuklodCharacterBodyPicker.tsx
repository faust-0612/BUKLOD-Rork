import React from 'react';

import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodCharacterApprovedComposite from '@/components/points/BuklodCharacterApprovedComposite';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import { defaultEquipment } from '@/lib/character-lab-core/catalog';
import { BASE_ASPECT } from '@/lib/character-lab-core/assets';
import type { BodyId } from '@/lib/character-lab-core/types';

type Props = {
  visible: boolean;
  onChoose: (body: BodyId) => void;
};

/** First-run body selection — explicit Male/Female choice. No silent default. */
export default function BuklodCharacterBodyPicker({
  visible,
  onChoose,
}: Props) {
  const { theme } = useBuklodPresentation();

  const preview = (body: BodyId) => (
    <Pressable
      key={body}
      onPress={() => onChoose(body)}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: withAlpha(theme.accent, 0.35),
          backgroundColor: withAlpha(theme.surface, 0.92),
        },
        pressed && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${body === 'female' ? 'female' : 'male'} character`}
    >
      <View
        style={[
          styles.previewFrame,
          { aspectRatio: BASE_ASPECT[body] },
        ]}
      >
        <BuklodCharacterApprovedComposite
          body={body}
          equipment={defaultEquipment(body)}
        />
      </View>
      <Text style={[styles.optionLabel, { color: theme.textPrimary }]}>
        {body === 'female' ? 'FEMALE' : 'MALE'}
      </Text>
      <Text style={[styles.optionMeta, { color: theme.textMuted }]}>
        {body === 'female' ? 'Feminine build' : 'Masculine build'}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: withAlpha('#040806', 0.88) },
        ]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: withAlpha(theme.accent, 0.28),
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            CHOOSE YOUR CHARACTER
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Pick a base body to begin. You can change this later in Customize.
          </Text>

          <View style={styles.row}>
            {preview('male')}
            {preview('female')}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  option: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  previewFrame: {
    width: '100%',
    height: undefined,
    minHeight: 168,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,12,10,0.6)',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  optionMeta: {
    fontSize: 10,
    fontWeight: '700',
  },
});
