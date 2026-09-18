import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
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

import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import type { BuklodGameResult } from '@/features/games/types';
import { BuklodGameLanguageControl, BuklodGameLanguageProvider } from './BuklodGameLanguage';
import BuklodGameBackdrop from './BuklodGameBackdrop';
import BuklodGameCharacterCompanion from './BuklodGameCharacterCompanion';
import { useRorkGameAmbience } from './rorkAudio';
import { BuklodGameEntrance, BuklodGameVisualFX } from './BuklodGameVisualFX';
import type { BuklodGameBiome } from './quality';

type Props = {
  biome: BuklodGameBiome;
  gameId?: string;
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

export function BuklodGameStage({ biome, gameId, children }: Props) {
  const pathname = usePathname();
  const resolvedGameId = gameId ?? routeGameId(pathname);
  const colors = [...palettes[biome]];
  useRorkGameAmbience(resolvedGameId);

  const recordResult = useCallback((result: BuklodGameResult) => {
    if (resolvedGameId && result.gameId !== resolvedGameId) return;
    recordBuklodKingdomPreviewResult(result).catch(() => undefined);
  }, [resolvedGameId]);

  const connectedChildren = withResultHandler(children, recordResult);

  return (
    <BuklodGameLanguageProvider gameId={resolvedGameId}>
      <View style={styles.shell}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <LinearGradient start={vec(0, 0)} end={vec(0, 900)} colors={colors} />
          </Fill>

          <Group blendMode="screen" opacity={0.5}>
            <Circle cx={310} cy={90} r={145} color="rgba(255,255,255,0.11)">
              <BlurMask blur={28} style="normal" />
            </Circle>
            <Circle cx={40} cy={660} r={120} color="rgba(255,224,148,0.10)">
              <BlurMask blur={34} style="normal" />
            </Circle>
            <Circle cx={250} cy={520} r={75} color="rgba(150,220,255,0.06)">
              <BlurMask blur={26} style="normal" />
            </Circle>
          </Group>
        </Canvas>
        <BuklodGameBackdrop gameId={resolvedGameId} opacity={0.36} />

        <BuklodGameVisualFX biome={biome} />
        <View style={styles.content}>
          <BuklodGameEntrance>{connectedChildren}</BuklodGameEntrance>
        </View>
        <BuklodGameCharacterCompanion gameId={resolvedGameId} />
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
