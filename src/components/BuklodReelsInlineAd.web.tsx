import React from 'react';

import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';

export default function BuklodReelsInlineAd({
  active = true,
}: {
  slotId?: string;
  active?: boolean;
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
