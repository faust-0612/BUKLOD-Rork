import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  BUKLOD_LONG_PRESS_MS,
  BUKLOD_PRESS_MOVE_CANCEL_PX,
} from '@/lib/buklodTouch';
import { BuklodCachedMediaImage } from '@/components/BuklodCachedMediaImage';

type Props = {
  uri: string;
  mediaPath?: string | null;
  active?: boolean;
  onZoomedChange?: (zoomed: boolean) => void;
  onLongPress?: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOMED_SCALE = 1.04;
const DOUBLE_TAP_SCALE = 3;

export function BuklodZoomablePhoto({
  uri,
  mediaPath,
  active = true,
  onZoomedChange,
  onLongPress,
}: Props) {
  const window = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const viewW = useSharedValue(window.width);
  const viewH = useSharedValue(window.height);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const notifyZoomed = useCallback(
    (next: boolean) => {
      setZoomed(next);
      onZoomedChange?.(next);
    },
    [onZoomedChange]
  );

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    runOnJS(notifyZoomed)(false);
  };

  const clampPan = (
    nextX: number,
    nextY: number
  ) => {
    'worklet';
    const maxX = Math.max(
      0,
      ((scale.value - 1) * viewW.value) / 2
    );
    const maxY = Math.max(
      0,
      ((scale.value - 1) * viewH.value) / 2
    );

    translateX.value = Math.max(
      -maxX,
      Math.min(maxX, nextX)
    );
    translateY.value = Math.max(
      -maxY,
      Math.min(maxY, nextY)
    );
  };

  useEffect(() => {
    if (active) {
      return;
    }

    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    setZoomed(false);
  }, [active, scale, translateX, translateY]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate(event => {
      const next = Math.max(
        MIN_SCALE,
        Math.min(
          MAX_SCALE,
          startScale.value * event.scale
        )
      );
      scale.value = next;
      clampPan(translateX.value, translateY.value);
    })
    .onEnd(() => {
      if (scale.value <= ZOOMED_SCALE) {
        reset();
        return;
      }

      clampPan(translateX.value, translateY.value);
      runOnJS(notifyZoomed)(true);
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(1)
    .minDistance(BUKLOD_PRESS_MOVE_CANCEL_PX)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate(event => {
      clampPan(
        startX.value + event.translationX,
        startY.value + event.translationY
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .maxDelay(280)
    .onEnd((event, success) => {
      if (!success) {
        return;
      }

      if (scale.value > ZOOMED_SCALE) {
        reset();
        return;
      }

      const next = DOUBLE_TAP_SCALE;
      scale.value = withTiming(next);
      translateX.value = withTiming(
        (viewW.value / 2 - event.x) * (next - 1) / next
      );
      translateY.value = withTiming(
        (viewH.value / 2 - event.y) * (next - 1) / next
      );
      runOnJS(notifyZoomed)(true);
    });

  const longPress = Gesture.LongPress()
    .enabled(!!onLongPress)
    .minDuration(BUKLOD_LONG_PRESS_MS)
    .onStart(() => {
      if (onLongPress) {
        runOnJS(onLongPress)();
      }
    });

  const gesture = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(doubleTap, longPress)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0) {
            viewW.value = width;
          }
          if (height > 0) {
            viewH.value = height;
          }
        }}
        style={styles.frame}
      >
        <Animated.View
          collapsable={false}
          style={[styles.mover, animatedStyle]}
        >
          <BuklodCachedMediaImage
            uri={uri}
            mediaPath={mediaPath}
            style={styles.image}
            contentFit="contain"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  mover: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
