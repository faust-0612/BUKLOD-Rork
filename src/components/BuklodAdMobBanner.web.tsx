import React from 'react';

import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

type Props = {
  placement: BuklodAdPlacement;
  compact?: boolean;
  format?: 'adaptive' | 'inline' | 'mediumRectangle';
  diagnosticName?: 'home_bottom_banner' | 'community_inline' | 'reels_inline' | 'test';
  requireViewport?: boolean;
  showLabel?: boolean;
  placementId?: string;
};

/*
 * BUKLOD_WEB_ADMOB_BRIDGE_R1
 * Native resolves BuklodAdMobBanner.tsx (AdMob). Web resolves this file and
 * serves AdSense / approved BUKLOD sponsors through the same placement API.
 */
export default function BuklodAdMobBanner({
  placement,
  compact = false,
  format = 'adaptive',
  showLabel = true,
  placementId,
}: Props) {
  return (
    <BuklodWebAdSlot
      placement={placement}
      compact={compact}
      format={format}
      showLabel={showLabel}
      placementId={placementId}
    />
  );
}
