import React, { useState } from 'react';
import {
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import * as Haptics from 'expo-haptics';

import BuklodPressable from '@/components/BuklodPressable';
import BuklodPersonVisitSheet from '@/components/BuklodPersonVisitSheet';
import {
  BUKLOD_HIT_SLOP_TIGHT,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

type Props = {
  userId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  disabled?: boolean;
};

export default function BuklodTappablePersonName({
  userId,
  displayName,
  avatarUrl,
  children,
  style,
  numberOfLines,
  disabled = false,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const id = String(userId ?? '').trim();
  const canOpen = !!id && !disabled;

  const handleLongPress = () => {
    if (!canOpen) {
      return;
    }

    void Haptics.selectionAsync().catch(() => undefined);
    setSheetOpen(true);
  };

  return (
    <>
      <BuklodPressable
        accessibilityRole="button"
        accessibilityLabel={
          displayName
            ? `${displayName}. Long press to view profile.`
            : 'Member name. Long press to view profile.'
        }
        disabled={!canOpen}
        instant={false}
        nested
        delayLongPress={BUKLOD_LONG_PRESS_MS}
        onLongPress={handleLongPress}
        hitSlop={BUKLOD_HIT_SLOP_TIGHT}
      >
        <Text
          style={style}
          numberOfLines={numberOfLines}
        >
          {children}
        </Text>
      </BuklodPressable>

      <BuklodPersonVisitSheet
        visible={sheetOpen}
        userId={id}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
