import React from 'react';
import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';

type Surface = 'home' | 'profile' | 'connect' | 'cluster_dashboard';
type Props = {
  surface: Surface;
  slotId: string;
};

/** Actual Android AdMob native image/video creative, never user-generated video. */
export default function BuklodNativeSponsoredCard({ surface, slotId }: Props) {
  return (
    <BuklodCommunityInlineAd
      surface={surface}
      slotId={slotId}
      active
    />
  );
}
