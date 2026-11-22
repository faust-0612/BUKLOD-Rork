import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Null means the backend has not confirmed a value. Never invent zero. */
  points: number | null;
};

const numberFormat = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 0,
});

export default function BuklodLifetimePointsHero({ points }: Props) {
  const verified = typeof points === 'number' &&
    Number.isSafeInteger(points) && points >= 0;
  const formatted = verified ? numberFormat.format(points) : '—';

  return (
    <LinearGradient
      colors={['#FFF8DB', '#F9DF96', '#F1CA68']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID="profile-lifetime-gold-card"
      accessibilityLabel={verified
        ? `Lifetime Points: ${formatted} earned`
        : 'Lifetime Points: verifying total'}
    >
      <View style={styles.heading}>
        <MaterialCommunityIcons name="trophy-award" size={23} color="#946416" />
        <Text style={styles.label}>LIFETIME POINTS</Text>
        <MaterialCommunityIcons name="star-four-points" size={16} color="#B37A20" />
      </View>
      <Text
        testID="profile-lifetime-point-value"
        allowFontScaling
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        numberOfLines={1}
        style={styles.value}
      >
        {formatted}
      </Text>
      <Text style={styles.description}>
        {verified ? 'Total earned BUKLOD Points · all time' : 'Verified total unavailable'}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#D9AA3F',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    shadowColor: '#8C6126',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  label: {
    color: '#755018',
    fontSize: 13,
    letterSpacing: 1.1,
    fontWeight: '900',
  },
  value: {
    color: '#986100',
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowRadius: 1,
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  description: {
    color: '#815E27',
    fontSize: 11,
    fontWeight: '700',
  },
});
