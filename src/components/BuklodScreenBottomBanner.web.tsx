import React from 'react';

import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

export default function BuklodScreenBottomBanner({
  placement,
  variant = 'compact',
}: {
  placement: BuklodAdPlacement;
  variant?: 'compact' | 'large';
}) {
  return (
    <BuklodWebAdSlot
      placement={placement}
      compact={variant === 'compact'}
      format={variant === 'large' ? 'mediumRectangle' : 'adaptive'}
    />
  );
}
