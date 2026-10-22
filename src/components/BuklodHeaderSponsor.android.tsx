type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer'
  | 'me';

/*
 * Android/APK-only title-bar ad suppression.
 *
 * Metro resolves this file instead of BuklodHeaderSponsor.tsx on Android.
 * Keep web/iOS header advertising and every non-header ad placement intact.
 * Returning null also removes the sponsor component footprint so the title
 * bar does not reserve blank width after the banner is removed.
 */
export default function BuklodHeaderSponsorAndroid(
  _props: {
    placement: Placement;
  },
) {
  return null;
}
