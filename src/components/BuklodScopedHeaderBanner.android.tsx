type Placement =
  | 'home'
  | 'messages'
  | 'community';

/*
 * Android/APK-only managed-scope header ad suppression.
 *
 * Metro resolves this file instead of BuklodScopedHeaderBanner.tsx on
 * Android. Organization/Cluster header identity and navigation stay intact;
 * only the header banner row is removed. Web/iOS and all non-header ad
 * placements are unchanged.
 */
export default function BuklodScopedHeaderBannerAndroid(
  _props: {
    placement: Placement;
  },
) {
  return null;
}
