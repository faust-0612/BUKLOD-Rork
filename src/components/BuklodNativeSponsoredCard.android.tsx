import React from 'react';
import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';

type Surface = 'home' | 'profile' | 'connect' | 'cluster_dashboard';
type Props = {
  surface: Surface;
  slotId: string;
  prefetch?: boolean;
};

/** Actual Android AdMob native image/video creative, never user-generated video. */
export default function BuklodNativeSponsoredCard({ surface, slotId, prefetch = false }: Props) {
  return (
    <BuklodCommunityInlineAd
      surface={surface}
      slotId={slotId}
      prefetch={prefetch}
      active
    />
  );
}
