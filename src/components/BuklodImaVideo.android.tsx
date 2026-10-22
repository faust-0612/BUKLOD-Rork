import React from 'react';
import {
  requireNativeViewManager,
} from 'expo-modules-core';

import type {
  BuklodImaVideoProps,
} from '@/components/BuklodImaVideo.types';

let NativeView:
  | React.ComponentType<BuklodImaVideoProps>
  | null = null;

try {
  NativeView =
    requireNativeViewManager<BuklodImaVideoProps>(
      'BuklodImaVideo',
    );
} catch {
  NativeView = null;
}

export function isBuklodImaNativeAvailable() {
  return Boolean(NativeView);
}

export default function BuklodImaVideo(
  props: BuklodImaVideoProps,
) {
  if (!NativeView) {
    return null;
  }

  return (
    <NativeView
      {...props}
    />
  );
}
