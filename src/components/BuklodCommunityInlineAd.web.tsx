import React from 'react';

import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';

export default function BuklodCommunityInlineAd({
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
      placement="community"
      compact
      format="inline"
    />
  );
}
