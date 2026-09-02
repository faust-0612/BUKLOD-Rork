import React, {
  useState,
} from 'react';
import {
  View,
  type GestureResponderEvent,
} from 'react-native';

import * as Haptics from 'expo-haptics';

import BuklodPressable from '@/components/BuklodPressable';

import BuklodPersonVisitSheet from '@/components/BuklodPersonVisitSheet';
import {
  ProfileAvatar,
} from '@/components/ProfileAvatar';
import {
  visitMemberProfile,
} from '@/lib/buklodMemberProfile';
import {
  BUKLOD_HIT_SLOP_AVATAR,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

type Props = {
  userId?: string | null;
  uri?: string | null;
  name?: string | null;
  size?: number;
  fallbackSource?:
    | number
    | { uri: string }
    | null;
  onPress?: (() => void) | null;
  enableLongPressSheet?: boolean;
};

function isInsideCircle(
  locationX: number,
  locationY: number,
  radius: number
) {
  if (
    !Number.isFinite(locationX) ||
    !Number.isFinite(locationY) ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {
    return false;
  }

  const dx = locationX - radius;
  const dy = locationY - radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function isAvatarCircleHit(
  event: GestureResponderEvent,
  radius: number,
  origin?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null
) {
  const native = event.nativeEvent;

  if (
    origin &&
    Number.isFinite(origin.x) &&
    Number.isFinite(origin.y) &&
    Number.isFinite(native.pageX) &&
    Number.isFinite(native.pageY)
  ) {
    const hitRadius =
      Math.min(origin.width, origin.height) / 2 ||
      radius;
    const dx = Number(native.pageX) - (origin.x + hitRadius);
    const dy = Number(native.pageY) - (origin.y + hitRadius);
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }

  return isInsideCircle(
    Number(native.locationX),
    Number(native.locationY),
    radius
  );
}

/**
 * Canonical tappable avatar for Community and global surfaces.
 * Connect screens use ConnectTappableAvatar instead.
 */
export function BuklodTappableAvatar({
  userId,
  uri,
  name,
  size = 48,
  fallbackSource,
  onPress,
  enableLongPressSheet,
}: Props) {
  const resolvedUserId =
    String(userId ?? '').trim();

  const longPressEnabled =
    enableLongPressSheet !== false &&
    !!resolvedUserId;

  const pressHandler =
    onPress === null
      ? undefined
      : onPress;

  const [
    sheetOpen,
    setSheetOpen,
  ] = useState(false);

  const openProfileSheet = longPressEnabled
    ? () => {
        void Haptics
          .selectionAsync()
          .catch(() => undefined);
        setSheetOpen(true);
      }
    : resolvedUserId
      ? () => {
          void Haptics
            .selectionAsync()
            .catch(() => undefined);
          visitMemberProfile(
            resolvedUserId,
            name
          );
        }
      : undefined;

  const interactive =
    !!pressHandler ||
    !!openProfileSheet;

  const avatar = (
    <ProfileAvatar
      userId={userId}
      uri={uri}
      name={name}
      size={size}
      fallbackSource={fallbackSource}
    />
  );

  if (!interactive) {
    return (
      <View
        pointerEvents="none"
        style={{
          width: size,
          height: size,
        }}
      >
        {avatar}
      </View>
    );
  }

  return (
    <>
      <BuklodPressable
        accessibilityRole="button"
        accessibilityLabel={
          name
            ? `${name} avatar. Long press to view profile.`
            : 'Member avatar. Long press to view profile.'
        }
        hitSlop={BUKLOD_HIT_SLOP_AVATAR}
        instant={false}
        nested
        delayLongPress={BUKLOD_LONG_PRESS_MS}
        onPress={
          pressHandler
            ? (event) => {
                if (!isAvatarCircleHit(event, size / 2)) {
                  return;
                }
                pressHandler();
              }
            : undefined
        }
        onLongPress={
          openProfileSheet
            ? (event) => {
                if (!isAvatarCircleHit(event, size / 2)) {
                  return;
                }
                openProfileSheet();
              }
            : undefined
        }
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        }}
      >
        {avatar}
      </BuklodPressable>

      <BuklodPersonVisitSheet
        visible={sheetOpen}
        userId={userId}
        displayName={name}
        avatarUrl={uri}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

export default BuklodTappableAvatar;
