import React, {
  useState,
} from 'react';
import {
  View,
} from 'react-native';

import * as Haptics from 'expo-haptics';

import BuklodPersonVisitSheet from '@/components/BuklodPersonVisitSheet';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import {
  ProfileAvatar,
} from '@/components/ProfileAvatar';
import {
  visitMemberProfile,
} from '@/lib/buklodMemberProfile';
import {
  isAvatarCircleHit,
} from '@/components/BuklodTappableAvatar';
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

/**
 * Connect-specific avatar tap target.
 *
 * Tap uses a normal press-up so it can open the profile sheet
 * without jumping into a message on finger-down.
 */
export function ConnectTappableAvatar({
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

  const tapHandler =
    onPress === null
      ? undefined
      : (onPress ?? openProfileSheet);

  const interactive =
    !!tapHandler ||
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
      <ConnectPressable
        accessibilityRole="button"
        accessibilityLabel={
          name
            ? `${name} avatar. Tap to view profile.`
            : 'Member avatar. Tap to view profile.'
        }
        enableScale={false}
        instant={false}
        nested
        delayLongPress={BUKLOD_LONG_PRESS_MS}
        hitSlop={BUKLOD_HIT_SLOP_AVATAR}
        onPress={
          tapHandler
            ? (event) => {
                if (!isAvatarCircleHit(event, size / 2)) {
                  return;
                }
                tapHandler();
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
      </ConnectPressable>

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
