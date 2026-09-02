/* BUKLOD_CHARACTER_STUDIO_LAYOUT_R2 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  BodyId,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  onChange: (
    body: BodyId
  ) => void;
};

export default function
BuklodCharacterBodySelectorV2({
  body,
  onChange,
}: Props) {
  return (
    <View
      style={styles.block}
    >
      <Text
        style={styles.label}
      >
        CHARACTER
      </Text>

      <View
        style={styles.row}
      >
        {([
          ['male', 'Male'],
          ['female', 'Female'],
        ] as const).map(
          ([value, label]) => {
            const active =
              body === value;

            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{
                  selected: active,
                }}
                onPress={() =>
                  onChange(
                    value as BodyId
                  )
                }
                style={[
                  styles.choice,
                  active &&
                    styles.choiceActive,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    active &&
                      styles.choiceTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    block: {
      alignSelf: 'stretch',
      marginTop: 10,
      marginBottom: 8,
    },

    label: {
      color: '#66757D',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginBottom: 7,
    },

    row: {
      flexDirection: 'row',
      gap: 8,
    },

    choice: {
      flex: 1,
      minHeight: 44,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        'rgba(31,122,61,0.18)',
      backgroundColor: '#FFFFFF',
    },

    choiceActive: {
      borderColor: '#177A39',
      backgroundColor: '#EAF6EE',
    },

    choiceText: {
      color: '#52616A',
      fontSize: 15,
      fontWeight: '800',
    },

    choiceTextActive: {
      color: '#116B31',
    },
  });