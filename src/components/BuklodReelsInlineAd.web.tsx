import React from 'react';

import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';

export default function BuklodReelsInlineAd({
  active = true,
}: {
  slotId?: string;
  active?: boolean;
  prepare?: boolean;
  onLoadStateChange?: (state: 'loading' | 'ready' | 'unavailable') => void;
}) {
  if (!active) {
    return null;
  }

  return (
    <BuklodWebAdSlot
      placement="reels"
      compact
      format="inline"
    />
  );
}
