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
  buklodMovementExceeded,
  buklodTouchPagePoint,
  stopBuklodNestedPress,
} from '@/lib/buklodTouch';

const WEB_PRESS_MOVE_CANCEL_PX = 20;
const WEB_PRESS_RETENTION = {
  top: 12,
  left: 12,
  right: 12,
  bottom: 12,
} as const;

type Props = PressableProps & {
  /** Fire on pointer-down for isolated navigation/primary chrome. */
  instant?: boolean;

  /** Inner control inside a tappable row/card. */
  nested?: boolean;

  /** Apply the standard compact hit slop. */
  compact?: boolean;
};

/*
 * BUKLOD_MOBILE_WEB_TOUCH_R5
 *
 * Mobile browsers naturally produce a little more pointer drift than native
 * touch events. The native 10px movement cancellation made legitimate phone
 * web taps feel stiff and occasionally disappear. Web keeps the same tap / long
 * press contract but tolerates up to 20px movement and a slightly wider release
 * retention area. Android/iOS continue to use BuklodPressable.tsx unchanged.
 *
 * IMPORTANT: do not forward native-only Pressable props (for example
 * android_ripple) into react-native-web. They can surface as render-time web
 * errors in nested Community controls and are not needed by the browser.
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
  android_ripple: _androidRipple,
  delayLongPress = BUKLOD_LONG_PRESS_MS,
  unstable_pressDelay: _unstablePressDelay,
  hitSlop,
  pressRetentionOffset,
  ...rest
}: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancelled = useRef(false);
  const fired = useRef(false);
  const longPressed = useRef(false);

  const allowInstant = instant && !onLongPress;

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
        WEB_PRESS_MOVE_CANCEL_PX,
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
        pressRetentionOffset ?? WEB_PRESS_RETENTION
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
