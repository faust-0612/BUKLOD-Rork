import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import {
  BlurMask,
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  vec,
} from '@shopify/react-native-skia';

import { useAuth } from '@/providers/AuthProvider';
import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import type { BuklodGameResult } from '@/features/games/types';
import { BuklodGameLanguageControl, BuklodGameLanguageProvider } from './BuklodGameLanguage';
import BuklodGameBackdrop from './BuklodGameBackdrop';
import BuklodGameCharacterCompanion from './BuklodGameCharacterCompanion';
import BuklodGameplayReactionFX from './BuklodGameplayReactionFX.native';
import { useRorkGameAmbience } from './rorkAudio';
import { BuklodGameEntrance, BuklodGameVisualFX } from './BuklodGameVisualFX';
import type { BuklodGameBiome } from './quality';

type Props = {
  biome: BuklodGameBiome;
  gameId?: string;
  showCharacterCompanion?: boolean;
  children: React.ReactNode;
};

const palettes: Record<BuklodGameBiome, readonly [string, string, string]> = {
  forest: ['#06130f', '#123d2a', '#2c7448'],
  playground: ['#2a1748', '#6843a0', '#d884bf'],
  city: ['#0b1320', '#17324a', '#2c6678'],
  farm: ['#27300f', '#657427', '#c2a64a'],
  academy: ['#0c162a', '#27426f', '#c7a15b'],
  music: ['#1d0c29', '#4a1e61', '#9f477f'],
  strategy: ['#10151f', '#293648', '#607187'],
  art: ['#2f1720', '#6e3547', '#c9775d'],
  mission: ['#102019', '#2d513f', '#7d8d57'],
  treasury: ['#23180a', '#5a4017', '#b68a31'],
  agriculture: ['#29310e', '#5f6b21', '#9c8c34'],
  highlands: ['#18262c', '#405b62', '#849a90'],
  discovery: ['#11152e', '#303a68', '#5b6fb8'],
};

function routeGameId(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'games' || parts.length < 2) return undefined;
  return parts[parts.length - 1];
}

function withResultHandler(children: React.ReactNode, onFinish: (result: BuklodGameResult) => void) {
  const array = React.Children.toArray(children);
  let injected = false;
  for (let index = array.length - 1; index >= 0; index -= 1) {
    const child = array[index];
    if (!React.isValidElement(child)) continue;
    const previous = (child.props as any)?.onFinish as ((result: BuklodGameResult) => void) | undefined;
    array[index] = React.cloneElement(child as React.ReactElement<any>, {
      onFinish: (result: BuklodGameResult) => {
        previous?.(result);
        onFinish(result);
      },
    });
    injected = true;
    break;
  }
  return injected ? array : children;
}

export function BuklodGameStage({ biome, gameId, showCharacterCompanion = true, children }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();
  const resolvedGameId = gameId ?? routeGameId(pathname);
  const colors = [...palettes[biome]];
  const [screenFocused, setScreenFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [reducedMotion, setReducedMotion] = useState(false);
  const lightPhase = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReducedMotion(Boolean(value));
    }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      if (mounted) setReducedMotion(Boolean(value));
    });
    const state = AppState.addEventListener('change', value => {
      if (mounted) setAppActive(value === 'active');
    });
    return () => { mounted = false; motion.remove(); state.remove(); };
  }, []);
  useEffect(() => {
    cancelAnimation(lightPhase);
    if (screenFocused && appActive && !reducedMotion) {
      lightPhase.value = withRepeat(withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      lightPhase.value = 0;
    }
    return () => cancelAnimation(lightPhase);
  }, [screenFocused, appActive, reducedMotion, lightPhase]);
  const lightOneY = useDerivedValue(() => 90 + lightPhase.value * 44);
  const lightTwoX = useDerivedValue(() => 40 + lightPhase.value * 80);
  const lightThreeRadius = useDerivedValue(() => 75 + lightPhase.value * 30);
  useRorkGameAmbience(resolvedGameId);

  const recordResult = useCallback((result: BuklodGameResult) => {
    if (!userId || (resolvedGameId && result.gameId !== resolvedGameId)) return;
    recordBuklodKingdomPreviewResult(result, userId).catch(() => undefined);
  }, [resolvedGameId, userId]);

  const connectedChildren = withResultHandler(children, recordResult);

  return (
    <BuklodGameLanguageProvider gameId={resolvedGameId}>
      <View style={styles.shell}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <LinearGradient start={vec(0, 0)} end={vec(0, 900)} colors={colors} />
          </Fill>

          <Group blendMode="screen" opacity={0.5}>
            <Circle cx={310} cy={lightOneY} r={145} color="rgba(255,255,255,0.11)">
              <BlurMask blur={28} style="normal" />
            </Circle>
            <Circle cx={lightTwoX} cy={660} r={120} color="rgba(255,224,148,0.10)">
              <BlurMask blur={34} style="normal" />
            </Circle>
            <Circle cx={250} cy={520} r={lightThreeRadius} color="rgba(150,220,255,0.06)">
              <BlurMask blur={26} style="normal" />
            </Circle>
          </Group>
        </Canvas>
        <BuklodGameBackdrop gameId={resolvedGameId} opacity={0.36} />

        <BuklodGameVisualFX biome={biome} />
        <View style={styles.content}>
          <BuklodGameEntrance>{connectedChildren}</BuklodGameEntrance>
        </View>
        {/* Event-driven collectible/impact/win motion overlays the active game,
            never touch, progress, score, or backend authority. */}
        <BuklodGameplayReactionFX enabled={screenFocused && appActive && !reducedMotion} />
        {showCharacterCompanion ? <BuklodGameCharacterCompanion gameId={resolvedGameId} /> : null}
        <BuklodGameLanguageControl />
      </View>
    </BuklodGameLanguageProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
});
