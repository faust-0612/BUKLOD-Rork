import React from 'react';
import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';
import {
  diagnosticPlacementFor,
  type BuklodAdPlacement,
} from '@/lib/buklodAdUnits';

type Props = {
  placement: BuklodAdPlacement;
  placementId: string;
  compact?: boolean;
};

type Surface = 'wall' | 'home' | 'profile' | 'connect' | 'cluster_dashboard';
type Inventory = 'public' | 'org' | 'cluster';

function resolveSurface(placement: BuklodAdPlacement, placementId: string): Surface {
  if (
    placement === 'community_entry' ||
    placementId.endsWith('_wall_entry') ||
    placementId === 'scope_wall_entry'
  ) {
    return 'wall';
  }
  if (placement === 'home') return 'home';
  if (placement === 'profile') return 'profile';
  if (placement === 'messages') return 'connect';
  return 'cluster_dashboard';
}

function resolveInventory(placementId: string): Inventory {
  if (placementId.startsWith('org_') || placementId.startsWith('organization_')) {
    return 'org';
  }
  if (placementId.startsWith('cluster_')) return 'cluster';
  return 'public';
}

/**
 * Android first-view ads use the existing NativeAd inventory first, then the
 * existing BannerAd unit as a sequential fallback. This replaces low-fill
 * banner-only first-view slots without creating a second concurrent request.
 */
export default function BuklodFirstViewAd({
  placement,
  placementId,
}: Props) {
  const surface = resolveSurface(placement, placementId);
  const inventory = resolveInventory(placementId);

  return (
    <BuklodCommunityInlineAd
      surface={surface}
      inventory={inventory}
      slotId={placementId}
      placementIdOverride={placementId}
      diagnosticName={diagnosticPlacementFor(placement)}
      firstView
      active
    />
  );
}
