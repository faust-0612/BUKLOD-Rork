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
 * Decorative Rive layer for a BUKLOD-owned scene asset.
 *
 * Intentionally does not replace the authoritative local character renderer.
 * It can add ambient animated art now and later be upgraded to a fully rigged
 * BUKLOD character once that asset has an approved state-machine contract.
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
