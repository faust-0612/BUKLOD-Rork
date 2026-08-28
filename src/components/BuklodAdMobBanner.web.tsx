import React from 'react';

type BuklodAdPlacement =
  | 'home'
  | 'community'
  | 'prayer'
  | 'messages'
  | 'bible'
  | 'devotion'
  | 'me'
  | 'reels'
  | 'test';

type Props = {
  placement: BuklodAdPlacement;
  compact?: boolean;
  format?: 'adaptive' | 'inline' | 'mediumRectangle';
  diagnosticName?: 'home_bottom_banner' | 'community_inline' | 'reels_inline' | 'test';
  requireViewport?: boolean;
  showLabel?: boolean;
};

export default function BuklodAdMobBanner(_props: Props) {
  return null;
}
