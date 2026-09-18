import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';

import { recordBuklodKingdomPreviewResult } from '@/features/games/kingdom/progress';
import type { BuklodGameResult } from '@/features/games/types';
import { BuklodGameLanguageControl, BuklodGameLanguageProvider } from './BuklodGameLanguage';
import BuklodGameBackdrop from './BuklodGameBackdrop';
import { useRorkGameAmbience } from './rorkAudio';
import { BuklodGameEntrance, BuklodGameVisualFX } from './BuklodGameVisualFX';
import type { BuklodGameBiome } from './quality';

type Props = {
  biome: BuklodGameBiome;
  gameId?: string;
  children: React.ReactNode;
};

const palettes: Record<BuklodGameBiome, readonly [string, string, string]> = {
  forest: ['#071b16', '#123f2d', '#1f6b44'],
  playground: ['#3e2a78', '#7b4db8', '#f0a6d2'],
  city: ['#101827', '#173652', '#285d74'],
  farm: ['#2f3b13', '#6a7724', '#c1a641'],
  academy: ['#111d35', '#253d69', '#d1a95f'],
  music: ['#22102f', '#4c205f', '#a2467e'],
  strategy: ['#121722', '#273346', '#5a6b82'],
  art: ['#341a24', '#6b3445', '#bf745d'],
  mission: ['#15251f', '#2e4f3e', '#7c8b55'],
  treasury: ['#291c0d', '#5e421a', '#b38a32'],
  agriculture: ['#2d3612', '#596825', '#9c8d39'],
  highlands: ['#1d2b31', '#425b62', '#81998d'],
  discovery: ['#171a34', '#313b68', '#586bb1'],
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
  const colors = palettes[biome];
  useRorkGameAmbience(resolvedGameId);

  const recordResult = useCallback((result: BuklodGameResult) => {
    if (resolvedGameId && result.gameId !== resolvedGameId) return;
    recordBuklodKingdomPreviewResult(result).catch(() => undefined);
  }, [resolvedGameId]);

  const connectedChildren = withResultHandler(children, recordResult);

  return (
    <BuklodGameLanguageProvider gameId={resolvedGameId}>
      <View style={styles.shell}>
        <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
        <BuklodGameBackdrop gameId={resolvedGameId} opacity={0.38} />
        <BuklodGameVisualFX biome={biome} />
        <View pointerEvents="none" style={styles.lightA} />
        <View pointerEvents="none" style={styles.lightB} />
        <View pointerEvents="none" style={styles.vignette} />
        <View style={styles.content}>
          <BuklodGameEntrance>{connectedChildren}</BuklodGameEntrance>
        </View>
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
    zIndex: 3,
  },
  lightA: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    top: -180,
    right: -100,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  lightB: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -170,
    left: -90,
    backgroundColor: 'rgba(255,230,160,0.09)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
