import React, {
  useCallback,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

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
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);

      return () => {
        setFocused(false);
      };
    }, [])
  );

  const {
    riveFile,
    isLoading,
    error,
  } = useRiveFile(url);

  if (
    !visible ||
    !focused ||
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
        onError={() => undefined}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Native-only decorative Rive layer for an approved BUKLOD-owned scene asset.
 *
 * BUKLOD_PERF_DELTA_RIVE_R1 keeps autoplay mounted only while the owning route
 * is focused. Character ownership/progression remains in the local renderer.
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
