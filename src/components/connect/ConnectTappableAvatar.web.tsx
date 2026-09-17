import React, { useState } from 'react';
import { View } from 'react-native';

import * as Haptics from 'expo-haptics';

import BuklodPersonVisitSheet from '@/components/BuklodPersonVisitSheet';
import { ConnectPressable } from '@/components/connect/ConnectPressable';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { visitMemberProfile } from '@/lib/buklodMemberProfile';
import {
  BUKLOD_HIT_SLOP_AVATAR,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

type Props = {
  userId?: string | null;
  uri?: string | null;
  name?: string | null;
  size?: number;
  fallbackSource?: number | { uri: string } | null;
  onPress?: (() => void) | null;
  enableLongPressSheet?: boolean;
};

/*
 * Web-specific Connect avatar press behavior.
 *
 * React Native Web does not reliably provide nativeEvent.locationX/locationY
 * for every press path. The native ConnectTappableAvatar intentionally checks
 * those coordinates to keep taps inside the visible circle, but on web that
 * can make a visibly tappable avatar reject every tap. This web implementation
 * keeps the exact same visual/profile behavior while trusting the Pressable's
 * own circular bounds.
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
  const resolvedUserId = String(userId ?? '').trim();
  const longPressEnabled =
    enableLongPressSheet !== false && !!resolvedUserId;
  const [sheetOpen, setSheetOpen] = useState(false);

  const openProfileSheet = longPressEnabled
    ? () => {
        void Haptics.selectionAsync().catch(() => undefined);
        setSheetOpen(true);
      }
    : resolvedUserId
      ? () => {
          void Haptics.selectionAsync().catch(() => undefined);
          visitMemberProfile(resolvedUserId, name);
        }
      : undefined;

  const tapHandler = onPress === null
    ? undefined
    : (onPress ?? openProfileSheet);

  const interactive = !!tapHandler || !!openProfileSheet;

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
        style={{ width: size, height: size }}
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
            ? `${name} avatar. Tap to open conversation.`
            : 'Member avatar. Tap to open conversation.'
        }
        enableScale={false}
        instant={false}
        nested
        delayLongPress={BUKLOD_LONG_PRESS_MS}
        hitSlop={BUKLOD_HIT_SLOP_AVATAR}
        onPress={tapHandler ? () => tapHandler() : undefined}
        onLongPress={openProfileSheet ? () => openProfileSheet() : undefined}
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

export default ConnectTappableAvatar;
