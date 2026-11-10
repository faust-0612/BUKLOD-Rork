import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Public Home/Hub's Kingdom invitation only. The existing /games entry owns
 * character selection, station progress, game access, ads and reward rules.
 * No points, rank or local progress are awarded from this card.
 */
function BuklodKingdomHubCard() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buksan ang BUKLOD Kingdom"
      accessibilityHint="Pumunta sa mapa ng 13 character game centers"
      onPress={() => router.push('/games' as any)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={['#09213B', '#14385B', '#19665F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <View pointerEvents="none" style={styles.illustration}>
          <View style={styles.halo} />
          <MaterialCommunityIcons
            name="star-four-points"
            size={18}
            color="#F7D994"
            style={styles.starTop}
          />
          <MaterialCommunityIcons
            name="star-four-points"
            size={10}
            color="#F7D994"
            style={styles.starLower}
          />
          <MaterialCommunityIcons
            name="castle"
            size={116}
            color="#F0D08A"
            style={styles.castle}
          />
          <View style={styles.hillBack} />
          <View style={styles.hillFront} />
        </View>

        <View style={styles.content}>
          <View style={styles.eyebrowRow}>
            <MaterialCommunityIcons name="crown-outline" size={18} color="#F1D28D" />
            <Text style={styles.eyebrow}>BUKLOD KINGDOM</Text>
          </View>
          <Text style={styles.title}>Tuklasin ang Kaharian</Text>
          <Text style={styles.description}>
            Isang mundo ng mga laro, hamon at pakikipagsapalaran.
          </Text>
          <View style={styles.countRow}>
            <MaterialCommunityIcons name="compass-outline" size={15} color="#D9F7EF" />
            <Text style={styles.countText}>13 CHARACTER CENTERS</Text>
          </View>
          <View style={styles.action}>
            <Text style={styles.actionText}>Pasukin ang Kingdom</Text>
            <MaterialCommunityIcons name="arrow-right" size={19} color="#15314A" />
          </View>
        </View>
        <View pointerEvents="none" style={styles.goldLine} />
      </LinearGradient>
    </Pressable>
  );
}

export default React.memo(BuklodKingdomHubCard);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BDA768',
    backgroundColor: '#09213B',
  },
  cardPressed: { opacity: 0.88 },
  background: { minHeight: 208, overflow: 'hidden' },
  illustration: {
    position: 'absolute',
    right: -6,
    top: 0,
    bottom: 0,
    width: 195,
    opacity: 0.74,
  },
  halo: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    right: 19,
    top: 14,
    backgroundColor: '#497E85',
    opacity: 0.65,
  },
  castle: { position: 'absolute', right: 15, bottom: 15, opacity: 0.63 },
  starTop: { position: 'absolute', right: 19, top: 19 },
  starLower: { position: 'absolute', left: 13, top: 56 },
  hillBack: {
    position: 'absolute',
    height: 54,
    bottom: -30,
    left: -15,
    right: -35,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 90,
    backgroundColor: '#1A7774',
  },
  hillFront: {
    position: 'absolute',
    height: 46,
    bottom: -35,
    left: -55,
    right: -4,
    borderTopLeftRadius: 95,
    borderTopRightRadius: 110,
    backgroundColor: '#0D494C',
  },
  content: {
    minHeight: 208,
    paddingHorizontal: 18,
    paddingVertical: 17,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: {
    color: '#F1D28D',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    marginTop: 8,
    maxWidth: 285,
  },
  description: {
    color: '#E2F3F0',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 275,
    marginTop: 5,
  },
  countRow: {
    marginTop: 11,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  countText: {
    color: '#D9F7EF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  action: {
    marginTop: 13,
    minHeight: 36,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: '#F1D28D',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#15314A', fontSize: 13, fontWeight: '900' },
  goldLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#D9B975',
    opacity: 0.9,
  },
});
