import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

type Props = {
  placement: BuklodAdPlacement;
  placementId: string;
  compact?: boolean;
};

/**
 * One above-the-fold ad opportunity. The banner owns its loading probe and
 * collapses itself when the route, unit, consent, or inventory is unavailable.
 * Never reserve a permanent empty shell around a null ad.
 */
export default function BuklodFirstViewAd({
  placement,
  placementId,
  compact = true,
}: Props) {
  return (
    <BuklodAdMobBanner
      placement={placement}
      placementId={placementId}
      compact={compact}
      format="adaptive"
      requireViewport
      showLabel
    />
  );
}
