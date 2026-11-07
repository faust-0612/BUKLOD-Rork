import React, { useState } from 'react';
import { View } from 'react-native';

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { tryOpenBuklodDesktopDock } from '@/lib/buklodDesktopContextDock';

import BuklodPersonVisitSheet from '@/components/BuklodPersonVisitSheet';
import { ConnectPressable } from '@/components/connect/ConnectPressable';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import {
  BUKLOD_HIT_SLOP_AVATAR,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

type Props = {
  userId?: string | null;
  uri?: string | null;
  name?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded';
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
  shape = 'circle',
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
    : undefined;

  const openConversation = resolvedUserId
    ? () => {
        if (tryOpenBuklodDesktopDock({
          kind: 'direct', threadId: 'new', targetUserId: resolvedUserId,
          otherUserName: name ?? '',
        })) return;
        router.push({
        pathname: '/connect/personal/[threadId]' as any,
        params: {
          threadId: 'new',
          targetUserId: resolvedUserId,
          otherUserName: name ?? '',
        },
      } as any);
      }
    : undefined;

  const tapHandler = onPress === null
    ? undefined
    : (onPress ?? openConversation);

  const interactive = !!tapHandler || !!openProfileSheet;

  const avatar = (
    <ProfileAvatar
      userId={userId}
      uri={uri}
      name={name}
      size={size}
      shape={shape}
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
            ? `${name} avatar. Tap to message. Long press for profile.`
            : 'Member avatar. Tap to message. Long press for profile.'
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
          borderRadius: shape === 'rounded' ? Math.round(size * 0.2) : size / 2,
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
