import React from 'react';

import {
  StyleSheet,
  View,
} from 'react-native';
import {
  Fit,
  RiveView,
  useRiveFile,
} from '@rive-app/react-native';

import { useBuklodReduceMotion } from '@/components/HomeMotion';

type Props = {
  url?: string | null;
  visible?: boolean;
  opacity?: number;
};

type RemoteProps = {
  url: string;
  visible: boolean;
  opacity: number;
};

function RemoteRiveOverlay({
  url,
  visible,
  opacity,
}: RemoteProps) {
  const reduceMotion = useBuklodReduceMotion();
  const {
    riveFile,
    isLoading,
    error,
  } = useRiveFile({ uri: url });

  if (
    !visible ||
    reduceMotion ||
    isLoading ||
    error ||
    !riveFile
  ) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { opacity },
      ]}
    >
      <RiveView
        file={riveFile}
        autoPlay
        fit={Fit.Contain}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Native-only decorative Rive layer for an approved BUKLOD-owned scene asset.
 * Character ownership/progression remains in the existing local renderer.
 */
export default function BuklodRiveSceneOverlay({
  url,
  visible = true,
  opacity = 0.72,
}: Props) {
  const normalizedUrl = String(url ?? '').trim();

  if (!normalizedUrl) {
    return null;
  }

  return (
    <RemoteRiveOverlay
      url={normalizedUrl}
      visible={visible}
      opacity={Math.max(0, Math.min(opacity, 1))}
    />
  );
}
