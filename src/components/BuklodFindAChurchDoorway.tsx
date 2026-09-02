import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

export default function BuklodFindAChurchDoorway() {
  const { colors } = useBuklodPresentation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Find a Church"
      onPress={() => router.push('/churches')}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.white,
          borderColor: colors.line,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: colors.greenSoft },
        ]}
      >
        <MaterialCommunityIcons
          name="church"
          size={22}
          color={colors.greenDark}
        />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>
          Find a Church
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Nearby Churches • Pastor/Mentor • Join
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={colors.greenDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
});
