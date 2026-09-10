import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { getBuklodGameDefinition } from '@/features/games/registry';
import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from './BuklodGameFeedback';
import { useBuklodGameLanguage } from './BuklodGameLanguage';

/* BUKLOD_KINGDOM_PREMIUM_GAME_CHROME_R1 */

type Props = {
  gameId?: string;
  result: BuklodGameResult | null;
  onDismissResult: () => void;
};

function Stars({ count }: { count: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${count} stars`}>
      {[1, 2, 3].map((star) => (
        <MaterialCommunityIcons
          key={star}
          name={star <= count ? 'star' : 'star-outline'}
          size={24}
          color={star <= count ? '#ffd760' : 'rgba(255,255,255,0.36)'}
        />
      ))}
    </View>
  );
}

export default function BuklodGameChrome({ gameId, result, onDismissResult }: Props) {
  const { t } = useBuklodGameLanguage();
  const intro = useRef(new Animated.Value(0)).current;
  const definition = gameId ? getBuklodGameDefinition(gameId) : null;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(intro, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(intro, { toValue: 0.35, duration: 650, useNativeDriver: true }),
    ]).start();
  }, [intro]);

  const goToKingdom = () => {
    void playBuklodGameFeedback('move');
    router.replace('/games' as any);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={styles.topLeft} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Return to Kingdom Map', 'Bumalik sa Mapa ng Kaharian')}
          onPress={goToKingdom}
          style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="map-outline" size={17} color="#f4d071" />
          <Text style={styles.mapButtonText}>{t('KINGDOM', 'KAHARIAN')}</Text>
        </Pressable>

        {definition ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.missionStrip,
              {
                opacity: intro,
                transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [-7, 0] }) }],
              },
            ]}
          >
            <Text style={styles.missionEyebrow}>{t('CURRENT MISSION', 'KASALUKUYANG MISYON')}</Text>
            <Text numberOfLines={1} style={styles.missionTitle}>{definition.title}</Text>
            <Text numberOfLines={1} style={styles.missionSubtitle}>{definition.subtitle}</Text>
          </Animated.View>
        ) : null}
      </View>

      {result ? (
        <View style={styles.resultScrim}>
          <Animated.View style={styles.resultCard}>
            <LinearGradient
              colors={result.status === 'won' ? ['#173d31', '#0c201a'] : ['#3c2427', '#1c1113']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.resultSeal}>
              <MaterialCommunityIcons
                name={result.status === 'won' ? 'crown-outline' : 'shield-outline'}
                size={31}
                color={result.status === 'won' ? '#f4d071' : '#e6b4b4'}
              />
            </View>
            <Text style={styles.resultEyebrow}>
              {result.status === 'won' ? t('MISSION COMPLETE', 'MISYON NATAPOS') : t('MISSION REVIEW', 'SURIIN ANG MISYON')}
            </Text>
            <Text style={styles.resultTitle}>
              {result.status === 'won' ? t('The Kingdom Has Changed', 'May Nagbago sa Kaharian') : t('Prepare and Try Again', 'Maghanda at Subukan Muli')}
            </Text>
            <Stars count={result.stars} />

            <View style={styles.resultStats}>
              <View style={styles.resultStat}>
                <Text style={styles.resultValue}>{Math.max(0, result.score || 0).toLocaleString()}</Text>
                <Text style={styles.resultLabel}>{t('SCORE', 'ISKOR')}</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultStat}>
                <Text style={styles.resultValue}>+{Math.max(0, result.reward?.kingdomXp ?? 0)}</Text>
                <Text style={styles.resultLabel}>KINGDOM XP</Text>
              </View>
            </View>

            <Text style={styles.resultCopy}>
              {result.status === 'won'
                ? t('Return to the map to see your station progress reflected in the living world.', 'Bumalik sa mapa para makita ang progreso ng estasyon sa buhay na mundo.')
                : t('Your best score and stars are preserved. You can retry without losing earlier progress.', 'Nananatili ang pinakamahusay mong iskor at mga bituin. Maaari kang umulit nang hindi nawawala ang naunang progreso.')}
            </Text>

            <View style={styles.resultActions}>
              <Pressable
                accessibilityRole="button"
                onPress={goToKingdom}
                style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="map" size={17} color="#34260c" />
                <Text style={styles.primaryActionText}>{t('VIEW KINGDOM', 'TINGNAN ANG KAHARIAN')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDismissResult}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="replay" size={17} color="#e8f2f7" />
                <Text style={styles.secondaryActionText}>{t('KEEP PLAYING', 'MAGLARO PA')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topLeft: { position: 'absolute', left: 10, top: 10, zIndex: 85, flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: '68%' },
  mapButton: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(6,17,28,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(244,208,113,0.34)',
  },
  mapButtonText: { color: '#f4d071', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75 },
  missionStrip: {
    maxWidth: 260,
    minHeight: 45,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(6,17,28,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  missionEyebrow: { color: '#9fdcb7', fontSize: 6.7, fontWeight: '900', letterSpacing: 0.8 },
  missionTitle: { marginTop: 1, color: '#ffffff', fontSize: 10.5, fontWeight: '900' },
  missionSubtitle: { marginTop: 1, color: 'rgba(255,255,255,0.66)', fontSize: 7.5, fontWeight: '700' },
  resultScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 150,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(2,7,12,0.64)',
  },
  resultCard: {
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(244,208,113,0.48)',
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 26,
    elevation: 14,
  },
  resultSeal: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,208,113,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(244,208,113,0.32)',
  },
  resultEyebrow: { marginTop: 12, color: '#b8d9c3', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  resultTitle: { marginTop: 4, color: '#ffffff', fontSize: 22, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  stars: { marginTop: 10, flexDirection: 'row', gap: 4 },
  resultStats: {
    marginTop: 16,
    width: '100%',
    minHeight: 62,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  resultStat: { flex: 1, alignItems: 'center' },
  resultDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.13)' },
  resultValue: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  resultLabel: { marginTop: 2, color: 'rgba(255,255,255,0.58)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.9 },
  resultCopy: { marginTop: 13, color: 'rgba(255,255,255,0.75)', fontSize: 10.5, lineHeight: 16, fontWeight: '600', textAlign: 'center' },
  resultActions: { width: '100%', marginTop: 17, flexDirection: 'row', gap: 8 },
  primaryAction: {
    flex: 1.2,
    minHeight: 43,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f3ce67',
  },
  primaryActionText: { color: '#34260c', fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  secondaryAction: {
    flex: 1,
    minHeight: 43,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  secondaryActionText: { color: '#e8f2f7', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.35 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
