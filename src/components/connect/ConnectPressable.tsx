import React from 'react';

import BuklodPressable from '@/components/BuklodPressable';
import {
  Platform,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** @deprecated Scale press animation removed for instant taps. */
  enableScale?: boolean;
  instant?: boolean;
  nested?: boolean;
};

export function ConnectPressable({
  instant = false,
  enableScale: _enableScale,
  nested = true,
  ...rest
}: Props) {
  return (
    <BuklodPressable
      instant={Platform.OS === 'android' ? false : instant}
      nested={nested}
      {...rest}
    />
  );
}
