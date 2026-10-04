import React from 'react';

import type {
  BuklodImaVideoProps,
} from '@/components/BuklodImaVideo.types';

export type {
  BuklodImaAdEvent,
  BuklodImaPlaybackError,
  BuklodImaVideoProps,
} from '@/components/BuklodImaVideo.types';

export function isBuklodImaNativeAvailable() {
  return false;
}

export default function BuklodImaVideo(
  _props: BuklodImaVideoProps,
) {
  return null;
}
