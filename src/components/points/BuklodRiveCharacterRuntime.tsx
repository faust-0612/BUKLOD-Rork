/* BUKLOD_RIVE_NATIVE_AVATAR_FOUNDATION_R1_4 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import {
  Fit,
  RiveView,
  useRiveFile,
} from '@rive-app/react-native';

import BuklodLocalCharacterFigure
  from '@/components/points/BuklodLocalCharacterFigure';

import type {
  BodyId,
  Equipment,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  width: number;
  height: number;
  riveUrl?: string | null;
};

function LocalFallback({
  body,
  equipment,
  width,
  height,
}: Pick<
  Props,
  'body' |
  'equipment' |
  'width' |
  'height'
>) {
  const figureWidth =
    Math.min(
      width * 0.78,
      Math.max(
        72,
        height * 0.43,
      ),
    );

  return (
    <View
      style={[
        styles.center,
        {
          width,
          height,
        },
      ]}
      pointerEvents="none"
    >
      <BuklodLocalCharacterFigure
        body={body}
        equipment={equipment}
        width={figureWidth}
        mode="full"
      />
    </View>
  );
}

function RiveRemoteCharacter({
  body,
  equipment,
  width,
  height,
  riveUrl,
}: Omit<Props, 'riveUrl'> & {
  riveUrl: string;
}) {
  /*
   * IMPORTANT:
   * The exact package resolved in this Expo project declares:
   *   useRiveFile(source: ArrayBuffer | { uri: string })
   * Therefore the installed runtime contract is { uri }, not { url }.
   */
  const {
    riveFile,
    isLoading,
    error,
  } = useRiveFile({
    uri: riveUrl,
  });

  if (isLoading) {
    return (
      <View
        style={[
          styles.center,
          {
            width,
            height,
          },
        ]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (
    error ||
    !riveFile
  ) {
    return (
      <LocalFallback
        body={body}
        equipment={equipment}
        width={width}
        height={height}
      />
    );
  }

  return (
    <View
      style={[
        styles.frame,
        {
          width,
          height,
        },
      ]}
    >
      <RiveView
        file={riveFile}
        autoPlay
        fit={Fit.Contain}
        style={styles.rive}
      />
    </View>
  );
}

/**
 * Native Rive host.
 *
 * R1.3 only establishes the native runtime safely.
 * BUKLOD rank / unlock / owned / equipped state remains authoritative.
 * Until a BUKLOD-owned .riv rig is supplied, the existing local figure
 * remains the fallback.
 */
export default function
BuklodRiveCharacterRuntime(
  props: Props,
) {
  const riveUrl =
    String(
      props.riveUrl ?? ''
    ).trim();

  if (!riveUrl) {
    return (
      <LocalFallback
        body={props.body}
        equipment={props.equipment}
        width={props.width}
        height={props.height}
      />
    );
  }

  return (
    <RiveRemoteCharacter
      body={props.body}
      equipment={props.equipment}
      width={props.width}
      height={props.height}
      riveUrl={riveUrl}
    />
  );
}

const styles =
  StyleSheet.create({
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    frame: {
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },

    rive: {
      width: '100%',
      height: '100%',
    },
  });