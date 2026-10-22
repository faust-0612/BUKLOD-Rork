import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  Image as ExpoImage,
} from 'expo-image';

import * as Haptics from 'expo-haptics';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  useBuklodReduceMotion,
} from '@/components/HomeMotion';

/** Approved Home gutter: 4–8dp max per side (not Rork 12dp). */
export const SQUARE_MEDIA_SIDE_GUTTER = 6;

export const SQUARE_MEDIA_RADIUS = 16;

type SquareMediaCardProps = {
  uri?: string | null;
  onPress?: () => void;
  accessibilityLabel?: string;
  kenBurns?: boolean;
  overlay?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SquareMediaFrame({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useBuklodPresentation();

  return (
    <View
      style={[
        {
          marginHorizontal: SQUARE_MEDIA_SIDE_GUTTER,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.square,
          {
            backgroundColor: colors.background,
            borderColor: colors.line,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function SquareMediaCard({
  uri,
  onPress,
  accessibilityLabel,
  kenBurns = false,
  overlay,
  children,
  disabled = false,
  style,
}: SquareMediaCardProps) {
  const { colors } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!kenBurns || reduceMotion) {
      drift.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4800,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4800,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [drift, kenBurns, reduceMotion]);

  const media = (
    <View
      style={[
        styles.square,
        {
          backgroundColor: colors.background,
          borderColor: colors.line,
        },
      ]}
    >
      {uri ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            kenBurns && !reduceMotion
              ? {
                  transform: [
                    {
                      scale: drift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.035],
                      }),
                    },
                  ],
                }
              : null,
          ]}
        >
          <ExpoImage
            source={{ uri }}
            style={styles.fill}
            contentFit="cover"
            transition={reduceMotion ? 0 : 240}
          />
        </Animated.View>
      ) : null}

      {children ? (
        <View style={styles.fill}>
          {children}
        </View>
      ) : null}

      {overlay ? (
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          {overlay}
        </View>
      ) : null}
    </View>
  );

  const firePress = () => {
    onPress?.();
  };

  const content = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={firePress}
      onPressIn={() => {
        if (reduceMotion) {
          return;
        }

        void Haptics.selectionAsync().catch(() => undefined);
      }}
      style={({ pressed }) => [
        { width: '100%' },
        pressed && { opacity: 0.94 },
      ]}
    >
      {media}
    </Pressable>
  ) : (
    media
  );

  return (
    <View
      style={[
        {
          marginHorizontal: SQUARE_MEDIA_SIDE_GUTTER,
        },
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    width: '100%',
    aspectRatio: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: SQUARE_MEDIA_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
});
