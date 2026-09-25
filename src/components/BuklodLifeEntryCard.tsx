import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

export default function BuklodLifeEntryCard() {
  const { colors } = useBuklodPresentation();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.border ?? '#D4E1D9',
          backgroundColor: colors.surface ?? '#FFFFFF',
        },
      ]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor:
                colors.greenDark ?? '#275D45',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="compass-rose"
            size={20}
            color="#FFFFFF"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              { color: colors.text ?? '#173F31' },
            ]}
          >
            LIFE
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.greenDark ?? '#275D45' },
            ]}
          >
            Hope • Purpose • Direction
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.body,
          { color: colors.muted ?? '#61756C' },
        ]}
      >
        Answers for the moments that matter.
      </Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore LIFE"
          onPress={() => router.push('/life' as any)}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor:
                colors.greenDark ?? '#275D45',
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>
            Explore
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open LIFE Help Someone guide"
          onPress={() =>
            router.push('/life?mode=help' as any)
          }
          style={({ pressed }) => [
            styles.secondary,
            {
              borderColor:
                colors.greenDark ?? '#275D45',
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.secondaryText,
              { color: colors.greenDark ?? '#275D45' },
            ]}
          >
            Help Someone
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  icon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
  },
  body: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    flex: 1,
    minHeight: 39,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    flex: 1,
    minHeight: 39,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  secondaryText: {
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
