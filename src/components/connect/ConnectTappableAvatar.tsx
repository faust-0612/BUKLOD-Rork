import React, {
  useState,
} from 'react';
import {
  View,
} from 'react-native';
import { router } from 'expo-router';

import * as Haptics from 'expo-haptics';

import BuklodPersonVisitSheet from '@/components/BuklodPersonVisitSheet';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import {
  ProfileAvatar,
} from '@/components/ProfileAvatar';
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
 * Connect-specific avatar target.
 *
 * Tap opens the direct conversation / write-message thread.
 * Long press opens the member profile sheet.
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

  const openConversation = resolvedUserId
    ? () => {
        void Haptics
          .selectionAsync()
          .catch(() => undefined);
        router.push({
          pathname: '/connect/personal/[threadId]',
          params: {
            threadId: 'new',
            targetUserId: resolvedUserId,
            otherUserName: String(name ?? ''),
          },
        } as any);
      }
    : undefined;

  const openProfileSheet = longPressEnabled
    ? () => {
        void Haptics
          .selectionAsync()
          .catch(() => undefined);
        setSheetOpen(true);
      }
    : undefined;

  const tapHandler =
    onPress === null
      ? undefined
      : (onPress ?? openConversation);

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
            ? `${name} avatar. Tap to message${longPressEnabled ? ', long press to view profile' : ''}.`
            : `Member avatar. Tap to message${longPressEnabled ? ', long press to view profile' : ''}.`
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
