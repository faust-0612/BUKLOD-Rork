import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function BuklodLifeWallCard() {
  const openLife = () => {
    router.push('/life' as any);
  };

  const openSoulWinner = () => {
    router.push('/life?mode=help' as any);
  };

  return (
    <View
      style={styles.card}
      accessibilityLabel="LIFE - Hope, Purpose, Direction"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Explore LIFE"
        onPress={openLife}
        style={styles.topRow}
      >
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="compass-outline"
            size={21}
            color="#275D45"
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>LIFE</Text>
          <Text style={styles.title}>Hope • Purpose • Direction</Text>
          <Text style={styles.subtitle}>
            Answers for the moments that matter.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color="#577466"
        />
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore LIFE"
          onPress={openLife}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Explore</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Help someone with LIFE"
          onPress={openSoulWinner}
          style={styles.secondary}
        >
          <MaterialCommunityIcons
            name="hand-heart-outline"
            size={16}
            color="#275D45"
          />
          <Text style={styles.secondaryText}>Help Someone</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE7E1',
    backgroundColor: '#F7FAF8',
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    color: '#275D45',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 1,
    color: '#173F31',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: '#647A70',
    fontSize: 10.5,
    lineHeight: 15,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#275D45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
  },
  secondary: {
    minHeight: 38,
    flex: 1,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFD2C8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryText: {
    color: '#275D45',
    fontSize: 11,
    fontWeight: '900',
  },
});
