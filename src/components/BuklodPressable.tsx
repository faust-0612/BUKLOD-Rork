import React, {
  useRef,
} from 'react';

import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';

import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
  BUKLOD_PRESS_MOVE_CANCEL_PX,
  BUKLOD_PRESS_RETENTION,
  buklodMovementExceeded,
  buklodTouchPagePoint,
  stopBuklodNestedPress,
} from '@/lib/buklodTouch';

type Props = PressableProps & {
  /**
   * Legacy fast-response hint. The action still fires on press release so a
   * finger-down that becomes a scroll/drag can be cancelled safely.
   */
  instant?: boolean;

  /** Inner control inside a tappable row/card. Stops parent handlers. */
  nested?: boolean;

  /** Apply the standard compact icon hitSlop. Large controls should omit this. */
  compact?: boolean;
};

/**
 * Canonical BUKLOD press target.
 * - No artificial press delay for ordinary buttons
 * - Actions fire only after release, never on finger-down
 * - Movement cancel so scrolls / small drags do not count as taps
 * - Long-press does not also fire onPress
 */
export default function BuklodPressable({
  instant: _instant = false,
  nested = false,
  compact = false,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  onTouchMove,
  onTouchCancel,
  onResponderMove,
  onResponderTerminate,
  disabled,
  android_ripple,
  delayLongPress = BUKLOD_LONG_PRESS_MS,
  unstable_pressDelay,
  hitSlop,
  pressRetentionOffset,
  ...rest
}: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancelled = useRef(false);
  const fired = useRef(false);
  const longPressed = useRef(false);

  const resolvedHitSlop =
    hitSlop ??
    (compact ? BUKLOD_HIT_SLOP : undefined);

  const markTouch = (
    event: GestureResponderEvent,
  ) => {
    origin.current = buklodTouchPagePoint(event);
    cancelled.current = false;
    fired.current = false;
    longPressed.current = false;
  };

  const trackMovement = (
    event: GestureResponderEvent,
  ) => {
    const point = buklodTouchPagePoint(event);
    if (
      buklodMovementExceeded(
        origin.current,
        point.x,
        point.y,
        BUKLOD_PRESS_MOVE_CANCEL_PX,
      )
    ) {
      cancelled.current = true;
    }
  };

  const cancelPress = () => {
    cancelled.current = true;
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      delayLongPress={delayLongPress}
      hitSlop={resolvedHitSlop}
      pressRetentionOffset={
        pressRetentionOffset ?? BUKLOD_PRESS_RETENTION
      }
      unstable_pressDelay={
        typeof unstable_pressDelay === 'number'
          ? unstable_pressDelay
          : 0
      }
      android_ripple={
        android_ripple ?? {
          color: 'transparent',
        }
      }
      onTouchMove={event => {
        trackMovement(event);
        onTouchMove?.(event);
      }}
      onResponderMove={event => {
        trackMovement(event);
        onResponderMove?.(event);
      }}
      onTouchCancel={event => {
        cancelPress();
        onTouchCancel?.(event);
      }}
      onResponderTerminate={event => {
        cancelPress();
        onResponderTerminate?.(event);
      }}
      onPressIn={event => {
        if (nested) {
          stopBuklodNestedPress(event);
        }

        markTouch(event);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        // Some ScrollView/FlatList responder paths do not reliably deliver
        // every touch-move event to the child Pressable. Re-check the final
        // release position so a drag/flick cannot fall through as a tap.
        trackMovement(event);
        onPressOut?.(event);
      }}
      onLongPress={
        onLongPress
          ? event => {
              if (nested) {
                stopBuklodNestedPress(event);
              }

              trackMovement(event);
              if (cancelled.current || disabled) {
                return;
              }

              longPressed.current = true;
              onLongPress(event);
            }
          : undefined
      }
      onPress={event => {
        if (nested) {
          stopBuklodNestedPress(event);
        }

        // Final-position verification is the last safety net for web/PWA and
        // nested scroll containers where onTouchMove may be interrupted.
        trackMovement(event);

        if (
          disabled ||
          cancelled.current ||
          longPressed.current ||
          fired.current
        ) {
          return;
        }

        fired.current = true;
        onPress?.(event);
      }}
    />
  );
}