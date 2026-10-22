import React from 'react';

import BuklodPressable from '@/components/BuklodPressable';
import {
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
      instant={instant}
      nested={nested}
      {...rest}
    />
  );
}
