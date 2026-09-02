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
   * Fire `onPress` on finger down. Only for isolated chrome
   * (bottom nav, FABs, primary form buttons) — never list rows.
   * Ignored when `onLongPress` is set so tap vs long-press can compete.
   */
  instant?: boolean;

  /** Inner control inside a tappable row/card. Stops parent handlers. */
  nested?: boolean;

  /** Apply the standard compact icon hitSlop. Large controls should omit this. */
  compact?: boolean;
};

/**
 * Canonical BUKLOD press target.
 * - No press delay for ordinary buttons
 * - Movement cancel so scrolls / small drags do not count as taps
 * - Long-press does not also fire onPress
 * - Instant press-in never double-fires with onPress
 */
export default function BuklodPressable({
  instant = false,
  nested = false,
  compact = false,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  onTouchMove,
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

  const allowInstant =
    instant &&
    !onLongPress;

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
      onPressIn={event => {
        if (nested) {
          stopBuklodNestedPress(event);
        }

        markTouch(event);
        onPressIn?.(event);

        if (
          allowInstant &&
          !disabled &&
          onPress
        ) {
          fired.current = true;
          onPress(event);
        }
      }}
      onPressOut={event => {
        onPressOut?.(event);
      }}
      onLongPress={
        onLongPress
          ? event => {
              if (nested) {
                stopBuklodNestedPress(event);
              }

              if (cancelled.current || disabled) {
                return;
              }

              longPressed.current = true;
              onLongPress(event);
            }
          : undefined
      }
      onPress={
        allowInstant
          ? undefined
          : event => {
              if (nested) {
                stopBuklodNestedPress(event);
              }

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
            }
      }
    />
  );
}
