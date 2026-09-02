/* BUKLOD_CHARACTER_ENGINE_2_NATIVE_SKIA_R1 */
import React, {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {
  Canvas,
  Circle,
  LinearGradient,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';

type Props = {
  children: ReactNode;
};

/**
 * Visual engine layer only.
 *
 * Existing Character state remains authoritative:
 * rank -> unlock -> ownership -> equipped item -> save.
 *
 * This component upgrades presentation without creating a second
 * progression/inventory system.
 */
export function BuklodCharacterStageV2({
  children,
}: Props) {
  const motion = useRef(
    new Animated.Value(0)
  ).current;

  const [reduceMotion, setReduceMotion] =
    useState(false);

  useEffect(() => {
    let alive = true;

    void AccessibilityInfo
      .isReduceMotionEnabled()
      .then(value => {
        if (alive) {
          setReduceMotion(value);
        }
      })
      .catch(() => undefined);

    const sub =
      AccessibilityInfo
        .addEventListener?.(
          'reduceMotionChanged',
          setReduceMotion
        );

    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    motion.stopAnimation();
    motion.setValue(0);

    if (reduceMotion) {
      return;
    }

    const loop =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            motion,
            {
              toValue: 1,
              duration: 2200,
              easing:
                Easing.inOut(
                  Easing.sin
                ),
              useNativeDriver:
                true,
            }
          ),
          Animated.timing(
            motion,
            {
              toValue: 0,
              duration: 2200,
              easing:
                Easing.inOut(
                  Easing.sin
                ),
              useNativeDriver:
                true,
            }
          ),
        ])
      );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [
    motion,
    reduceMotion,
  ]);

  const translateY =
    motion.interpolate({
      inputRange: [0, 1],
      outputRange: [1.5, -2.5],
    });

  const scale =
    motion.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.008],
    });

  return (
    <View
      style={styles.stage}
      pointerEvents="box-none"
    >
      <Canvas
        style={
          StyleSheet.absoluteFill
        }
        pointerEvents="none"
      >
        <Rect
          x={0}
          y={0}
          width={720}
          height={520}
        >
          <LinearGradient
            start={vec(80, 0)}
            end={vec(620, 500)}
            colors={[
              'rgba(250,253,251,0.96)',
              'rgba(225,241,231,0.88)',
              'rgba(197,224,208,0.72)',
            ]}
          />
        </Rect>

        <Circle
          cx={360}
          cy={170}
          r={205}
        >
          <RadialGradient
            c={vec(360, 170)}
            r={205}
            colors={[
              'rgba(255,255,255,0.82)',
              'rgba(234,248,239,0.34)',
              'rgba(234,248,239,0)',
            ]}
          />
        </Circle>

        <Circle
          cx={75}
          cy={70}
          r={105}
        >
          <RadialGradient
            c={vec(75, 70)}
            r={105}
            colors={[
              'rgba(255,255,255,0.58)',
              'rgba(255,255,255,0)',
            ]}
          />
        </Circle>

        <Circle
          cx={640}
          cy={115}
          r={130}
        >
          <RadialGradient
            c={vec(640, 115)}
            r={130}
            colors={[
              'rgba(116,181,140,0.18)',
              'rgba(116,181,140,0)',
            ]}
          />
        </Circle>
      </Canvas>

      <View
        style={
          styles.floorShadow
        }
        pointerEvents="none"
      />

      <View
        style={
          styles.backPlate
        }
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.character,
          {
            transform: [
              { translateY },
              { scale },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>

      <View
        pointerEvents="none"
        style={styles.rimLight}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    stage: {
      position: 'relative',
      overflow: 'hidden',
      alignSelf: 'stretch',
      minHeight: 236,
      borderRadius: 26,
      backgroundColor:
        'rgba(235,246,239,0.94)',
      borderWidth: 1,
      borderColor:
        'rgba(26,91,51,0.12)',
      shadowColor: '#10261A',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: {
        width: 0,
        height: 9,
      },
      elevation: 4,
    },

    backPlate: {
      position: 'absolute',
      left: '18%',
      right: '18%',
      top: 22,
      bottom: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.68)',
      backgroundColor:
        'rgba(255,255,255,0.09)',
    },

    floorShadow: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: 14,
      width: '48%',
      height: 24,
      borderRadius: 999,
      backgroundColor:
        'rgba(17,55,31,0.12)',
      transform: [
        { scaleX: 1.18 },
        { scaleY: 0.54 },
      ],
    },

    character: {
      flex: 1,
      minHeight: 236,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },

    rimLight: {
      position: 'absolute',
      left: 12,
      right: 12,
      top: 10,
      height: 1,
      borderRadius: 999,
      backgroundColor:
        'rgba(255,255,255,0.78)',
    },
  });

export default BuklodCharacterStageV2;